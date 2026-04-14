"""
Production GradingService implementation.
Uses real VectorStore and AIClient — no mock logic.
"""

import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

try:
    from ..interfaces.grading_service import GradingService
    from ..interfaces.vector_store import VectorStore
    from ..interfaces.ai_client import AIClient
    from ..models.grading_models import (
        GradingCriterion,
        RubricChunk,
        MarkingScheme,
        EssayGradingRequest,
        EssayGradingResponse,
    )
except ImportError:
    from interfaces.grading_service import GradingService
    from interfaces.vector_store import VectorStore
    from interfaces.ai_client import AIClient
    from models.grading_models import (
        GradingCriterion,
        RubricChunk,
        MarkingScheme,
        EssayGradingRequest,
        EssayGradingResponse,
    )

logger = logging.getLogger(__name__)


class ProductionGradingService(GradingService):
    """
    Production grading service that orchestrates real AI grading
    using ChromaDB vector search and Azure OpenAI.
    """

    def __init__(self, vector_store: VectorStore, ai_client: AIClient):
        self.vector_store = vector_store
        self.ai_client = ai_client
        self.marking_schemes: Dict[str, MarkingScheme] = {}

    async def create_marking_scheme(self, request: dict) -> MarkingScheme:
        """Create and cache a marking scheme."""
        scheme_id = request.get("id") or str(uuid.uuid4())

        marking_scheme = MarkingScheme(
            id=scheme_id,
            question_id=request.get("question_id", scheme_id),
            name=request.get("name", ""),
            description=request.get("description", ""),
            criteria=request.get("criteria", []),
            rubric_text=request.get("rubric_text", ""),
            created_by=request.get("created_by", "system"),
            created_at=datetime.now()
        )

        self.marking_schemes[scheme_id] = marking_scheme
        return marking_scheme

    async def get_marking_scheme(self, scheme_id: str) -> Optional[MarkingScheme]:
        """Retrieve a cached marking scheme."""
        return self.marking_schemes.get(scheme_id)

    async def load_marking_scheme_to_rag(self, scheme_id: str) -> None:
        """
        Chunk the marking scheme rubric text and index it into the vector store.
        Skips if already indexed (idempotent via upsert).
        """
        scheme = self.marking_schemes.get(scheme_id)
        if not scheme:
            raise ValueError(f"Marking scheme {scheme_id} not found")

        chunks = []

        # Index each criterion separately for fine-grained retrieval
        for i, criterion in enumerate(scheme.criteria):
            rubric_text = criterion.get("rubric_text", "")
            if not rubric_text:
                # Build rubric text from criterion fields
                parts = [
                    f"Criterion: {criterion.get('name', '')}",
                    f"Description: {criterion.get('description', '')}",
                    f"Max Score: {criterion.get('max_score', 0)}"
                ]
                rubric_text = "\n".join(parts)

            chunk = RubricChunk(
                id=f"{scheme_id}_criterion_{i}",
                content=rubric_text,
                source_type="rubric",
                source_id=scheme_id,
                associated_rubrics=[scheme_id],
                metadata={
                    "criterion_id": criterion.get("id", ""),
                    "criterion_name": criterion.get("name", ""),
                    "scheme_id": scheme_id
                }
            )
            chunks.append(chunk)

        # Also index the full rubric text as a single chunk for broad context
        if hasattr(scheme, 'rubric_text') and scheme.rubric_text:
            chunks.append(RubricChunk(
                id=f"{scheme_id}_full",
                content=scheme.rubric_text,
                source_type="rubric",
                source_id=scheme_id,
                associated_rubrics=[scheme_id],
                metadata={"scheme_id": scheme_id, "chunk_type": "full"}
            ))

        await self.vector_store.add_documents(chunks)
        logger.info(f"Indexed {len(chunks)} chunks for marking scheme {scheme_id}")

    async def add_lecture_note_to_rag(
        self,
        note_content: str,
        note_id: str,
        rubric_ids: List[str]
    ) -> None:
        """Chunk and index lecture note content into the vector store."""
        chunks = []

        # Split into paragraphs, fall back to sentence groups
        paragraphs = [p.strip() for p in note_content.split('\n\n') if p.strip()]
        if len(paragraphs) <= 1:
            sentences = note_content.split('. ')
            paragraphs = [
                '. '.join(sentences[i:i + 3]).strip()
                for i in range(0, len(sentences), 3)
                if sentences[i:i + 3]
            ]

        for i, paragraph in enumerate(paragraphs):
            if not paragraph:
                continue
            chunk = RubricChunk(
                id=f"{note_id}_chunk_{i}",
                content=paragraph,
                source_type="lecture_note",
                source_id=note_id,
                associated_rubrics=rubric_ids,
                metadata={
                    "lecture_note_id": note_id,
                    "chunk_index": i,
                    "content_type": "lecture_note"
                }
            )
            chunks.append(chunk)

        await self.vector_store.add_documents(chunks)
        logger.info(
            f"Indexed {len(chunks)} lecture note chunks for note {note_id} "
            f"associated with rubrics: {rubric_ids}"
        )

    async def remove_lecture_note_from_rag(self, note_id: str) -> None:
        """Remove all lecture note chunks from the vector store."""
        await self.vector_store.remove_documents_by_source(note_id, "lecture_note")
        logger.info(f"Removed lecture note {note_id} from vector store")

    async def grade_essay_by_criterion(
        self,
        essay: str,
        criterion_id: str,
        marking_scheme_id: str
    ) -> GradingCriterion:
        """Grade an essay for a single criterion using real vector search + Azure OpenAI."""
        scheme = self.marking_schemes.get(marking_scheme_id)
        if not scheme:
            raise ValueError(f"Marking scheme {marking_scheme_id} not found")

        # Find criterion info
        criterion_info = next(
            (c for c in scheme.criteria if c.get("id") == criterion_id),
            None
        )
        if not criterion_info:
            raise ValueError(f"Criterion {criterion_id} not found in marking scheme")

        # Retrieve relevant context from vector store
        context_chunks = await self.vector_store.similarity_search_with_rubric_context(
            query=f"How to grade: {criterion_info.get('name', '')}",
            rubric_id=marking_scheme_id,
            k=5
        )

        # Separate rubric and lecture note context
        rubric_parts = [c.content for c in context_chunks if c.source_type == "rubric"]
        lecture_parts = [c.content for c in context_chunks if c.source_type == "lecture_note"]

        rubric_context = "\n\n".join(rubric_parts)
        lecture_context = "\n\n".join(lecture_parts) if lecture_parts else None

        # Grade using Azure OpenAI
        result = await self.ai_client.grade_essay(
            essay=essay,
            context=rubric_context,
            criterion_name=criterion_info.get("name", ""),
            criterion_id=criterion_id,
            max_score=criterion_info.get("max_score", 10),
            lecture_notes_context=lecture_context
        )

        return result

    async def grade_essay_all_criteria(
        self,
        request: EssayGradingRequest
    ) -> EssayGradingResponse:
        """
        Grade an essay against all criteria in the marking scheme.
        Makes one AI call per question (grading all criteria for that question together),
        rather than one call per criterion — reducing API costs significantly.
        """
        scheme = self.marking_schemes.get(request.marking_scheme_id)
        if not scheme:
            raise ValueError(f"Marking scheme {request.marking_scheme_id} not found")

        answer_text = ''
        # Per-question answers: { question_id: answer_text }
        question_answers = getattr(request, 'question_answers', None) or {}

        criteria_to_grade = scheme.criteria
        logger.info(f"grade_essay_all_criteria: scheme={request.marking_scheme_id} criteria_count={len(criteria_to_grade)} names={[c.get('name','?') for c in criteria_to_grade]}")
        if getattr(request, 'criteria_ids', None):
            criteria_to_grade = [
                c for c in scheme.criteria
                if c.get("id") in request.criteria_ids
            ]

        # Group criteria by question_id so we can grade all criteria per question in one call
        from collections import OrderedDict
        question_groups: OrderedDict = OrderedDict()
        for criterion in criteria_to_grade:
            q_id = criterion.get('question_id', criterion['id'])
            if q_id not in question_groups:
                question_groups[q_id] = []
            question_groups[q_id].append(criterion)

        # Build a positional fallback: if question_answers keys don't match rubric question_ids,
        # try matching by position (q1→index 0, q2→index 1, or just by list order)
        positional_answers = list(question_answers.values())

        results = []
        total_score = 0.0
        max_total_score = 0.0

        for q_idx, (q_id, q_criteria) in enumerate(question_groups.items()):
            # Try exact match first, then positional fallback
            essay_for_question = question_answers.get(q_id)
            if not essay_for_question and positional_answers:
                essay_for_question = positional_answers[q_idx] if q_idx < len(positional_answers) else ''
            essay_for_question = essay_for_question or ''
            # Retrieve context once per question (covers all criteria)
            context_chunks = await self.vector_store.similarity_search_with_rubric_context(
                query=f"How to grade: {q_criteria[0].get('question_title', '')}",
                rubric_id=request.marking_scheme_id,
                k=8
            )
            rubric_parts = [c.content for c in context_chunks if c.source_type == "rubric"]
            lecture_parts = [c.content for c in context_chunks if c.source_type == "lecture_note"]
            rubric_context = "\n\n".join(rubric_parts)
            lecture_context = "\n\n".join(lecture_parts) if lecture_parts else None

            if len(q_criteria) == 1:
                # Single criterion — use the existing single-criterion call
                c = q_criteria[0]
                result = await self.ai_client.grade_essay(
                    essay=essay_for_question,
                    context=rubric_context,
                    criterion_name=c.get("name", ""),
                    criterion_id=c["id"],
                    max_score=c.get("max_score", 10),
                    lecture_notes_context=lecture_context
                )
                result.context_metadata = result.context_metadata or {}
                result.context_metadata['question_id'] = q_id
                result.context_metadata['question_title'] = c.get('question_title', c.get('name', ''))
                result.context_metadata['question_label'] = c.get('question_label', '')
                result.context_metadata['answer_text'] = essay_for_question
                results.append(result)
                total_score += result.score
                max_total_score += result.max_score
            else:
                # Multiple criteria — one call grades all of them together
                criterion_results = await self.ai_client.grade_essay_multi_criteria(
                    essay=essay_for_question,
                    context=rubric_context,
                    criteria=q_criteria,
                    lecture_notes_context=lecture_context
                )
                for result in criterion_results:
                    result.context_metadata = result.context_metadata or {}
                    result.context_metadata['question_id'] = q_id
                    result.context_metadata['question_title'] = q_criteria[0].get('question_title', '')
                    result.context_metadata['question_label'] = q_criteria[0].get('question_label', '')
                    result.context_metadata['answer_text'] = essay_for_question
                    results.append(result)
                    total_score += result.score
                    max_total_score += result.max_score

        percentage = (total_score / max_total_score * 100) if max_total_score > 0 else 0
        if percentage >= 80:
            overall_feedback = "Excellent work overall with strong performance across all criteria."
        elif percentage >= 60:
            overall_feedback = "Good work with room for improvement in some areas."
        else:
            overall_feedback = "Needs significant improvement across multiple criteria."

        return EssayGradingResponse(
            student_id=request.student_id,
            results=results,
            total_score=total_score,
            max_total_score=max_total_score,
            overall_feedback=overall_feedback,
            processed_at=datetime.now()
        )

    async def populate_ai_suggested_scores(
        self,
        student_id: str,
        marking_scheme_id: str
    ) -> None:
        """Placeholder — implement if needed for batch score population."""
        logger.info(f"populate_ai_suggested_scores called for student {student_id}")
