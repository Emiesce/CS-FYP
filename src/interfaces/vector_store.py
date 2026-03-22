"""
Vector store interface for RAG essay grading system.
Defines the contract for vector storage and similarity search operations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
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
    async def similarity_search(self, query: str, k: int = 3, source_type: Optional[str] = None, rubric_id: Optional[str] = None) -> List[RubricChunk]:
        """
        Perform similarity search to find relevant chunks.
        
        Args:
            query: Search query text
            k: Number of similar chunks to return
            source_type: Filter by source type ('rubric' or 'lecture_note')
            rubric_id: Filter by associated rubric ID
            
        Returns:
            List of most similar RubricChunk objects
            
        Raises:
            VectorStoreError: If search operation fails
        """
        pass
    
    @abstractmethod
    async def similarity_search_with_rubric_context(self, query: str, rubric_id: str, k: int = 3) -> List[RubricChunk]:
        """
        Perform similarity search including both rubric and associated lecture notes.
        
        Args:
            query: Search query text
            rubric_id: Rubric ID to include associated lecture notes
            k: Number of similar chunks to return
            
        Returns:
            List of most similar RubricChunk objects from both rubric and lecture notes
            
        Raises:
            VectorStoreError: If search operation fails
        """
        pass
    
    @abstractmethod
    async def remove_documents_by_source(self, source_id: str, source_type: str) -> None:
        """
        Remove all documents from a specific source.
        
        Args:
            source_id: ID of the source document
            source_type: Type of source ('rubric' or 'lecture_note')
            
        Raises:
            VectorStoreError: If removal operation fails
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
    
    @abstractmethod
    async def get_document_count_by_source_type(self, source_type: str) -> int:
        """
        Get the number of documents by source type.
        
        Args:
            source_type: Source type to count ('rubric' or 'lecture_note')
            
        Returns:
            Number of documents of the specified source type
        """
        pass