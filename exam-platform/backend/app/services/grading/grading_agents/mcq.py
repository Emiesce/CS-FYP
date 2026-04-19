"""
HKUST CSE Exam Platform – MCQ Grading Agent

Fully deterministic. Never calls an LLM.
"""

from __future__ import annotations

from app.models.grading_models import QuestionGradeResult, StructuredRubric
from app.services.grading.grading_agents.deterministic import grade_mcq


async def grade_mcq_question(
    *,
    question_id: str,
    student_answer: str | list[str],
    correct_option_ids: list[str],
    allow_multiple: bool,
    max_points: float,
    rubric: StructuredRubric | None = None,
) -> QuestionGradeResult:
    """Grade an MCQ question deterministically."""
    result = grade_mcq(
        student_answer=student_answer,
        correct_option_ids=correct_option_ids,
        max_points=max_points,
        allow_multiple=allow_multiple,
    )
    result.question_id = question_id
    return result
