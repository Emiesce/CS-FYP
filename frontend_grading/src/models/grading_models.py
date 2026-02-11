"""
Core data structures for RAG essay grading system.
Defines the fundamental models used throughout the grading pipeline.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class GradingCriterion(BaseModel):
    """Represents a single grading criterion with AI evaluation results."""
    
    criterion_id: str = Field(description="Unique identifier for the criterion")
    criterion_name: str = Field(description="The name of the criterion being evaluated")
    matched_level: str = Field(description="The performance level from the rubric that best matches the essay")
    score: float = Field(description="The numerical score assigned for this criterion")
    max_score: float = Field(description="Maximum possible score for this criterion")
    justification: str = Field(description="Detailed justification for the score")
    suggestion_for_improvement: str = Field(description="Constructive suggestion for improvement")
    highlighted_text: Optional[str] = Field(default=None, description="Relevant essay excerpts supporting the score")
    # Note: confidence field removed as per Azure migration requirements


class RubricChunk(BaseModel):
    """Represents a piece of rubric text for vector storage."""
    
    id: str = Field(description="Unique identifier for the chunk")
    content: str = Field(description="The text content of the chunk")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata for the chunk")
    criterion_name: Optional[str] = Field(default=None, description="Associated criterion name if applicable")


class MarkingScheme(BaseModel):
    """Represents a complete marking scheme for an assignment."""
    
    id: str = Field(description="Unique identifier for the marking scheme")
    question_id: str = Field(description="Associated question identifier")
    criteria: List[Dict[str, Any]] = Field(description="List of grading criteria definitions")
    rubric_text: str = Field(description="Original rubric text for RAG processing")
    created_by: str = Field(description="User who created the marking scheme")
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")


class EssayGradingRequest(BaseModel):
    """Request model for essay grading operations."""
    
    student_id: str = Field(description="Student identifier")
    essay_text: str = Field(description="The essay content to be graded")
    marking_scheme_id: str = Field(description="Marking scheme to use for grading")
    criteria_ids: Optional[List[str]] = Field(default=None, description="Specific criteria to grade (optional)")


class EssayGradingResponse(BaseModel):
    """Response model containing complete grading results."""
    
    student_id: str = Field(description="Student identifier")
    results: List[GradingCriterion] = Field(description="Grading results for each criterion")
    total_score: float = Field(description="Sum of all criterion scores")
    max_total_score: float = Field(description="Maximum possible total score")
    overall_feedback: Optional[str] = Field(default=None, description="Overall feedback summary")
    processed_at: datetime = Field(default_factory=datetime.now, description="Processing timestamp")


class GradingErrorType(str, Enum):
    """Enumeration of possible grading error types."""
    
    RUBRIC_PARSING_ERROR = "RUBRIC_PARSING_ERROR"
    AI_SERVICE_ERROR = "AI_SERVICE_ERROR"
    VECTOR_STORE_ERROR = "VECTOR_STORE_ERROR"
    INTEGRATION_ERROR = "INTEGRATION_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"


class GradingError(BaseModel):
    """Error model for grading operations."""
    
    type: GradingErrorType = Field(description="Type of error that occurred")
    message: str = Field(description="Human-readable error message")
    details: Optional[str] = Field(default=None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.now, description="Error occurrence timestamp")


# Constants for system configuration
class GradingConstants:
    """Constants used throughout the grading system."""
    
    # Text processing constants
    DEFAULT_CHUNK_SIZE = 1000
    DEFAULT_CHUNK_OVERLAP = 100
    DEFAULT_SEPARATORS = ["\n\n", "\n", " ", ""]
    
    # Vector search constants
    DEFAULT_SEARCH_K = 3
    MAX_SEARCH_K = 10
    
    # AI model constants
    DEFAULT_TEMPERATURE = 0.0
    MAX_RETRIES = 3
    TIMEOUT_SECONDS = 30
    
    # Performance constants
    MAX_RESPONSE_TIME_SECONDS = 2.0
    MAX_CONCURRENT_REQUESTS = 10