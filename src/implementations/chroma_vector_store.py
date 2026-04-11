"""
ChromaDB implementation of the VectorStore interface.
Provides persistent vector storage that survives server restarts.
"""

import logging
import uuid
from typing import List, Optional
from pathlib import Path

import chromadb
from chromadb.config import Settings
from chromadb import EmbeddingFunction, Embeddings

try:
    from ..interfaces.vector_store import VectorStore
    from ..models.grading_models import RubricChunk
    from ..interfaces.ai_client import AIClient
except ImportError:
    from interfaces.vector_store import VectorStore
    from models.grading_models import RubricChunk
    from interfaces.ai_client import AIClient

logger = logging.getLogger(__name__)

# Default persistent storage path
DEFAULT_CHROMA_PATH = Path(__file__).parent.parent.parent / "data" / "chroma_db"


class ChromaVectorStore(VectorStore):
    """
    Persistent vector store using ChromaDB.
    Data is stored on disk and survives server restarts.
    """

    def __init__(self, ai_client: AIClient, persist_directory: Optional[str] = None):
        """
        Initialize ChromaDB vector store.

        Args:
            ai_client: AI client used to generate embeddings
            persist_directory: Directory to persist ChromaDB data.
                               Defaults to data/chroma_db/
        """
        self.ai_client = ai_client
        self.persist_path = persist_directory or str(DEFAULT_CHROMA_PATH)

        # Ensure directory exists
        Path(self.persist_path).mkdir(parents=True, exist_ok=True)

        # Initialize persistent ChromaDB client
        self.client = chromadb.PersistentClient(
            path=self.persist_path,
            settings=Settings(anonymized_telemetry=False)
        )

        # Use a no-op embedding function — embeddings are generated externally via Azure
        class NoOpEmbeddingFunction(EmbeddingFunction):
            def __call__(self, input: list) -> Embeddings:
                raise NotImplementedError("Embeddings are provided externally")

        # Single collection for all documents (rubrics + lecture notes)
        self.collection = self.client.get_or_create_collection(
            name="grading_documents",
            embedding_function=NoOpEmbeddingFunction(),
            metadata={"hnsw:space": "cosine"}
        )

        logger.info(
            f"ChromaVectorStore initialized. "
            f"Persist path: {self.persist_path}. "
            f"Existing documents: {self.collection.count()}"
        )

    async def add_documents(self, chunks: List[RubricChunk]) -> None:
        """Add document chunks to ChromaDB with real embeddings."""
        if not chunks:
            return

        ids = []
        embeddings = []
        documents = []
        metadatas = []

        for chunk in chunks:
            # Generate embedding via AI client
            embedding = await self.ai_client.generate_embedding(chunk.content)

            ids.append(chunk.id)
            embeddings.append(embedding)
            documents.append(chunk.content)
            metadatas.append({
                "source_type": chunk.source_type,
                "source_id": chunk.source_id,
                "associated_rubrics": ",".join(chunk.associated_rubrics),
                **{k: str(v) for k, v in (chunk.metadata or {}).items()}
            })

        # Upsert to handle re-indexing gracefully
        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )

        logger.info(f"Added {len(chunks)} chunks to ChromaDB. Total: {self.collection.count()}")

    async def similarity_search(
        self,
        query: str,
        k: int = 3,
        source_type: Optional[str] = None,
        rubric_id: Optional[str] = None
    ) -> List[RubricChunk]:
        """Perform semantic similarity search using real embeddings."""
        if self.collection.count() == 0:
            return []

        # Generate query embedding
        query_embedding = await self.ai_client.generate_embedding(query)

        # Build where filter
        where = self._build_where_filter(source_type=source_type, rubric_id=rubric_id)

        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=min(k, self.collection.count()),
                where=where if where else None,
                include=["documents", "metadatas", "distances"]
            )
        except Exception as e:
            logger.error(f"ChromaDB query failed: {e}")
            return []

        return self._results_to_chunks(results)

    async def similarity_search_with_rubric_context(
        self,
        query: str,
        rubric_id: str,
        k: int = 3
    ) -> List[RubricChunk]:
        """Search across both rubric chunks and associated lecture notes."""
        if self.collection.count() == 0:
            return []

        query_embedding = await self.ai_client.generate_embedding(query)

        # Filter: documents associated with this rubric_id
        where = {"associated_rubrics": {"$contains": rubric_id}}

        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=min(k, self.collection.count()),
                where=where,
                include=["documents", "metadatas", "distances"]
            )
        except Exception as e:
            logger.warning(f"Rubric context search failed, falling back to unfiltered: {e}")
            return await self.similarity_search(query, k)

        return self._results_to_chunks(results)

    async def remove_documents_by_source(self, source_id: str, source_type: str) -> None:
        """Remove all documents from a specific source."""
        try:
            results = self.collection.get(
                where={"$and": [
                    {"source_id": {"$eq": source_id}},
                    {"source_type": {"$eq": source_type}}
                ]},
                include=[]
            )
            ids_to_delete = results.get("ids", [])

            if ids_to_delete:
                self.collection.delete(ids=ids_to_delete)
                logger.info(f"Removed {len(ids_to_delete)} chunks for {source_type} {source_id}")
        except Exception as e:
            logger.error(f"Failed to remove documents for {source_id}: {e}")

    async def clear(self) -> None:
        """Clear all documents from the collection."""
        try:
            self.client.delete_collection("grading_documents")
            self.collection = self.client.get_or_create_collection(
                name="grading_documents",
                metadata={"hnsw:space": "cosine"}
            )
            logger.info("ChromaDB collection cleared")
        except Exception as e:
            logger.error(f"Failed to clear ChromaDB: {e}")

    async def get_document_count(self) -> int:
        """Get total number of documents."""
        return self.collection.count()

    async def get_document_count_by_source_type(self, source_type: str) -> int:
        """Get number of documents by source type."""
        try:
            results = self.collection.get(
                where={"source_type": {"$eq": source_type}},
                include=[]
            )
            return len(results.get("ids", []))
        except Exception as e:
            logger.error(f"Failed to count documents by source type: {e}")
            return 0

    def _build_where_filter(
        self,
        source_type: Optional[str] = None,
        rubric_id: Optional[str] = None
    ) -> Optional[dict]:
        """Build ChromaDB where filter from optional parameters."""
        conditions = []

        if source_type:
            conditions.append({"source_type": {"$eq": source_type}})

        if rubric_id:
            conditions.append({"associated_rubrics": {"$contains": rubric_id}})

        if len(conditions) == 0:
            return None
        elif len(conditions) == 1:
            return conditions[0]
        else:
            return {"$and": conditions}

    def _results_to_chunks(self, results: dict) -> List[RubricChunk]:
        """Convert ChromaDB query results to RubricChunk objects."""
        chunks = []

        ids = results.get("ids", [[]])[0]
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        for chunk_id, content, metadata in zip(ids, documents, metadatas):
            associated_rubrics = []
            raw = metadata.get("associated_rubrics", "")
            if raw:
                associated_rubrics = [r for r in raw.split(",") if r]

            chunk = RubricChunk(
                id=chunk_id,
                content=content,
                source_type=metadata.get("source_type", "rubric"),
                source_id=metadata.get("source_id", ""),
                associated_rubrics=associated_rubrics,
                metadata={k: v for k, v in metadata.items()
                          if k not in ("source_type", "source_id", "associated_rubrics")}
            )
            chunks.append(chunk)

        return chunks
