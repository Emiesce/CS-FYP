"""
HKUST CSE Exam Platform – Question Router

Decides which grading agent and lane to use for each question.
"""

from __future__ import annotations

from app.models.exam_models import QuestionType
from app.models.grading_models import GradingLane, StructuredRubric
from app.services.grading.llm.model_registry import select_lane


def route_question(
    *,
    question_type: QuestionType,
    has_exact_answer: bool = False,
    has_rubric: bool = False,
    high_stakes: bool = False,
    mode: str = "balanced",
) -> GradingLane:
    """Route a question to the appropriate grading lane."""
    return select_lane(
        question_type,
        has_exact_answer=has_exact_answer,
        high_stakes=high_stakes,
        mode=mode,
    )
