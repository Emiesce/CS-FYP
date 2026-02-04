"""
AI client interface for RAG essay grading system.
Defines the contract for AI service interactions including embeddings and grading.
"""

from abc import ABC, abstractmethod
from typing import List
from ..models.grading_models import GradingCriterion


class AIClient(ABC):
    """Abstract interface for AI service operations."""
    
    @abstractmethod
    async def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding vector for the given text.
        
        Args:
            text: Input text to embed
            
        Returns:
            List of float values representing the embedding vector
            
        Raises:
            AIServiceError: If embedding generation fails
        """
        pass
    
    @abstractmethod
    async def grade_essay(
        self, 
        essay: str, 
        context: str, 
        criterion_name: str, 
        criterion_id: str,
        max_score: float
    ) -> GradingCriterion:
        """
        Grade an essay for a specific criterion using provided context.
        
        Args:
            essay: The student's essay text
            context: Relevant rubric context from vector search
            criterion_name: Name of the criterion being evaluated
            criterion_id: Unique identifier for the criterion
            max_score: Maximum possible score for this criterion
            
        Returns:
            GradingCriterion object with evaluation results
            
        Raises:
            AIServiceError: If grading operation fails
        """
        pass
    
    @abstractmethod
    async def validate_connection(self) -> bool:
        """
        Validate that the AI service is accessible and responding.
        
        Returns:
            True if connection is valid, False otherwise
        """
        pass
    
    @abstractmethod
    async def get_model_info(self) -> dict:
        """
        Get information about the AI model being used.
        
        Returns:
            Dictionary containing model information
        """
        pass