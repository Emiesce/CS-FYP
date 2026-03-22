"""
Mock implementations for testing and development.
Provides simple in-memory implementations of all interfaces.
"""

import asyncio
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

from ..models.grading_models import (
    GradingCriterion,
    RubricChunk,
    MarkingScheme,
    EssayGradingRequest,
    EssayGradingResponse
)
from ..interfaces.vector_store import VectorStore
from ..interfaces.ai_client import AIClient
from ..interfaces.grading_service import GradingService
from ..config.settings import DEFAULT_TEST_CRITERIA


class MockVectorStore(VectorStore):
    """Mock implementation of VectorStore for testing."""
    
    def __init__(self):
        self.documents: List[RubricChunk] = []
    
    async def add_documents(self, chunks: List[RubricChunk]) -> None:
        """Add documents to in-memory storage."""
        self.documents.extend(chunks)
    
    async def similarity_search(self, query: str, k: int = 3, source_type: Optional[str] = None, rubric_id: Optional[str] = None) -> List[RubricChunk]:
        """Return mock similar documents based on simple text matching with filtering."""
        # Filter documents based on criteria
        filtered_docs = self.documents
        
        if source_type:
            filtered_docs = [doc for doc in filtered_docs if doc.source_type == source_type]
        
        if rubric_id:
            filtered_docs = [doc for doc in filtered_docs if rubric_id in doc.associated_rubrics]
        
        # Simple mock: return documents that contain query terms
        query_terms = query.lower().split()
        scored_docs = []
        
        for doc in filtered_docs:
            score = sum(1 for term in query_terms if term in doc.content.lower())
            if score > 0:
                scored_docs.append((score, doc))
        
        # Sort by score and return top k
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scored_docs[:k]]
    
    async def similarity_search_with_rubric_context(self, query: str, rubric_id: str, k: int = 3) -> List[RubricChunk]:
        """Perform similarity search including both rubric and associated lecture notes."""
        # Get documents that are either:
        # 1. Rubric chunks from the specified rubric
        # 2. Lecture note chunks associated with the rubric
        relevant_docs = []
        
        for doc in self.documents:
            if (doc.source_type == "rubric" and rubric_id in doc.associated_rubrics) or \
               (doc.source_type == "lecture_note" and rubric_id in doc.associated_rubrics):
                relevant_docs.append(doc)
        
        # Simple mock: return documents that contain query terms
        query_terms = query.lower().split()
        scored_docs = []
        
        for doc in relevant_docs:
            score = sum(1 for term in query_terms if term in doc.content.lower())
            # Boost score for rubric content slightly
            if doc.source_type == "rubric":
                score *= 1.1
            if score > 0:
                scored_docs.append((score, doc))
        
        # Sort by score and return top k
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scored_docs[:k]]
    
    async def remove_documents_by_source(self, source_id: str, source_type: str) -> None:
        """Remove all documents from a specific source."""
        self.documents = [
            doc for doc in self.documents 
            if not (doc.source_id == source_id and doc.source_type == source_type)
        ]
    
    async def clear(self) -> None:
        """Clear all documents."""
        self.documents.clear()
    
    async def get_document_count(self) -> int:
        """Get document count."""
        return len(self.documents)
    
    async def get_document_count_by_source_type(self, source_type: str) -> int:
        """Get the number of documents by source type."""
        return len([doc for doc in self.documents if doc.source_type == source_type])


class MockAIClient(AIClient):
    """Mock implementation of AIClient for testing."""
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate mock embedding vector."""
        # Simple mock: hash-based pseudo-embedding
        import hashlib
        hash_obj = hashlib.md5(text.encode())
        hash_hex = hash_obj.hexdigest()
        
        # Convert hex to float values (mock 768-dimensional embedding)
        embedding = []
        for i in range(0, min(len(hash_hex), 32), 2):
            val = int(hash_hex[i:i+2], 16) / 255.0  # Normalize to 0-1
            embedding.extend([val] * 24)  # Repeat to get 768 dimensions
        
        # Pad or truncate to exactly 768 dimensions
        while len(embedding) < 768:
            embedding.append(0.0)
        return embedding[:768]
    
    async def grade_essay(
        self,
        essay: str,
        context: str,
        criterion_name: str,
        criterion_id: str,
        max_score: float,
        lecture_notes_context: Optional[str] = None
    ) -> GradingCriterion:
        """Generate mock grading result with enhanced context awareness."""
        # Simple mock grading logic based on essay length and content
        essay_length = len(essay.split())
        
        # Check if context includes lecture notes for enhanced feedback
        has_lecture_notes = lecture_notes_context is not None and len(lecture_notes_context.strip()) > 0
        has_rubric_criteria = "RUBRIC CRITERIA:" in context or len(context.strip()) > 0
        
        # Mock scoring based on essay characteristics and available context
        base_score = 0
        if essay_length < 50:
            base_score = max(1.0, max_score / 4)
            level = "Needs Improvement"
            justification = f"The answer is quite brief ({essay_length} words) and lacks sufficient development for the {criterion_name} criterion."
        elif essay_length < 150:
            base_score = max_score / 2
            level = "Good"
            justification = f"The answer shows adequate development ({essay_length} words) with some good points for {criterion_name}."
        else:
            base_score = max_score * 0.8
            level = "Excellent"
            justification = f"The answer demonstrates strong development ({essay_length} words) with clear evidence of {criterion_name}."
        
        # Track lecture notes references
        lecture_notes_refs = []
        context_metadata = {
            "has_rubric_context": has_rubric_criteria,
            "has_lecture_notes": has_lecture_notes,
            "context_chunks_used": 0
        }
        
        # Enhance scoring if lecture notes are available
        if has_lecture_notes:
            base_score = min(max_score, base_score * 1.1)  # Slight boost for having lecture context
            context_metadata["context_chunks_used"] = len(lecture_notes_context.split('\n\n'))
            
            if "lecture" in essay.lower() or "course" in essay.lower():
                justification += " The answer effectively references course concepts from the lecture materials."
                lecture_notes_refs.append("Referenced course concepts from lecture materials")
            else:
                justification += " Consider incorporating more specific concepts from the lecture materials to strengthen your argument."
        
        # Mock improvement suggestion with lecture notes awareness
        suggestions = {
            "Argument & Thesis": "Consider developing a more specific and arguable thesis statement.",
            "Use of Evidence": "Include more specific examples and analyze how they support your argument.",
            "Structure & Clarity": "Work on smoother transitions between paragraphs and clearer topic sentences."
        }
        
        base_suggestion = suggestions.get(criterion_name, "Continue developing your writing skills in this area.")
        
        if has_lecture_notes:
            base_suggestion += " Reference specific concepts from the lecture materials to demonstrate deeper understanding."
            lecture_notes_refs.append("Lecture materials available for reference")
        
        # Mock highlighted text (first sentence)
        highlighted_text = essay.split('.')[0] + '.' if '.' in essay else essay[:100]
        
        return GradingCriterion(
            criterion_id=criterion_id,
            criterion_name=criterion_name,
            matched_level=level,
            score=base_score,
            max_score=max_score,
            justification=justification,
            suggestion_for_improvement=base_suggestion,
            highlighted_text=highlighted_text,
            lecture_notes_references=lecture_notes_refs if lecture_notes_refs else None,
            context_metadata=context_metadata
        )
    
    async def validate_connection(self) -> bool:
        """Mock connection validation."""
        await asyncio.sleep(0.1)  # Simulate network delay
        return True
    
    async def get_model_info(self) -> dict:
        """Return mock model information."""
        return {
            "model_name": "mock-gemini-1.5-flash",
            "embedding_model": "mock-embedding-001",
            "version": "1.0.0-mock",
            "capabilities": ["text_generation", "embeddings"]
        }


class MockGradingService(GradingService):
    """Mock implementation of GradingService for testing."""
    
    def __init__(self, vector_store: VectorStore, ai_client: AIClient):
        self.vector_store = vector_store
        self.ai_client = ai_client
        self.marking_schemes: Dict[str, MarkingScheme] = {}
    
    async def create_marking_scheme(self, request: dict) -> MarkingScheme:
        """Create a mock marking scheme."""
        scheme_id = str(uuid.uuid4())
        
        marking_scheme = MarkingScheme(
            id=scheme_id,
            question_id=request["question_id"],
            criteria=request.get("criteria", DEFAULT_TEST_CRITERIA),
            rubric_text=request["rubric_text"],
            created_by=request["created_by"],
            created_at=datetime.now()
        )
        
        self.marking_schemes[scheme_id] = marking_scheme
        return marking_scheme
    
    async def get_marking_scheme(self, scheme_id: str) -> Optional[MarkingScheme]:
        """Retrieve a marking scheme."""
        return self.marking_schemes.get(scheme_id)
    
    async def load_marking_scheme_to_rag(self, scheme_id: str) -> None:
        """Load marking scheme into vector store."""
        scheme = self.marking_schemes.get(scheme_id)
        if not scheme:
            raise ValueError(f"Marking scheme {scheme_id} not found")
        
        # Split rubric text into chunks
        rubric_text = scheme.rubric_text
        chunks = []
        
        # Simple chunking by paragraphs
        paragraphs = rubric_text.split('\n\n')
        for i, paragraph in enumerate(paragraphs):
            if paragraph.strip():
                chunk = RubricChunk(
                    id=f"{scheme_id}_chunk_{i}",
                    content=paragraph.strip(),
                    metadata={
                        "marking_scheme_id": scheme_id,
                        "chunk_index": i
                    },
                    source_type="rubric",
                    source_id=scheme_id,
                    associated_rubrics=[scheme_id]
                )
                chunks.append(chunk)
        
        await self.vector_store.add_documents(chunks)
    
    async def add_lecture_note_to_rag(self, note_content: str, note_id: str, rubric_ids: List[str]) -> None:
        """Add lecture note content to vector store with rubric associations."""
        # Split lecture note content into chunks
        chunks = []
        
        # Simple chunking by paragraphs or sentences for lecture notes
        paragraphs = note_content.split('\n\n')
        if len(paragraphs) == 1:
            # If no paragraph breaks, split by sentences
            sentences = note_content.split('. ')
            paragraphs = ['. '.join(sentences[i:i+3]) for i in range(0, len(sentences), 3)]
        
        for i, paragraph in enumerate(paragraphs):
            if paragraph.strip():
                chunk = RubricChunk(
                    id=f"{note_id}_chunk_{i}",
                    content=paragraph.strip(),
                    metadata={
                        "lecture_note_id": note_id,
                        "chunk_index": i,
                        "content_type": "lecture_note"
                    },
                    source_type="lecture_note",
                    source_id=note_id,
                    associated_rubrics=rubric_ids
                )
                chunks.append(chunk)
        
        await self.vector_store.add_documents(chunks)
    
    async def remove_lecture_note_from_rag(self, note_id: str) -> None:
        """Remove lecture note content from vector store."""
        await self.vector_store.remove_documents_by_source(note_id, "lecture_note")
    
    async def grade_essay_by_criterion(
        self,
        essay: str,
        criterion_id: str,
        marking_scheme_id: str
    ) -> GradingCriterion:
        """Grade essay for a single criterion with lecture notes context."""
        scheme = self.marking_schemes.get(marking_scheme_id)
        if not scheme:
            raise ValueError(f"Marking scheme {marking_scheme_id} not found")
        
        # Find criterion info
        criterion_info = None
        for criterion in scheme.criteria:
            if criterion.get("id") == criterion_id:
                criterion_info = criterion
                break
        
        if not criterion_info:
            raise ValueError(f"Criterion {criterion_id} not found in marking scheme")
        
        # Get relevant context from vector store including lecture notes
        context_chunks = await self.vector_store.similarity_search_with_rubric_context(
            f"How to grade {criterion_info['name']}", marking_scheme_id, k=5
        )
        
        # Separate rubric and lecture note context for better prompt construction
        rubric_context = []
        lecture_notes_context = []
        
        for chunk in context_chunks:
            if chunk.source_type == "rubric":
                rubric_context.append(chunk.content)
            elif chunk.source_type == "lecture_note":
                lecture_notes_context.append(chunk.content)
        
        # Construct context strings
        rubric_context_str = "\n\n".join(rubric_context) if rubric_context else ""
        lecture_notes_context_str = "\n\n".join(lecture_notes_context) if lecture_notes_context else None
        
        # Grade using AI client with enhanced context
        result = await self.ai_client.grade_essay(
            essay=essay,
            context=rubric_context_str,
            criterion_name=criterion_info["name"],
            criterion_id=criterion_id,
            max_score=criterion_info["max_score"],
            lecture_notes_context=lecture_notes_context_str
        )
        
        return result
    
    async def grade_essay_all_criteria(
        self,
        request: EssayGradingRequest
    ) -> EssayGradingResponse:
        """Grade essay for all criteria."""
        scheme = self.marking_schemes.get(request.marking_scheme_id)
        if not scheme:
            raise ValueError(f"Marking scheme {request.marking_scheme_id} not found")
        
        results = []
        total_score = 0
        max_total_score = 0
        
        # Determine which criteria to grade
        criteria_to_grade = scheme.criteria
        if request.criteria_ids:
            criteria_to_grade = [
                c for c in scheme.criteria 
                if c.get("id") in request.criteria_ids
            ]
        
        # Get the answer text (support both 'answer' and legacy 'essay_text' field)
        answer_text = getattr(request, 'answer', None) or getattr(request, 'essay_text', '')
        
        # Grade each criterion
        for criterion in criteria_to_grade:
            result = await self.grade_essay_by_criterion(
                essay=answer_text,
                criterion_id=criterion["id"],
                marking_scheme_id=request.marking_scheme_id
            )
            
            results.append(result)
            total_score += result.score
            max_total_score += result.max_score
        
        # Generate overall feedback
        percentage = (total_score / max_total_score * 100) if max_total_score > 0 else 0
        if percentage >= 80:
            overall_feedback = "Excellent work overall with strong performance across criteria."
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
        """Mock implementation of score population."""
        # This would integrate with existing API to populate scores
        # For now, just simulate the operation
        await asyncio.sleep(0.5)  # Simulate processing time