"""
Grading service interface for RAG essay grading system.
Defines the contract for the main grading orchestration service.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from ..models.grading_models import (
    MarkingScheme, 
    EssayGradingRequest, 
    EssayGradingResponse,
    GradingCriterion
)


class GradingService(ABC):
    """Abstract interface for the main grading orchestration service."""
    
    @abstractmethod
    async def create_marking_scheme(self, request: dict) -> MarkingScheme:
        """
        Create a new marking scheme from the provided request.
        
        Args:
            request: Dictionary containing marking scheme creation data
            
        Returns:
            Created MarkingScheme object
            
        Raises:
            ValidationError: If request data is invalid
            IntegrationError: If creation fails
        """
        pass
    
    @abstractmethod
    async def get_marking_scheme(self, scheme_id: str) -> Optional[MarkingScheme]:
        """
        Retrieve a marking scheme by its ID.
        
        Args:
            scheme_id: Unique identifier for the marking scheme
            
        Returns:
            MarkingScheme object if found, None otherwise
        """
        pass
    
    @abstractmethod
    async def load_marking_scheme_to_rag(self, scheme_id: str) -> None:
        """
        Load a marking scheme into the RAG vector store for grading.
        
        Args:
            scheme_id: ID of the marking scheme to load
            
        Raises:
            VectorStoreError: If loading to vector store fails
            ValidationError: If marking scheme is invalid
        """
        pass
    
    @abstractmethod
    async def grade_essay_by_criterion(
        self, 
        essay: str, 
        criterion_id: str,
        marking_scheme_id: str
    ) -> GradingCriterion:
        """
        Grade an essay for a specific criterion.
        
        Args:
            essay: The student's essay text
            criterion_id: ID of the criterion to evaluate
            marking_scheme_id: ID of the marking scheme to use
            
        Returns:
            GradingCriterion object with evaluation results
            
        Raises:
            AIServiceError: If AI grading fails
            VectorStoreError: If context retrieval fails
        """
        pass
    
    @abstractmethod
    async def grade_essay_all_criteria(
        self, 
        request: EssayGradingRequest
    ) -> EssayGradingResponse:
        """
        Grade an essay against all criteria in the marking scheme.
        
        Args:
            request: EssayGradingRequest containing essay and grading parameters
            
        Returns:
            EssayGradingResponse with complete grading results
            
        Raises:
            AIServiceError: If AI grading fails
            VectorStoreError: If context retrieval fails
        """
        pass
    
    @abstractmethod
    async def populate_ai_suggested_scores(
        self, 
        student_id: str, 
        marking_scheme_id: str
    ) -> None:
        """
        Populate AI suggested scores for existing rubric criteria.
        
        Args:
            student_id: ID of the student whose work to grade
            marking_scheme_id: ID of the marking scheme to use
            
        Raises:
            IntegrationError: If score population fails
        """
        pass