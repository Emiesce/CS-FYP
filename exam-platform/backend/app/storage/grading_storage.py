"""
HKUST CSE Exam Platform – Grading Storage

In-memory persistence for grading runs and rubrics.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from app.models.grading_models import (
    CriterionReviewOverride,
    GradingReviewDecision,
    GradingRunOut,
    GradingRunStatus,
    StructuredRubric,
)


class GradingStore:
    """In-memory store for grading runs and rubrics."""

    def __init__(self) -> None:
        self._runs: dict[str, GradingRunOut] = {}          # run_id -> run
        self._attempt_runs: dict[str, str] = {}            # attemptId -> run_id
        self._rubrics: dict[str, StructuredRubric] = {}    # questionId -> rubric

    # ---- Grading runs ------------------------------------------------

    def save_run(self, run: GradingRunOut) -> GradingRunOut:
        self._runs[run.id] = run
        self._attempt_runs[run.attempt_id] = run.id
        return run

    def get_run(self, run_id: str) -> Optional[GradingRunOut]:
        return self._runs.get(run_id)

    def get_run_by_attempt(self, attempt_id: str) -> Optional[GradingRunOut]:
        run_id = self._attempt_runs.get(attempt_id)
        if run_id:
            return self._runs.get(run_id)
        return None

    def list_runs_for_exam(self, exam_id: str) -> list[GradingRunOut]:
        return [r for r in self._runs.values() if r.exam_id == exam_id]

    def clear_all(self) -> int:
        """Delete all stored runs. Returns the number of runs cleared."""
        count = len(self._runs)
        self._runs.clear()
        self._attempt_runs.clear()
        return count

    def apply_review(
        self,
        attempt_id: str,
        review: GradingReviewDecision,
    ) -> Optional[GradingRunOut]:
        run = self.get_run_by_attempt(attempt_id)
        if not run:
            return None

        # Update the question result if override
        for qr in run.question_results:
            if qr.question_id == review.question_id:
                if review.criteria_overrides:
                    overrides_by_id = {
                        override.criterion_id: override
                        for override in review.criteria_overrides
                    }
                    effective_total = 0.0
                    updated_overrides: list[CriterionReviewOverride] = []

                    for cr in qr.criterion_results:
                        override = overrides_by_id.get(cr.criterion_id)
                        if override:
                            updated_overrides.append(
                                CriterionReviewOverride(
                                    criterion_id=override.criterion_id,
                                    original_score=cr.score,
                                    override_score=override.override_score,
                                    reasoning=override.reasoning,
                                )
                            )
                            if override.override_score is not None:
                                cr.override_score = max(
                                    0.0,
                                    min(override.override_score, cr.max_points),
                                )
                            if override.reasoning is not None:
                                cr.reviewer_rationale = override.reasoning.strip() or None

                        effective_total += (
                            cr.override_score
                            if cr.override_score is not None
                            else cr.score
                        )

                    review.criteria_overrides = updated_overrides
                    if review.override_score is None and qr.criterion_results:
                        qr.raw_score = max(0.0, min(effective_total, qr.max_points))
                        qr.normalized_score = (
                            qr.raw_score / qr.max_points
                            if qr.max_points > 0
                            else 0
                        )

                if review.override_score is not None:
                    qr.raw_score = max(0.0, min(review.override_score, qr.max_points))
                    qr.normalized_score = (
                        qr.raw_score / qr.max_points
                        if qr.max_points > 0
                        else 0
                    )
                qr.status = "reviewed"
                break

        run.reviews.append(review)
        run.total_score = sum(qr.raw_score for qr in run.question_results)
        run.status = GradingRunStatus.REVIEWED
        self._runs[run.id] = run
        return run

    # ---- Rubrics -----------------------------------------------------

    def save_rubric(self, rubric: StructuredRubric) -> StructuredRubric:
        self._rubrics[rubric.question_id] = rubric
        return rubric

    def get_rubric(self, question_id: str) -> Optional[StructuredRubric]:
        return self._rubrics.get(question_id)

    def list_rubrics_for_questions(
        self, question_ids: list[str]
    ) -> dict[str, StructuredRubric]:
        return {
            qid: self._rubrics[qid]
            for qid in question_ids
            if qid in self._rubrics
        }


# Singleton
_store: GradingStore | None = None


def get_grading_store() -> GradingStore:
    global _store
    if _store is None:
        _store = GradingStore()
    return _store
