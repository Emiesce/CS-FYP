"""
HKUST CSE Exam Platform – Score Consistency Checks

Final sanity checks before delivering grading results.
"""

from __future__ import annotations

from app.models.grading_models import QuestionGradeResult


def clamp_scores(result: QuestionGradeResult) -> QuestionGradeResult:
    """Clamp all scores to valid ranges and fix normalized_score."""
    result.raw_score = max(0, min(result.raw_score, result.max_points))
    result.normalized_score = (
        result.raw_score / result.max_points if result.max_points > 0 else 0
    )

    for cr in result.criterion_results:
        cr.score = max(0, min(cr.score, cr.max_points))

    return result
