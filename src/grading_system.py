"""
Main module for RAG essay grading system.
Provides the primary entry point and system orchestration.
"""

from typing import Dict, Any, List, Optional
import asyncio
import logging
import json
import os
from datetime import datetime
from pathlib import Path

from .models.grading_models import (
    GradingCriterion,
    RubricChunk,
    MarkingScheme,
    EssayGradingRequest,
    EssayGradingResponse,
    GradingConstants
)
from .interfaces.vector_store import VectorStore
from .interfaces.ai_client import AIClient
from .interfaces.grading_service import GradingService
from .errors.grading_errors import (
    GradingException,
    ValidationError,
    IntegrationError,
    ErrorHandler
)
from .config.settings import config, PromptTemplates

# Set up logging
logging.basicConfig(level=getattr(logging, config.log_level))
logger = logging.getLogger(__name__)


class RAGGradingSystem:
    """
    Main orchestrator for the RAG essay grading system.
    Coordinates between vector store, AI client, and grading service components.
    """
    
    def __init__(
        self,
        vector_store: VectorStore,
        ai_client: AIClient,
        grading_service: GradingService,
        rubrics_json_path: Optional[str] = None
    ):
        """
        Initialize the RAG grading system with required components.
        
        Args:
            vector_store: Vector storage implementation
            ai_client: AI service client implementation
            grading_service: Grading orchestration service implementation
            rubrics_json_path: Path to the rubrics JSON file (defaults to src/data/rubrics.json)
        """
        self.vector_store = vector_store
        self.ai_client = ai_client
        self.grading_service = grading_service
        self.rubrics_json_path = rubrics_json_path or self._get_default_rubrics_path()
        self._initialized = False
        self._loaded_schemes: Dict[str, MarkingScheme] = {}
    
    def _get_default_rubrics_path(self) -> str:
        """Get the default path to the rubrics JSON file."""
        # Get the directory where this file is located
        current_dir = Path(__file__).parent
        # Navigate to the src/data/rubrics.json file
        rubrics_path = current_dir.parent / "data" / "rubrics.json"
        return str(rubrics_path)
    
    async def initialize(self) -> None:
        """Initialize the grading system and validate all components."""
        try:
            logger.info("Initializing RAG grading system...")
            
            # Validate AI client connection
            if not await self.ai_client.validate_connection():
                raise IntegrationError("AI client connection validation failed")
            
            # Clear vector store for fresh start
            await self.vector_store.clear()
            
            self._initialized = True
            logger.info("RAG grading system initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize RAG grading system: {e}")
            raise ErrorHandler.handle_integration_error("RAGGradingSystem", "initialize", e)
    
    def load_rubrics_from_json(self) -> List[Dict[str, Any]]:
        """
        Load rubrics from the JSON file.
        
        Returns:
            List of rubric dictionaries
        """
        try:
            if not os.path.exists(self.rubrics_json_path):
                logger.warning(f"Rubrics JSON file not found at {self.rubrics_json_path}")
                return []
            
            with open(self.rubrics_json_path, 'r', encoding='utf-8') as f:
                rubrics = json.load(f)
            
            logger.info(f"Loaded {len(rubrics)} rubrics from {self.rubrics_json_path}")
            return rubrics
            
        except Exception as e:
            logger.error(f"Failed to load rubrics from JSON: {e}")
            return []
    
    def convert_rubric_to_marking_scheme(self, rubric: Dict[str, Any]) -> MarkingScheme:
        """
        Convert a rubric from JSON format to a MarkingScheme object.
        
        Args:
            rubric: Rubric dictionary from JSON
            
        Returns:
            MarkingScheme object
        """
        try:
            # Convert questions to criteria
            criteria = []
            for question in rubric.get('questions', []):
                # Create rubric text from question and scoring criteria
                rubric_text_parts = [
                    f"Question: {question.get('title', '')}",
                    f"Description: {question.get('description', '')}",
                    f"Score Range: {question.get('minScore', 0)} - {question.get('maxScore', 0)} points"
                ]
                
                # Add scoring criteria details
                for criterion in question.get('scoringCriteria', []):
                    rubric_text_parts.append(
                        f"Score {criterion.get('scoreRange', '')}: {criterion.get('description', '')}"
                    )
                
                rubric_text = "\n".join(rubric_text_parts)
                
                # Create criterion
                criterion_data = {
                    "id": question.get('id', ''),
                    "name": question.get('title', ''),
                    "description": question.get('description', ''),
                    "max_score": question.get('maxScore', 0),
                    "rubric_text": rubric_text
                }
                criteria.append(criterion_data)
            
            # Create marking scheme
            marking_scheme = MarkingScheme(
                id=rubric.get('id', ''),
                question_id=rubric.get('assignmentId', rubric.get('id', '')),
                name=rubric.get('title', ''),
                description=rubric.get('description', ''),
                criteria=criteria,
                created_by="system",
                created_at=datetime.fromisoformat(rubric.get('createdAt', datetime.now().isoformat()).replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(rubric.get('updatedAt', datetime.now().isoformat()).replace('Z', '+00:00'))
            )
            
            return marking_scheme
            
        except Exception as e:
            logger.error(f"Failed to convert rubric to marking scheme: {e}")
            raise ErrorHandler.handle_validation_error("rubric", rubric, f"Invalid rubric format: {e}")
    
    async def load_marking_scheme_from_json(self, rubric_id: str) -> Optional[MarkingScheme]:
        """
        Load a specific marking scheme from the JSON file by rubric ID.
        
        Args:
            rubric_id: ID of the rubric to load
            
        Returns:
            MarkingScheme object if found, None otherwise
        """
        try:
            rubrics = self.load_rubrics_from_json()
            
            # Find the rubric with the specified ID
            target_rubric = None
            for rubric in rubrics:
                if rubric.get('id') == rubric_id:
                    target_rubric = rubric
                    break
            
            if not target_rubric:
                logger.warning(f"Rubric with ID {rubric_id} not found in JSON file")
                return None
            
            # Convert to marking scheme
            marking_scheme = self.convert_rubric_to_marking_scheme(target_rubric)
            
            # Store in cache
            self._loaded_schemes[rubric_id] = marking_scheme
            
            logger.info(f"Loaded marking scheme {rubric_id} from JSON")
            return marking_scheme
            
        except Exception as e:
            logger.error(f"Failed to load marking scheme {rubric_id} from JSON: {e}")
            return None
    
    async def initialize_with_marking_scheme(self, rubric_id: str) -> MarkingScheme:
        """
        Initialize the RAG system and load a specific marking scheme from JSON.
        
        Args:
            rubric_id: ID of the rubric to load as marking scheme
            
        Returns:
            Loaded MarkingScheme object
        """
        if not self._initialized:
            await self.initialize()
        
        try:
            # Load marking scheme from JSON
            marking_scheme = await self.load_marking_scheme_from_json(rubric_id)
            
            if not marking_scheme:
                raise ValidationError(f"Marking scheme with ID {rubric_id} not found")
            
            # Load into RAG system
            await self.grading_service.load_marking_scheme_to_rag(marking_scheme.id)
            
            logger.info(f"Initialized RAG system with marking scheme {rubric_id}")
            return marking_scheme
            
        except Exception as e:
            logger.error(f"Failed to initialize with marking scheme {rubric_id}: {e}")
            raise
    
    async def create_and_load_marking_scheme(
        self,
        question_id: str,
        rubric_text: str,
        criteria: List[Dict[str, Any]],
        created_by: str
    ) -> MarkingScheme:
        """
        Create a new marking scheme and load it into the RAG system.
        
        Args:
            question_id: ID of the associated question
            rubric_text: Raw rubric text for processing
            criteria: List of criterion definitions
            created_by: User who created the scheme
            
        Returns:
            Created MarkingScheme object
        """
        if not self._initialized:
            await self.initialize()
        
        try:
            # Create marking scheme
            scheme_request = {
                "question_id": question_id,
                "rubric_text": rubric_text,
                "criteria": criteria,
                "created_by": created_by
            }
            
            marking_scheme = await self.grading_service.create_marking_scheme(scheme_request)
            
            # Load into RAG system
            await self.grading_service.load_marking_scheme_to_rag(marking_scheme.id)
            
            logger.info(f"Created and loaded marking scheme {marking_scheme.id}")
            return marking_scheme
            
        except Exception as e:
            logger.error(f"Failed to create and load marking scheme: {e}")
            raise
    
    async def grade_essay(self, request: EssayGradingRequest) -> EssayGradingResponse:
        """
        Grade a student essay using the RAG system.
        Automatically loads the marking scheme from JSON if not already loaded.
        
        Args:
            request: Essay grading request containing essay text and parameters
            
        Returns:
            Complete grading response with results for all criteria
        """
        if not self._initialized:
            await self.initialize()
        
        try:
            logger.info(f"Grading essay for student {request.student_id}")
            
            # Validate request
            self._validate_grading_request(request)
            
            # Check if marking scheme is already loaded, if not load from JSON
            if request.marking_scheme_id not in self._loaded_schemes:
                logger.info(f"Loading marking scheme {request.marking_scheme_id} from JSON")
                marking_scheme = await self.load_marking_scheme_from_json(request.marking_scheme_id)
                
                if not marking_scheme:
                    raise ValidationError(f"Marking scheme {request.marking_scheme_id} not found in JSON file")
                
                # Load into RAG system
                await self.grading_service.load_marking_scheme_to_rag(marking_scheme.id)
            
            # Perform grading
            response = await self.grading_service.grade_essay_all_criteria(request)
            
            logger.info(f"Successfully graded essay: {response.total_score}/{response.max_total_score}")
            return response
            
        except Exception as e:
            logger.error(f"Failed to grade essay: {e}")
            raise
    
    async def grade_single_criterion(
        self,
        essay: str,
        criterion_id: str,
        marking_scheme_id: str
    ) -> GradingCriterion:
        """
        Grade an essay for a single criterion.
        Automatically loads the marking scheme from JSON if not already loaded.
        
        Args:
            essay: Student essay text
            criterion_id: ID of the criterion to evaluate
            marking_scheme_id: ID of the marking scheme to use
            
        Returns:
            GradingCriterion with evaluation results
        """
        if not self._initialized:
            await self.initialize()
        
        try:
            # Check if marking scheme is already loaded, if not load from JSON
            if marking_scheme_id not in self._loaded_schemes:
                logger.info(f"Loading marking scheme {marking_scheme_id} from JSON")
                marking_scheme = await self.load_marking_scheme_from_json(marking_scheme_id)
                
                if not marking_scheme:
                    raise ValidationError(f"Marking scheme {marking_scheme_id} not found in JSON file")
                
                # Load into RAG system
                await self.grading_service.load_marking_scheme_to_rag(marking_scheme.id)
            
            result = await self.grading_service.grade_essay_by_criterion(
                essay, criterion_id, marking_scheme_id
            )
            
            logger.info(f"Graded criterion {criterion_id}: {result.score}/{result.max_score}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to grade criterion {criterion_id}: {e}")
            raise
    
    async def get_system_status(self) -> Dict[str, Any]:
        """
        Get current system status and health information.
        
        Returns:
            Dictionary containing system status information
        """
        try:
            status = {
                "initialized": self._initialized,
                "timestamp": datetime.now().isoformat(),
                "rubrics_json_path": self.rubrics_json_path,
                "loaded_schemes": list(self._loaded_schemes.keys()),
                "components": {}
            }
            
            # Check AI client status
            try:
                ai_connected = await self.ai_client.validate_connection()
                ai_model_info = await self.ai_client.get_model_info()
                status["components"]["ai_client"] = {
                    "connected": ai_connected,
                    "model_info": ai_model_info
                }
            except Exception as e:
                status["components"]["ai_client"] = {
                    "connected": False,
                    "error": str(e)
                }
            
            # Check vector store status
            try:
                doc_count = await self.vector_store.get_document_count()
                status["components"]["vector_store"] = {
                    "document_count": doc_count,
                    "healthy": True
                }
            except Exception as e:
                status["components"]["vector_store"] = {
                    "healthy": False,
                    "error": str(e)
                }
            
            # Check available rubrics
            try:
                rubrics = self.load_rubrics_from_json()
                status["available_rubrics"] = [
                    {
                        "id": r.get("id"),
                        "title": r.get("title"),
                        "questions_count": len(r.get("questions", []))
                    }
                    for r in rubrics
                ]
            except Exception as e:
                status["available_rubrics"] = []
                status["rubrics_error"] = str(e)
            
            return status
            
        except Exception as e:
            logger.error(f"Failed to get system status: {e}")
            return {
                "initialized": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def get_available_rubrics(self) -> List[Dict[str, Any]]:
        """
        Get a list of available rubrics from the JSON file.
        
        Returns:
            List of rubric summaries
        """
        try:
            rubrics = self.load_rubrics_from_json()
            return [
                {
                    "id": rubric.get("id"),
                    "title": rubric.get("title"),
                    "description": rubric.get("description"),
                    "questions_count": len(rubric.get("questions", [])),
                    "total_max_points": rubric.get("totalMaxPoints", 0),
                    "created_at": rubric.get("createdAt"),
                    "updated_at": rubric.get("updatedAt")
                }
                for rubric in rubrics
            ]
        except Exception as e:
            logger.error(f"Failed to get available rubrics: {e}")
            return []
    
    def _validate_grading_request(self, request: EssayGradingRequest) -> None:
        """Validate grading request parameters."""
        if not request.essay_text.strip():
            raise ErrorHandler.handle_validation_error(
                "essay_text", request.essay_text, "Essay text cannot be empty"
            )
        
        if not request.student_id.strip():
            raise ErrorHandler.handle_validation_error(
                "student_id", request.student_id, "Student ID cannot be empty"
            )
        
        if not request.marking_scheme_id.strip():
            raise ErrorHandler.handle_validation_error(
                "marking_scheme_id", request.marking_scheme_id, "Marking scheme ID cannot be empty"
            )


async def create_azure_system(rubrics_json_path: Optional[str] = None) -> RAGGradingSystem:
    """
    Create a RAG grading system instance with Azure OpenAI integration.
    Requires proper Azure OpenAI configuration via environment variables.
    
    Args:
        rubrics_json_path: Optional path to the rubrics JSON file
    """
    from .implementations.mock_implementations import (
        MockVectorStore,
        MockGradingService
    )
    from .implementations.azure_ai_client import AzureAIClient
    
    vector_store = MockVectorStore()
    ai_client = AzureAIClient()
    grading_service = MockGradingService(vector_store, ai_client)
    
    system = RAGGradingSystem(vector_store, ai_client, grading_service, rubrics_json_path)
    await system.initialize()
    
    return system


async def create_system(rubrics_json_path: Optional[str] = None) -> RAGGradingSystem:
    """
    Create the default RAG grading system instance with Azure OpenAI integration.
    This is now the primary system creation function.
    
    Args:
        rubrics_json_path: Optional path to the rubrics JSON file
    """
    return await create_azure_system(rubrics_json_path)


async def create_test_system(rubrics_json_path: Optional[str] = None) -> RAGGradingSystem:
    """
    Create a test instance of the RAG grading system with mock implementations.
    Useful for development and testing when Azure API is not available.
    
    Args:
        rubrics_json_path: Optional path to the rubrics JSON file
    """
    from .implementations.mock_implementations import (
        MockVectorStore,
        MockAIClient,
        MockGradingService
    )
    
    vector_store = MockVectorStore()
    ai_client = MockAIClient()
    grading_service = MockGradingService(vector_store, ai_client)
    
    system = RAGGradingSystem(vector_store, ai_client, grading_service, rubrics_json_path)
    await system.initialize()
    
    return system


async def create_system_with_rubric(rubric_id: str, rubrics_json_path: Optional[str] = None) -> RAGGradingSystem:
    """
    Create a RAG grading system and initialize it with a specific rubric from JSON.
    
    Args:
        rubric_id: ID of the rubric to load as marking scheme
        rubrics_json_path: Optional path to the rubrics JSON file
        
    Returns:
        Initialized RAG grading system with the specified rubric loaded
    """
    system = await create_system(rubrics_json_path)
    await system.initialize_with_marking_scheme(rubric_id)
    return system


def get_system_info() -> Dict[str, Any]:
    """Get static system information."""
    return {
        "name": "RAG Essay Grading System",
        "version": "1.0.0",
        "description": "Retrieval-Augmented Generation system for automated essay grading",
        "components": [
            "Vector Store",
            "AI Client", 
            "Grading Service"
        ],
        "supported_models": [
            "Azure OpenAI GPT-4o-mini",
            "Azure OpenAI text-embedding-ada-002"
        ],
        "configuration": {
            "chunk_size": GradingConstants.DEFAULT_CHUNK_SIZE,
            "chunk_overlap": GradingConstants.DEFAULT_CHUNK_OVERLAP,
            "search_k": GradingConstants.DEFAULT_SEARCH_K,
            "max_response_time": GradingConstants.MAX_RESPONSE_TIME_SECONDS
        }
    }