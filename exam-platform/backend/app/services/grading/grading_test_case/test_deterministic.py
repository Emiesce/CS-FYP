"""
Unit tests for deterministic grading functions.

No LLM calls, no database, no API key required.

Run with:
    cd exam-platform/backend
    python -m pytest "app/services/grading/grading_test_case/test_deterministic.py" -v
"""

from __future__ import annotations

import pytest

from app.services.grading.grading_agents.deterministic import (
    grade_exact_match,
    grade_mcq,
    grade_numeric_match,
)
from app.models.grading_models import GradingLane, QuestionGradingStatus


# ── MCQ grading ───────────────────────────────────────────────────────

class TestGradeMcq:
    def test_single_correct(self):
        r = grade_mcq(student_answer="a", correct_option_ids=["a"], max_points=1.0, allow_multiple=False)
        r.question_id = "q1"
        assert r.raw_score == 1.0
        assert r.normalized_score == 1.0
        assert r.confidence == 1.0
        assert r.lane == GradingLane.DETERMINISTIC
        assert r.status == QuestionGradingStatus.GRADED

    def test_single_wrong(self):
        r = grade_mcq(student_answer="b", correct_option_ids=["a"], max_points=1.0, allow_multiple=False)
        assert r.raw_score == 0.0
        assert r.normalized_score == 0.0

    def test_single_empty_answer(self):
        r = grade_mcq(student_answer="", correct_option_ids=["a"], max_points=1.0, allow_multiple=False)
        assert r.raw_score == 0.0

    def test_multiple_all_correct(self):
        r = grade_mcq(student_answer=["a", "b"], correct_option_ids=["a", "b"], max_points=2.0, allow_multiple=True)
        assert r.raw_score == 2.0

    def test_multiple_partial_credit(self):
        r = grade_mcq(student_answer=["a", "c"], correct_option_ids=["a", "b"], max_points=2.0, allow_multiple=True)
        assert 0.0 <= r.raw_score < 2.0

    def test_multiple_all_wrong(self):
        r = grade_mcq(student_answer=["c", "d"], correct_option_ids=["a", "b"], max_points=2.0, allow_multiple=True)
        assert r.raw_score == 0.0

    def test_score_never_negative(self):
        r = grade_mcq(student_answer=["c", "d", "e"], correct_option_ids=["a"], max_points=1.0, allow_multiple=True)
        assert r.raw_score >= 0.0

    def test_no_correct_options_full_score(self):
        r = grade_mcq(student_answer="a", correct_option_ids=[], max_points=1.0, allow_multiple=True)
        assert r.raw_score == 1.0

    def test_rationale_contains_selected_and_correct(self):
        r = grade_mcq(student_answer="b", correct_option_ids=["a"], max_points=1.0, allow_multiple=False)
        assert "b" in r.rationale
        assert "a" in r.rationale

    def test_criterion_results_populated(self):
        r = grade_mcq(student_answer="a", correct_option_ids=["a"], max_points=1.0, allow_multiple=False)
        assert len(r.criterion_results) == 1
        assert r.criterion_results[0].score == 1.0


# ── Exact match grading ───────────────────────────────────────────────

class TestGradeExactMatch:
    def test_exact_hit(self):
        r = grade_exact_match(student_answer="Paris", acceptable_answers=["Paris"], max_points=5.0)
        assert r is not None
        assert r.raw_score == 5.0
        assert r.normalized_score == 1.0
        assert r.confidence == 1.0

    def test_case_insensitive_hit(self):
        r = grade_exact_match(student_answer="paris", acceptable_answers=["Paris"], max_points=5.0)
        assert r is not None
        assert r.raw_score == 5.0

    def test_whitespace_trimmed(self):
        r = grade_exact_match(student_answer="  Paris  ", acceptable_answers=["Paris"], max_points=5.0)
        assert r is not None

    def test_miss_returns_none(self):
        r = grade_exact_match(student_answer="London", acceptable_answers=["Paris"], max_points=5.0)
        assert r is None

    def test_multiple_acceptable_answers(self):
        r = grade_exact_match(student_answer="NYC", acceptable_answers=["New York", "NYC", "New York City"], max_points=3.0)
        assert r is not None
        assert r.raw_score == 3.0

    def test_empty_student_answer_miss(self):
        r = grade_exact_match(student_answer="", acceptable_answers=["Paris"], max_points=5.0)
        assert r is None

    def test_evidence_span_populated(self):
        r = grade_exact_match(student_answer="Paris", acceptable_answers=["Paris"], max_points=5.0)
        assert r is not None
        assert len(r.evidence_spans) > 0
        assert r.evidence_spans[0].quote == "Paris"

    def test_case_sensitive_mode(self):
        r = grade_exact_match(
            student_answer="paris",
            acceptable_answers=["Paris"],
            max_points=5.0,
            case_sensitive=True,
        )
        assert r is None

    def test_deterministic_lane(self):
        r = grade_exact_match(student_answer="Paris", acceptable_answers=["Paris"], max_points=5.0)
        assert r is not None
        assert r.lane == GradingLane.DETERMINISTIC


# ── Numeric match grading ─────────────────────────────────────────────

class TestGradeNumericMatch:
    def test_integer_match(self):
        r = grade_numeric_match(student_answer="42", expected_values=["42"], max_points=3.0)
        assert r is not None
        assert r.raw_score == 3.0

    def test_float_match(self):
        r = grade_numeric_match(student_answer="3.14", expected_values=["3.14"], max_points=2.0)
        assert r is not None
        assert r.raw_score == 2.0

    def test_trailing_period_stripped(self):
        r = grade_numeric_match(student_answer="42.", expected_values=["42"], max_points=3.0)
        assert r is not None

    def test_miss_returns_none(self):
        r = grade_numeric_match(student_answer="41", expected_values=["42"], max_points=3.0)
        assert r is None

    def test_non_numeric_returns_none(self):
        r = grade_numeric_match(student_answer="forty-two", expected_values=["42"], max_points=3.0)
        assert r is None

    def test_empty_answer_returns_none(self):
        r = grade_numeric_match(student_answer="", expected_values=["42"], max_points=3.0)
        assert r is None

    def test_tolerance_within(self):
        r = grade_numeric_match(student_answer="42.0000000001", expected_values=["42"], max_points=3.0, tolerance=1e-6)
        assert r is not None

    def test_tolerance_exceeded(self):
        r = grade_numeric_match(student_answer="42.1", expected_values=["42"], max_points=3.0, tolerance=1e-9)
        assert r is None

    def test_multiple_expected_values(self):
        r = grade_numeric_match(student_answer="7", expected_values=["3", "5", "7"], max_points=4.0)
        assert r is not None
        assert r.raw_score == 4.0

    def test_deterministic_lane(self):
        r = grade_numeric_match(student_answer="42", expected_values=["42"], max_points=3.0)
        assert r is not None
        assert r.lane == GradingLane.DETERMINISTIC
