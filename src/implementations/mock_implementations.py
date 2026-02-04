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
    
    async def similarity_search(self, query: str, k: int = 3) -> List[RubricChunk]:
        """Return mock similar documents based on simple text matching."""
        # Simple mock: return documents that contain query terms
        query_terms = query.lower().split()
        scored_docs = []
        
        for doc in self.documents:
            score = sum(1 for term in query_terms if term in doc.content.lower())
            if score > 0:
                scored_docs.append((score, doc))
        
        # Sort by score and return top k
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scored_docs[:k]]
    
    async def clear(self) -> None:
        """Clear all documents."""
        self.documents.clear()
    
    async def get_document_count(self) -> int:
        """Get document count."""
        return len(self.documents)


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
        max_score: float
    ) -> GradingCriterion:
        """Generate mock grading result."""
        # Simple mock grading logic based on essay length and content
        essay_length = len(essay.split())
        
        # Mock scoring based on essay characteristics
        if essay_length < 50:
            score = max(1.0, max_score / 4)
            level = "Needs Improvement"
            justification = f"The essay is quite brief ({essay_length} words) and lacks sufficient development for the {criterion_name} criterion."
        elif essay_length < 150:
            score = max_score / 2
            level = "Good"
            justification = f"The essay shows adequate development ({essay_length} words) with some good points for {criterion_name}."
        else:
            score = max_score * 0.8
            level = "Excellent"
            justification = f"The essay demonstrates strong development ({essay_length} words) with clear evidence of {criterion_name}."
        
        # Mock improvement suggestion
        suggestions = {
            "Argument & Thesis": "Consider developing a more specific and arguable thesis statement.",
            "Use of Evidence": "Include more specific examples and analyze how they support your argument.",
            "Structure & Clarity": "Work on smoother transitions between paragraphs and clearer topic sentences."
        }
        
        suggestion = suggestions.get(criterion_name, "Continue developing your writing skills in this area.")
        
        # Mock highlighted text (first sentence)
        highlighted_text = essay.split('.')[0] + '.' if '.' in essay else essay[:100]
        
        return GradingCriterion(
            criterion_id=criterion_id,
            criterion_name=criterion_name,
            matched_level=level,
            score=score,
            max_score=max_score,
            justification=justification,
            suggestion_for_improvement=suggestion,
            highlighted_text=highlighted_text
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
                    }
                )
                chunks.append(chunk)
        
        await self.vector_store.add_documents(chunks)
    
    async def grade_essay_by_criterion(
        self,
        essay: str,
        criterion_id: str,
        marking_scheme_id: str
    ) -> GradingCriterion:
        """Grade essay for a single criterion."""
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
        
        # Get relevant context from vector store
        context_chunks = await self.vector_store.similarity_search(
            f"How to grade {criterion_info['name']}", k=3
        )
        context = "\n".join([chunk.content for chunk in context_chunks])
        
        # Grade using AI client
        result = await self.ai_client.grade_essay(
            essay=essay,
            context=context,
            criterion_name=criterion_info["name"],
            criterion_id=criterion_id,
            max_score=criterion_info["max_score"]
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
        
        # Grade each criterion
        for criterion in criteria_to_grade:
            result = await self.grade_essay_by_criterion(
                essay=request.essay_text,
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