"""
HKUST CSE Exam Platform – Exam Definition & Attempt Models

Pydantic models for exam authoring and student submissions.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal, Optional, Union

from pydantic import BaseModel, Field


class QuestionType(str, Enum):
    MCQ = "mcq"
    SHORT_ANSWER = "short_answer"
    LONG_ANSWER = "long_answer"
    ESSAY = "essay"
    CODING = "coding"
    MATHEMATICS = "mathematics"


class RubricAttachment(BaseModel):
    file_name: str = Field(min_length=1)
    file_size: int = Field(ge=0)
    mime_type: str = Field(min_length=1)


class QuestionRubric(BaseModel):
    text: str = ""
    attachment: Optional[RubricAttachment] = None


class McqOption(BaseModel):
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    is_correct: bool = False


# ---- Per-type question models ----------------------------------------

class McqQuestionData(BaseModel):
    type: Literal["mcq"] = "mcq"
    options: list[McqOption] = Field(default_factory=list, min_length=2)
    allow_multiple: bool = False


class ShortAnswerQuestionData(BaseModel):
    type: Literal["short_answer"] = "short_answer"
    max_length: Optional[int] = None
    placeholder: Optional[str] = None


class LongAnswerQuestionData(BaseModel):
    type: Literal["long_answer"] = "long_answer"
    expected_length_hint: Optional[str] = None


class EssayQuestionData(BaseModel):
    type: Literal["essay"] = "essay"
    expected_length_hint: Optional[str] = None


class CodingQuestionData(BaseModel):
    type: Literal["coding"] = "coding"
    language: str = Field(min_length=1)
    starter_code: str = ""
    constraints: Optional[str] = None


class MathQuestionData(BaseModel):
    type: Literal["mathematics"] = "mathematics"
    answer_format_hint: Optional[str] = None


QuestionTypeData = Union[
    McqQuestionData,
    ShortAnswerQuestionData,
    LongAnswerQuestionData,
    EssayQuestionData,
    CodingQuestionData,
    MathQuestionData,
]


class ExamQuestionIn(BaseModel):
    """Question payload for creating/updating an exam definition."""

    id: str = Field(min_length=1)
    order: int = Field(ge=1)
    title: str = Field(min_length=1)
    prompt: str = Field(min_length=1)
    points: float = Field(ge=0)
    required: bool = True
    rubric: Optional[QuestionRubric] = None
    type_data: QuestionTypeData = Field(discriminator="type")


class ExamDefinitionIn(BaseModel):
    """Payload for creating/updating an exam definition."""

    course_code: str = Field(min_length=1)
    course_name: str = Field(min_length=1)
    title: str = Field(min_length=1)
    date: str
    start_time: str
    duration_seconds: int = Field(gt=0)
    location: str = Field(min_length=1)
    instructions: str = ""
    questions: list[ExamQuestionIn] = Field(default_factory=list)


class ExamDefinitionOut(BaseModel):
    """Full exam definition response."""

    id: str
    course_code: str
    course_name: str
    title: str
    date: str
    start_time: str
    duration_seconds: int
    location: str
    instructions: str
    questions: list[ExamQuestionIn]
    total_points: float
    created_at: datetime
    updated_at: datetime


# ---- Student attempt models ------------------------------------------

class AttemptStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    TIMED_OUT = "timed_out"


class QuestionResponseIn(BaseModel):
    question_id: str = Field(min_length=1)
    question_type: QuestionType
    value: Union[str, list[str]]
    answered_at: datetime


class ExamAttemptIn(BaseModel):
    """Create / update a student attempt."""

    exam_id: str = Field(min_length=1)
    student_id: str = Field(min_length=1)
    responses: list[QuestionResponseIn] = Field(default_factory=list)
    current_question_index: int = Field(ge=0, default=0)
    flagged_question_ids: list[str] = Field(default_factory=list)


class ExamAttemptOut(BaseModel):
    """Full attempt response."""

    id: str
    exam_id: str
    student_id: str
    status: AttemptStatus
    started_at: datetime
    submitted_at: Optional[datetime] = None
    responses: list[QuestionResponseIn]
    current_question_index: int
    flagged_question_ids: list[str]
