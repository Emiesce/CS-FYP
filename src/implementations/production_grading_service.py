"""
Production GradingService implementation.
Uses real VectorStore and AIClient — no mock logic.
"""

import re
import uuid
import logging
from typing import List, Dict, Any, Optional, Tuple
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


def _get_model_answer_from_criterion(c: dict) -> str:
    """Extract model answer — prefer the direct field, fall back to parsing rubric_text."""
    direct = c.get('model_answer', '').strip()
    if direct:
        return direct
    for line in c.get('rubric_text', '').splitlines():
        if line.startswith('Model Answer:'):
            return line[len('Model Answer:'):].strip()
    return ''


def _parse_keyed_answers(text: str) -> Dict[str, str]:
    """
    Parse structured answer strings like "(a)F, (b)T, (c)F" or "a: F, b: T"
    into a dict { "a": "F", "b": "T", ... }.
    Returns empty dict if the text doesn't look like a keyed answer list.
    """
    # Match patterns like (a)F, (a)T, (b)F — value is T/F/Y/N/A-E/0/1 (case insensitive)
    matches = re.findall(r'\(([a-zA-Z0-9]+)\)\s*([TFYNABCDEtfynabcde01])', text)
    if not matches:
        # fallback: key: value or key=value format
        matches = re.findall(r'([a-zA-Z0-9]+)\s*[:=]\s*([TFYNABCDEtfynabcde01])', text)
    if not matches:
        return {}
    return {k.lower(): v.upper() for k, v in matches}


def _should_exact_match(c: dict) -> bool:
    """Return True if this criterion should be scored without GPT."""
    q_type = c.get('question_type', 'essay').lower()
    if q_type in ('exact_match', 'true_false', 'multiple_choice', 'mc'):
        return True
    # Auto-detect: model answer must look like a compact keyed list (≥3 matches, short text)
    # This avoids false positives on code answers that happen to contain (x)y patterns
    model_ans = _get_model_answer_from_criterion(c)
    if model_ans:
        parsed = _parse_keyed_answers(model_ans)
        # Only auto-detect if we get ≥3 keyed answers AND the answer is short (not code)
        if len(parsed) >= 3 and len(model_ans) < 200:
            return True
    return False


def _exact_match_score(
    student_text: str,
    model_answer: str,
    max_score: float
) -> Optional[Tuple[float, str]]:
    """
    If both student answer and model answer look like keyed answer lists,
    compute the score mechanically and return (score, comparison_summary).
    Returns None if the format isn't parseable.
    """
    student_map = _parse_keyed_answers(student_text)
    model_map = _parse_keyed_answers(model_answer)

    logger.info(f"[EXACT_MATCH_SCORE] student_map={student_map} model_map={model_map}")

    if not student_map or not model_map:
        return None

    # Only proceed if they share the same keys
    common_keys = sorted(set(model_map.keys()) & set(student_map.keys()))
    if len(common_keys) < len(model_map) * 0.5:
        return None  # too few matching keys, not a reliable comparison

    correct = [k for k in common_keys if student_map.get(k) == model_map.get(k)]
    wrong = [k for k in common_keys if student_map.get(k) != model_map.get(k)]
    total = len(model_map)
    score = round((len(correct) / total) * max_score * 2) / 2  # 0.5 increments

    lines = [f"Exact-match comparison ({len(correct)}/{total} correct):"]
    for k in sorted(model_map.keys()):
        s = student_map.get(k, '?')
        m = model_map[k]
        mark = '✓' if s == m else '✗'
        lines.append(f"  ({k}) student={s} model={m} {mark}")
    summary = "\n".join(lines)

    return score, summary


def _parse_positional_sequence(text: str) -> Optional[list]:
    """
    Parse a comma-separated sequence like "0, 2, 5, 6, 5, 12, 8, /"
    Returns a list of stripped tokens, or None if it doesn't look like a sequence.
    """
    # Strip trailing punctuation
    text = text.strip().rstrip('.')
    # Must have at least 2 comma-separated tokens
    parts = [p.strip() for p in text.split(',')]
    if len(parts) < 2:
        return None
    # Each token should be short (number, letter, symbol — not a sentence)
    if any(len(p) > 30 for p in parts):
        return None
    # At least half the tokens should be numeric or short symbols
    short_tokens = sum(1 for p in parts if len(p) <= 10)
    if short_tokens < len(parts) * 0.5:
        return None
    return parts


def _positional_sequence_score(
    student_text: str,
    model_answer: str,
    max_score: float
) -> Optional[Tuple[float, str]]:
    """
    Compare comma-separated sequences position by position.
    Returns (score, summary) or None if not applicable.
    """
    # Extract just the sequence part from student text (may have prefix like "answer: 0, 2, ...")
    student_seq = None
    for candidate in [student_text, student_text.split(':')[-1].strip(), student_text.split('\n')[-1].strip()]:
        seq = _parse_positional_sequence(candidate)
        if seq and len(seq) >= 2:
            student_seq = seq
            break

    model_seq = _parse_positional_sequence(model_answer)

    logger.info(f"[POSITIONAL_SCORE] student_seq={student_seq} model_seq={model_seq}")

    if not student_seq or not model_seq:
        return None

    total = len(model_seq)
    # Align by position, pad student if shorter
    correct = 0
    lines = [f"Positional comparison ({total} positions):"]
    for i, m in enumerate(model_seq):
        s = student_seq[i] if i < len(student_seq) else '(missing)'
        match = s.strip().lower() == m.strip().lower()
        if match:
            correct += 1
        mark = '✓' if match else '✗'
        lines.append(f"  [{i+1}] student={s} model={m} {mark}")

    score = round((correct / total) * max_score * 2) / 2
    summary = "\n".join([f"Positional-match comparison ({correct}/{total} correct):"] + lines[1:])
    return score, summary


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
            logger.info(f"[QUESTION_GROUP] q_id={q_id} criteria_count={len(q_criteria)} names={[c.get('name','?') for c in q_criteria]}")
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
                c = q_criteria[0]
                model_ans = _get_model_answer_from_criterion(c)
                should_em = _should_exact_match(c)
                logger.info(f"[EXACT_MATCH_CHECK] criterion={c.get('name','')} question_type={c.get('question_type','?')} model_ans_present={bool(model_ans)} should_exact_match={should_em} model_ans_preview={model_ans[:50] if model_ans else 'NONE'}")
                pre_scored = _exact_match_score(essay_for_question, model_ans, c.get('max_score', 10)) if should_em and model_ans else None
                if pre_scored is None and should_em and model_ans:
                    pre_scored = _positional_sequence_score(essay_for_question, model_ans, c.get('max_score', 10))

                if pre_scored is not None:
                    computed_score, comparison_summary = pre_scored
                    logger.info(f"Exact-match pre-score for {c.get('name','')}: {computed_score}/{c.get('max_score',10)}")
                    result = GradingCriterion(
                        criterion_id=c['id'],
                        criterion_name=c.get('name', ''),
                        matched_level='',
                        score=computed_score,
                        max_score=c.get('max_score', 10),
                        justification=comparison_summary,
                        suggestion_for_improvement='Review the incorrect items against the model answer.',
                        highlighted_text=essay_for_question[:200],
                        context_metadata={"has_rubric_context": True, "exact_match_scored": True}
                    )
                else:
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
                result.context_metadata['question_type'] = c.get('question_type', 'essay')
                result.context_metadata['answer_text'] = essay_for_question
                results.append(result)
                total_score += result.score
                max_total_score += result.max_score
            else:
                # Multiple criteria — exact-match per criterion where applicable, GPT for the rest
                criterion_results = []
                needs_gpt = []
                for c in q_criteria:
                    model_ans = _get_model_answer_from_criterion(c)
                    should_em = _should_exact_match(c)
                    logger.info(f"[EXACT_MATCH_CHECK_MULTI] criterion={c.get('name','')} question_type={c.get('question_type','?')} model_ans_present={bool(model_ans)} should_exact_match={should_em}")
                    pre_scored = _exact_match_score(essay_for_question, model_ans, c.get('max_score', 10)) if should_em and model_ans else None
                    if pre_scored is None and should_em and model_ans:
                        pre_scored = _positional_sequence_score(essay_for_question, model_ans, c.get('max_score', 10))
                    if pre_scored is not None:
                        computed_score, comparison_summary = pre_scored
                        logger.info(f"Exact-match pre-score for {c.get('name','')}: {computed_score}/{c.get('max_score',10)}")
                        criterion_results.append(GradingCriterion(
                            criterion_id=c['id'],
                            criterion_name=c.get('name', ''),
                            matched_level='',
                            score=computed_score,
                            max_score=c.get('max_score', 10),
                            justification=comparison_summary,
                            suggestion_for_improvement='Review the incorrect items against the model answer.',
                            highlighted_text=essay_for_question[:200],
                            context_metadata={"has_rubric_context": True, "exact_match_scored": True}
                        ))
                    else:
                        needs_gpt.append((len(criterion_results), c))
                        criterion_results.append(None)

                if needs_gpt:
                    gpt_criteria = [c for _, c in needs_gpt]
                    gpt_results = await self.ai_client.grade_essay_multi_criteria(
                        essay=essay_for_question,
                        context=rubric_context,
                        criteria=gpt_criteria,
                        lecture_notes_context=lecture_context
                    )
                    for (idx, _), gpt_result in zip(needs_gpt, gpt_results):
                        criterion_results[idx] = gpt_result

                for result, c in zip(criterion_results, q_criteria):
                    if result is None:
                        continue
                    result.context_metadata = result.context_metadata or {}
                    result.context_metadata['question_id'] = q_id
                    result.context_metadata['question_title'] = q_criteria[0].get('question_title', '')
                    result.context_metadata['question_label'] = q_criteria[0].get('question_label', '')
                    result.context_metadata['question_type'] = c.get('question_type', 'essay')
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
