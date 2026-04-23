"""
HKUST CSE Exam Platform – Analytics Domain Models
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ScoreBucket(BaseModel):
    label: str
    count: int


class StudentAnalyticsRecord(BaseModel):
    student_id: str
    student_name: str
    total_score: float
    max_score: float
    percentage: float
    question_scores: dict[str, dict[str, float]]  # qid -> {score, max_points}
    topic_scores: dict[str, dict[str, float]]      # tid -> {score, max_points}
    risk_score: Optional[float] = None
    high_severity_event_count: Optional[int] = None
    proctoring_event_count: Optional[int] = None
    review_override_count: int = 0


class QuestionAnalyticsOut(BaseModel):
    question_id: str
    question_title: str
    question_type: str
    max_points: float
    topic_ids: list[str] = Field(default_factory=list)
    mean_score: float
    median_score: float
    min_score: float
    max_score: float
    std_dev: float
    success_rate: float
    override_count: int
    score_distribution: list[ScoreBucket] = Field(default_factory=list)


class TopicAnalyticsOut(BaseModel):
    topic_id: str
    topic_label: str
    question_count: int
    mean_score: float
    max_possible: float
    percentage: float
    weakest_question_id: Optional[str] = None


class AnalyticsOverviewOut(BaseModel):
    exam_id: str
    student_count: int
    graded_count: int
    mean_score: float
    median_score: float
    highest_score: float
    lowest_score: float
    std_dev: float
    max_total_points: float
    mean_percentage: float
    score_distribution: list[ScoreBucket] = Field(default_factory=list)
    pass_rate: float


class ExamAnalyticsSnapshotOut(BaseModel):
    exam_id: str
    course_code: str
    course_name: str
    exam_title: str
    generated_at: str
    overview: AnalyticsOverviewOut
    questions: list[QuestionAnalyticsOut] = Field(default_factory=list)
    topics: list[TopicAnalyticsOut] = Field(default_factory=list)
    students: list[StudentAnalyticsRecord] = Field(default_factory=list)
    ai_summary: Optional[AnalyticsAISummaryOut] = None


class AnalyticsAISummaryOut(BaseModel):
    common_misconceptions: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    confidence: str = "medium"
    generated_at: str = ""


class AnalyticsChatRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[dict[str, str]] = Field(default_factory=list)


class AnalyticsChatResponse(BaseModel):
    reply: str
    timestamp: str


class ProctoringSessionSync(BaseModel):
    """Sync payload for persisting proctoring data for analytics."""
    exam_id: Optional[str] = None
    student_id: str
    student_name: str
    student_number: str = ""
    avatar_url: Optional[str] = None
    session_status: str = "live"   # live | completed | aborted
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    risk_score: float = 0
    rolling_average: float = 0
    high_severity_event_count: int = 0
    event_count: int = 0
    live_status: Optional[dict] = None
    events: list[dict] = Field(default_factory=list)
    buckets: list[dict] = Field(default_factory=list)


class ProctoringEventOut(BaseModel):
    id: str
    exam_id: str
    student_id: str
    event_type: str
    severity: float
    timestamp: str
    started_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    message: str
    has_evidence_clip: Optional[str] = None


class ProctoringSessionOut(BaseModel):
    id: str
    exam_id: str
    student_id: str
    student_name: str
    student_number: str
    avatar_url: Optional[str] = None
    session_status: str
    started_at: str
    updated_at: str
    ended_at: Optional[str] = None
    risk_score: float
    rolling_average: float
    event_count: int
    high_severity_event_count: int
    live_status: Optional[dict] = None
    events: list[ProctoringEventOut] = Field(default_factory=list)
    buckets: list[dict] = Field(default_factory=list)
