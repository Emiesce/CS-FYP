"""
Custom DeepEval Metrics for Grading Quality Assessment

Provides two always-on, non-LLM metrics:
  - ScoreRangeMetric: asserts normalized_score is within [min, max]
  - CriterionConsistencyMetric: asserts sum of criterion scores is within 0.5 of raw_score
"""

from __future__ import annotations

from deepeval.metrics import BaseMetric
from deepeval.test_case import LLMTestCase


class ScoreRangeMetric(BaseMetric):
    """
    Asserts that the grading agent's normalized_score falls within the
    expected [min_expected, max_expected] range defined in additional_metadata.

    Expected additional_metadata keys:
        normalized_score (float): the score produced by the grading agent, 0.0–1.0
        min (float): minimum acceptable normalized score
        max (float): maximum acceptable normalized score
    """

    name = "Score Range"
    threshold = 0.5  # binary pass/fail: score is 1.0 (pass) or 0.0 (fail)

    def measure(self, test_case: LLMTestCase) -> float:
        metadata = test_case.additional_metadata or {}
        normalized_score: float = metadata.get("normalized_score", 0.0)
        min_expected: float = metadata.get("min", 0.0)
        max_expected: float = metadata.get("max", 1.0)

        in_range = min_expected <= normalized_score <= max_expected
        self.score = 1.0 if in_range else 0.0
        self.success = self.score >= self.threshold

        if in_range:
            self.reason = (
                f"normalized_score={normalized_score:.3f} is within "
                f"[{min_expected}, {max_expected}]"
            )
        else:
            self.reason = (
                f"normalized_score={normalized_score:.3f} is outside "
                f"[{min_expected}, {max_expected}]"
            )

        return self.score

    async def a_measure(self, test_case: LLMTestCase, *args, **kwargs) -> float:
        return self.measure(test_case)

    def is_successful(self) -> bool:
        return self.success


class CriterionConsistencyMetric(BaseMetric):
    """
    Asserts that the sum of per-criterion scores is within 0.5 of the
    reported raw_score, catching cases where the LLM produces inconsistent
    criterion-level and total scores.

    Expected additional_metadata keys:
        criterion_results (list[dict]): each dict must have a "score" key
        raw_score (float): the total raw score reported by the grading agent
    """

    name = "Criterion Consistency"
    threshold = 0.5  # binary pass/fail

    def measure(self, test_case: LLMTestCase) -> float:
        metadata = test_case.additional_metadata or {}
        criterion_results: list[dict] = metadata.get("criterion_results", [])
        raw_score: float = metadata.get("raw_score", 0.0)

        if not criterion_results:
            self.score = 1.0
            self.success = True
            self.reason = "No criterion_results to validate; consistency check skipped."
            return self.score

        criterion_sum = sum(float(c.get("score", 0.0)) for c in criterion_results)
        diff = abs(criterion_sum - raw_score)
        consistent = diff <= 0.5

        self.score = 1.0 if consistent else 0.0
        self.success = self.score >= self.threshold
        self.reason = (
            f"sum(criterion scores)={criterion_sum:.3f}, raw_score={raw_score:.3f}, "
            f"diff={diff:.3f} ({'within' if consistent else 'exceeds'} 0.5 tolerance)"
        )

        return self.score

    async def a_measure(self, test_case: LLMTestCase, *args, **kwargs) -> float:
        return self.measure(test_case)

    def is_successful(self) -> bool:
        return self.success
