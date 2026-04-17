"""
HKUST CSE Exam Platform – Output Validation

Validates grading outputs for schema correctness and score consistency.
"""

from __future__ import annotations

import logging

from app.models.grading_models import QuestionGradeResult

logger = logging.getLogger(__name__)


def validate_grade_result(result: QuestionGradeResult) -> list[str]:
    """
    Validate a grading result. Returns list of issues (empty = valid).
    """
    issues: list[str] = []

    # Score bounds
    if result.raw_score < 0:
        issues.append(f"raw_score ({result.raw_score}) is negative")
    if result.raw_score > result.max_points * 1.01:  # tiny float tolerance
        issues.append(
            f"raw_score ({result.raw_score}) exceeds max_points ({result.max_points})"
        )

    # Normalised score range
    if result.normalized_score < 0 or result.normalized_score > 1.01:
        issues.append(
            f"normalized_score ({result.normalized_score}) out of [0, 1] range"
        )

    # Criterion scores consistency
    if result.criterion_results:
        criterion_total = sum(cr.score for cr in result.criterion_results)
        if abs(criterion_total - result.raw_score) > 0.5:
            issues.append(
                f"criterion total ({criterion_total}) differs from "
                f"raw_score ({result.raw_score}) by more than 0.5"
            )

        for cr in result.criterion_results:
            if cr.score < 0:
                issues.append(f"Criterion {cr.criterion_id} has negative score")
            if cr.score > cr.max_points * 1.01:
                issues.append(
                    f"Criterion {cr.criterion_id} score ({cr.score}) "
                    f"exceeds max_points ({cr.max_points})"
                )

    # Evidence check for non-trivial scores
    if (
        result.raw_score > 0
        and result.lane != "deterministic"
        and not result.evidence_spans
        and not any(cr.evidence_spans for cr in result.criterion_results)
    ):
        issues.append("Non-zero score from LLM but no evidence spans provided")

    return issues


def validate_grading_run_totals(
    question_results: list[QuestionGradeResult],
    expected_max: float,
) -> list[str]:
    """Validate that grading run totals are consistent."""
    issues: list[str] = []

    actual_max = sum(qr.max_points for qr in question_results)
    if abs(actual_max - expected_max) > 0.01:
        issues.append(
            f"Sum of max_points ({actual_max}) != expected ({expected_max})"
        )

    return issues
