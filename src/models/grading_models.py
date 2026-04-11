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
    lecture_notes_references: Optional[List[str]] = Field(default=None, description="References to lecture notes used in grading")
    context_metadata: Optional[Dict[str, Any]] = Field(default=None, description="Metadata about context used in grading")

class RubricChunk(BaseModel):
    """Represents a piece of rubric text for vector storage."""
    
    id: str = Field(description="Unique identifier for the chunk")
    content: str = Field(description="The text content of the chunk")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata for the chunk")
    criterion_name: Optional[str] = Field(default=None, description="Associated criterion name if applicable")
    source_type: str = Field(default="rubric", description="Source type: 'rubric' or 'lecture_note'")
    source_id: str = Field(default="", description="ID of the source document")
    associated_rubrics: List[str] = Field(default_factory=list, description="List of associated rubric IDs")


class ProcessingStatus(str, Enum):
    """Enumeration of lecture note processing statuses."""
    
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class LectureNote(BaseModel):
    """Represents a lecture note document with metadata."""
    
    id: str = Field(description="Unique identifier for the lecture note")
    filename: str = Field(description="Stored filename")
    original_name: str = Field(description="Original filename as uploaded")
    file_size: int = Field(description="File size in bytes")
    file_type: str = Field(description="File type: 'pdf', 'docx', 'txt', or 'md'")
    uploaded_at: datetime = Field(default_factory=datetime.now, description="Upload timestamp")
    processed_at: Optional[datetime] = Field(default=None, description="Processing completion timestamp")
    extracted_content: Optional[str] = Field(default=None, description="Extracted text content")
    word_count: Optional[int] = Field(default=None, description="Word count of extracted content")
    associated_rubrics: List[str] = Field(default_factory=list, description="List of associated rubric IDs")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    
    @property
    def processing_status(self) -> ProcessingStatus:
        """Get the current processing status."""
        if self.metadata.get("processing_error"):
            return ProcessingStatus.FAILED
        elif self.processed_at:
            return ProcessingStatus.COMPLETED
        elif self.extracted_content is not None:
            return ProcessingStatus.PROCESSING
        else:
            return ProcessingStatus.PENDING
    
    def set_processing_error(self, error_message: str) -> None:
        """Set processing error in metadata."""
        self.metadata["processing_error"] = error_message
        self.metadata["processing_status"] = ProcessingStatus.FAILED
    
    def clear_processing_error(self) -> None:
        """Clear processing error from metadata."""
        self.metadata.pop("processing_error", None)
        self.metadata.pop("processing_status", None)


class LectureNotesStore(BaseModel):
    """Storage model for lecture notes data."""
    
    notes: Dict[str, LectureNote] = Field(default_factory=dict, description="Dictionary of lecture notes by ID")
    rubric_associations: Dict[str, List[str]] = Field(default_factory=dict, description="Rubric ID to note IDs mapping")
    metadata: Dict[str, Any] = Field(default_factory=lambda: {
        "version": "1.0",
        "last_updated": datetime.now().isoformat(),
        "total_notes": 0
    }, description="Storage metadata")
    
    def add_note(self, note: LectureNote) -> None:
        """Add a lecture note to the store."""
        self.notes[note.id] = note
        self.metadata["total_notes"] = len(self.notes)
        self.metadata["last_updated"] = datetime.now().isoformat()
    
    def remove_note(self, note_id: str) -> bool:
        """Remove a lecture note from the store."""
        if note_id in self.notes:
            note = self.notes.pop(note_id)
            # Remove from rubric associations
            for rubric_id in note.associated_rubrics:
                if rubric_id in self.rubric_associations:
                    self.rubric_associations[rubric_id] = [
                        nid for nid in self.rubric_associations[rubric_id] if nid != note_id
                    ]
                    if not self.rubric_associations[rubric_id]:
                        del self.rubric_associations[rubric_id]
            
            self.metadata["total_notes"] = len(self.notes)
            self.metadata["last_updated"] = datetime.now().isoformat()
            return True
        return False
    
    def associate_note_with_rubric(self, note_id: str, rubric_id: str) -> bool:
        """Associate a note with a rubric."""
        if note_id in self.notes:
            note = self.notes[note_id]
            if rubric_id not in note.associated_rubrics:
                note.associated_rubrics.append(rubric_id)
            
            if rubric_id not in self.rubric_associations:
                self.rubric_associations[rubric_id] = []
            if note_id not in self.rubric_associations[rubric_id]:
                self.rubric_associations[rubric_id].append(note_id)
            
            self.metadata["last_updated"] = datetime.now().isoformat()
            return True
        return False
    
    def disassociate_note_from_rubric(self, note_id: str, rubric_id: str) -> bool:
        """Remove association between a note and rubric."""
        if note_id in self.notes:
            note = self.notes[note_id]
            if rubric_id in note.associated_rubrics:
                note.associated_rubrics.remove(rubric_id)
            
            if rubric_id in self.rubric_associations:
                self.rubric_associations[rubric_id] = [
                    nid for nid in self.rubric_associations[rubric_id] if nid != note_id
                ]
                if not self.rubric_associations[rubric_id]:
                    del self.rubric_associations[rubric_id]
            
            self.metadata["last_updated"] = datetime.now().isoformat()
            return True
        return False
    
    def get_notes_for_rubric(self, rubric_id: str) -> List[LectureNote]:
        """Get all notes associated with a rubric."""
        note_ids = self.rubric_associations.get(rubric_id, [])
        return [self.notes[note_id] for note_id in note_ids if note_id in self.notes]


class MarkingScheme(BaseModel):
    """Represents a complete marking scheme for an assignment."""
    
    id: str = Field(description="Unique identifier for the marking scheme")
    question_id: str = Field(description="Associated question identifier")
    criteria: List[Dict[str, Any]] = Field(description="List of grading criteria definitions")
    rubric_text: str = Field(description="Original rubric text for RAG processing")
    created_by: str = Field(description="User who created the marking scheme")
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")


class GradingRequest(BaseModel):
    """Request model for grading operations (supports all exam types)."""
    
    student_id: str = Field(description="Student identifier")
    answer: Optional[str] = Field(default=None, description="Unused legacy field — use question_answers instead")
    marking_scheme_id: str = Field(description="Marking scheme to use for grading")
    assignment_id: Optional[str] = Field(default=None, description="Assignment identifier (optional)")
    student_name: Optional[str] = Field(default=None, description="Student name (optional)")
    course_id: Optional[str] = Field(default=None, description="Course identifier (optional)")
    submitted_at: Optional[str] = Field(default=None, description="Submission timestamp (optional)")
    criteria_ids: Optional[List[str]] = Field(default=None, description="Specific criteria to grade (optional)")
    # Per-question answers: { "question_id": "answer text" }
    # When provided, each criterion is graded against its question's specific answer
    question_answers: Optional[Dict[str, str]] = Field(default=None, description="Per-question answer texts keyed by question_id")


# Backward compatibility alias
EssayGradingRequest = GradingRequest


class GradingResponse(BaseModel):
    """Response model containing complete grading results (supports all exam types)."""
    
    student_id: str = Field(description="Student identifier")
    results: List[GradingCriterion] = Field(description="Grading results for each criterion")
    total_score: float = Field(description="Sum of all criterion scores")
    max_total_score: float = Field(description="Maximum possible total score")
    overall_feedback: Optional[str] = Field(default=None, description="Overall feedback summary")
    processed_at: datetime = Field(default_factory=datetime.now, description="Processing timestamp")


# Backward compatibility alias
EssayGradingResponse = GradingResponse


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