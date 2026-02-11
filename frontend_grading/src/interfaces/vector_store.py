"""
Vector store interface for RAG essay grading system.
Defines the contract for vector storage and similarity search operations.
"""

from abc import ABC, abstractmethod
from typing import List
from ..models.grading_models import RubricChunk


class VectorStore(ABC):
    """Abstract interface for vector storage and similarity search operations."""
    
    @abstractmethod
    async def add_documents(self, chunks: List[RubricChunk]) -> None:
        """
        Add document chunks to the vector store.
        
        Args:
            chunks: List of RubricChunk objects to store
            
        Raises:
            VectorStoreError: If storage operation fails
        """
        pass
    
    @abstractmethod
    async def similarity_search(self, query: str, k: int = 3) -> List[RubricChunk]:
        """
        Perform similarity search to find relevant chunks.
        
        Args:
            query: Search query text
            k: Number of similar chunks to return
            
        Returns:
            List of most similar RubricChunk objects
            
        Raises:
            VectorStoreError: If search operation fails
        """
        pass
    
    @abstractmethod
    async def clear(self) -> None:
        """
        Clear all documents from the vector store.
        
        Raises:
            VectorStoreError: If clear operation fails
        """
        pass
    
    @abstractmethod
    async def get_document_count(self) -> int:
        """
        Get the total number of documents in the store.
        
        Returns:
            Number of documents currently stored
        """
        pass