"""
HKUST CSE Exam Platform – Grading Domain Models

Pydantic models for rubric, grading results, evidence, and grading runs.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---- Enums -----------------------------------------------------------

class GradingLane(str, Enum):
    INCOMPLETE = "incomplete"
    DETERMINISTIC = "deterministic"
    CHEAP_LLM = "cheap_llm"
    QUALITY_LLM = "quality_llm"
    ESCALATED = "escalated"


class QuestionGradingStatus(str, Enum):
    PENDING = "pending"
    GRADING = "grading"
    GRADED = "graded"
    ESCALATED = "escalated"
    REVIEWED = "reviewed"
    FINALIZED = "finalized"


class GradingRunStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    REVIEWED = "reviewed"


# ---- Rubric ----------------------------------------------------------

class RubricScoreBand(BaseModel):
    label: str = Field(min_length=1)
    min_points: float = Field(ge=0)
    max_points: float = Field(ge=0)
    description: str = ""


class RubricCriterion(BaseModel):
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    description: str = ""
    max_points: float = Field(ge=0)
    score_bands: list[RubricScoreBand] = Field(default_factory=list)
    model_answer: Optional[str] = None


class StructuredRubric(BaseModel):
    question_id: str = Field(min_length=1)
    criteria: list[RubricCriterion] = Field(default_factory=list, min_length=1)
    total_points: float = Field(ge=0)
    generated_by: Optional[str] = None
    version: int = Field(ge=1, default=1)


class RubricGenerateRequest(BaseModel):
    """Request body for AI rubric generation."""
    exam_id: str = Field(min_length=1)
    question_id: str = Field(min_length=1)
    question_prompt: str = Field(min_length=1)
    question_type: str = Field(min_length=1)
    points: float = Field(ge=0)
    instructor_notes: Optional[str] = None
    support_file_text: Optional[str] = None
    model_answer: Optional[str] = None


class RubricGenerateResponse(BaseModel):
    rubric: StructuredRubric
    generated_by: str
    latency_ms: int


# ---- Evidence --------------------------------------------------------

class EvidenceSpan(BaseModel):
    start_index: int = Field(ge=0)
    end_index: int = Field(ge=0)
    quote: str = ""
    criterion_id: str = Field(min_length=1)
    reason: str = ""


# ---- Grading results -------------------------------------------------

class CriterionGradeResult(BaseModel):
    criterion_id: str
    criterion_label: str
    score: float = Field(ge=0)
    max_points: float = Field(ge=0)
    rationale: str = ""
    evidence_spans: list[EvidenceSpan] = Field(default_factory=list)
    override_score: Optional[float] = None
    reviewer_rationale: Optional[str] = None


class TokenUsage(BaseModel):
    prompt: int = 0
    completion: int = 0


class QuestionGradeResult(BaseModel):
    question_id: str
    question_type: str
    status: QuestionGradingStatus = QuestionGradingStatus.PENDING
    lane: GradingLane = GradingLane.DETERMINISTIC
    model: Optional[str] = None
    raw_score: float = Field(ge=0, default=0)
    max_points: float = Field(ge=0, default=0)
    normalized_score: float = Field(ge=0, le=1, default=0)
    confidence: float = Field(ge=0, le=1, default=1.0)
    rationale: str = ""
    student_answer: Optional[str] = None
    criterion_results: list[CriterionGradeResult] = Field(default_factory=list)
    evidence_spans: list[EvidenceSpan] = Field(default_factory=list)
    escalation_notes: Optional[str] = None
    latency_ms: Optional[int] = None
    token_usage: Optional[TokenUsage] = None


# ---- Reviews ---------------------------------------------------------

class CriterionReviewOverride(BaseModel):
    criterion_id: str = Field(min_length=1)
    original_score: float = Field(ge=0, default=0)
    override_score: Optional[float] = None
    reasoning: Optional[str] = None

class GradingReviewDecision(BaseModel):
    question_id: str
    reviewer_id: str
    original_score: float
    override_score: Optional[float] = None
    comment: Optional[str] = None
    criteria_overrides: list[CriterionReviewOverride] = Field(default_factory=list)
    accepted: bool = True
    reviewed_at: datetime


class ReviewSubmitRequest(BaseModel):
    question_id: str = Field(min_length=1)
    override_score: Optional[float] = None
    comment: Optional[str] = None
    criteria_overrides: list[CriterionReviewOverride] = Field(default_factory=list)
    accepted: bool = True


# ---- Model usage tracking --------------------------------------------

class ModelUsageRecord(BaseModel):
    model: str
    question_id: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0
    cached: bool = False


# ---- Grading run -----------------------------------------------------

class GradingRunOut(BaseModel):
    id: str
    exam_id: str
    attempt_id: str
    student_id: str
    status: GradingRunStatus = GradingRunStatus.PENDING
    question_results: list[QuestionGradeResult] = Field(default_factory=list)
    total_score: float = 0
    max_total_points: float = 0
    reviews: list[GradingReviewDecision] = Field(default_factory=list)
    started_at: datetime
    completed_at: Optional[datetime] = None
    model_usage: list[ModelUsageRecord] = Field(default_factory=list)


class GradingRunRequest(BaseModel):
    """Trigger a grading run for a submitted attempt."""
    attempt_id: str = Field(min_length=1)
    student_id: str = Field(min_length=1)
    rubrics: Optional[dict[str, StructuredRubric]] = None  # question_id -> rubric
    mode: str = Field(default="balanced", pattern="^(low_cost|balanced|quality_first)$")
