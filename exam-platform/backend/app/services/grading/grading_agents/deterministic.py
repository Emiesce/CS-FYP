"""
HKUST CSE Exam Platform – Deterministic Grading Utilities

Rule-based grading for MCQ, exact-match short answers, and simple math.
These never invoke an LLM.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Union

from app.models.grading_models import (
    CriterionGradeResult,
    EvidenceSpan,
    GradingLane,
    QuestionGradeResult,
    QuestionGradingStatus,
)


# ---- Text normalisation helpers --------------------------------------

def _normalise(text: str) -> str:
    """Lowercase, strip, collapse whitespace, remove accents."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower().strip()
    text = re.sub(r"\s+", " ", text)
    return text


def _normalise_numeric(text: str) -> str | None:
    """Try to extract a single numeric value from text."""
    text = text.strip()
    # Remove trailing periods or commas
    text = text.rstrip(".,")
    # Try to parse as a number
    try:
        val = float(text)
        # Normalise: remove trailing zeros
        if val == int(val):
            return str(int(val))
        return f"{val:g}"
    except ValueError:
        return None


# ---- MCQ grading (fully deterministic) -------------------------------

def grade_mcq(
    *,
    student_answer: Union[str, list[str]],
    correct_option_ids: list[str],
    max_points: float,
    allow_multiple: bool,
) -> QuestionGradeResult:
    """Grade a multiple-choice question deterministically."""

    # Normalise student answer to a set of option IDs
    if isinstance(student_answer, str):
        selected = {student_answer.strip()} if student_answer.strip() else set()
    else:
        selected = {a.strip() for a in student_answer if a.strip()}

    correct_set = set(correct_option_ids)

    if allow_multiple:
        # Partial credit: fraction of correct selections
        if not correct_set:
            score = max_points
        else:
            correct_selected = selected & correct_set
            incorrect_selected = selected - correct_set
            # Simple scoring: +1 per correct, -1 per incorrect, min 0
            raw = len(correct_selected) - len(incorrect_selected)
            score = max(0, (raw / len(correct_set)) * max_points)
    else:
        # Single answer: all or nothing
        score = max_points if selected == correct_set else 0.0

    normalised = score / max_points if max_points > 0 else 1.0

    rationale = (
        f"Selected: {sorted(selected) if selected else '(none)'}. "
        f"Correct: {sorted(correct_set)}. "
        f"Score: {score}/{max_points}."
    )

    return QuestionGradeResult(
        question_id="",  # caller fills in
        question_type="mcq",
        status=QuestionGradingStatus.GRADED,
        lane=GradingLane.DETERMINISTIC,
        model=None,
        raw_score=score,
        max_points=max_points,
        normalized_score=normalised,
        confidence=1.0,
        rationale=rationale,
        criterion_results=[
            CriterionGradeResult(
                criterion_id="mcq-correctness",
                criterion_label="Answer Correctness",
                score=score,
                max_points=max_points,
                rationale=rationale,
                evidence_spans=[],
            )
        ],
        evidence_spans=[],
    )


# ---- Exact-match short answer grading --------------------------------

def grade_exact_match(
    *,
    student_answer: str,
    acceptable_answers: list[str],
    max_points: float,
    case_sensitive: bool = False,
) -> QuestionGradeResult | None:
    """
    Grade a short answer by exact match against acceptable answers.
    Returns None if no match found (caller should escalate to LLM).
    """
    norm_student = student_answer.strip() if case_sensitive else _normalise(student_answer)

    for acceptable in acceptable_answers:
        norm_accept = acceptable.strip() if case_sensitive else _normalise(acceptable)
        if norm_student == norm_accept:
            return QuestionGradeResult(
                question_id="",
                question_type="short_answer",
                status=QuestionGradingStatus.GRADED,
                lane=GradingLane.DETERMINISTIC,
                model=None,
                raw_score=max_points,
                max_points=max_points,
                normalized_score=1.0,
                confidence=1.0,
                rationale=f"Exact match: \"{student_answer.strip()}\" matches expected answer.",
                criterion_results=[
                    CriterionGradeResult(
                        criterion_id="exact-match",
                        criterion_label="Answer Correctness",
                        score=max_points,
                        max_points=max_points,
                        rationale="Exact match with accepted answer.",
                        evidence_spans=[
                            EvidenceSpan(
                                start_index=0,
                                end_index=len(student_answer),
                                quote=student_answer.strip(),
                                criterion_id="exact-match",
                                reason="Full answer matches expected.",
                            )
                        ],
                    )
                ],
                evidence_spans=[
                    EvidenceSpan(
                        start_index=0,
                        end_index=len(student_answer),
                        quote=student_answer.strip(),
                        criterion_id="exact-match",
                        reason="Full answer matches expected.",
                    )
                ],
            )

    return None  # No match → needs LLM


# ---- Numeric math grading --------------------------------------------

def grade_numeric_match(
    *,
    student_answer: str,
    expected_values: list[str],
    max_points: float,
    tolerance: float = 1e-9,
) -> QuestionGradeResult | None:
    """
    Grade a math answer by numeric comparison.
    Returns None if student answer is not a number or doesn't match.
    """
    student_num = _normalise_numeric(student_answer)
    if student_num is None:
        return None

    try:
        student_val = float(student_num)
    except ValueError:
        return None

    for expected in expected_values:
        expected_num = _normalise_numeric(expected)
        if expected_num is None:
            continue
        try:
            expected_val = float(expected_num)
        except ValueError:
            continue

        if abs(student_val - expected_val) <= tolerance:
            return QuestionGradeResult(
                question_id="",
                question_type="mathematics",
                status=QuestionGradingStatus.GRADED,
                lane=GradingLane.DETERMINISTIC,
                model=None,
                raw_score=max_points,
                max_points=max_points,
                normalized_score=1.0,
                confidence=1.0,
                rationale=f"Numeric match: {student_val} ≈ {expected_val}.",
                criterion_results=[
                    CriterionGradeResult(
                        criterion_id="numeric-match",
                        criterion_label="Numeric Correctness",
                        score=max_points,
                        max_points=max_points,
                        rationale=f"Student value {student_val} matches expected {expected_val}.",
                        evidence_spans=[],
                    )
                ],
                evidence_spans=[],
            )

    return None  # No numeric match → needs LLM
