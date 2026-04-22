"""
DeepEval Grading Quality Test Suite

Evaluates LLM grading agent output quality using deepeval metrics.
Requires OPENROUTER_API_KEY to be set; skips otherwise.

Run:
    cd exam-platform/backend
    python -m pytest "app/services/grading/grading_test_case/test_deepeval_grading.py" -v
"""

from __future__ import annotations

import asyncio
import os

# Force reliable math model before any grading settings are imported.
# moonshotai/kimi-k2.5 consistently returns empty content in test runs.
os.environ["GRADING_MATH_MODEL"] = "deepseek/deepseek-v3.2"

import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase

from app.services.grading.grading_test_case.deepeval_metrics import (
    CriterionConsistencyMetric,
    ScoreRangeMetric,
)
from app.services.grading.grading_test_case.grading_test_dataset import (
    GRADING_TEST_CASES,
    GradingTestCase,
)

# ---------------------------------------------------------------------------
# Module-level skip when API key is absent
# ---------------------------------------------------------------------------

if not os.environ.get("OPENROUTER_API_KEY"):
    pytest.skip(
        "OPENROUTER_API_KEY is not set – skipping deepeval grading tests",
        allow_module_level=True,
    )

# ---------------------------------------------------------------------------
# Fast mode: one case per question type (DEEPEVAL_FAST=1 → 4 API calls)
# ---------------------------------------------------------------------------

_ALL_CASES = GRADING_TEST_CASES

if os.environ.get("DEEPEVAL_FAST") == "1":
    _seen: set[str] = set()
    _fast_cases: list[GradingTestCase] = []
    for _tc in _ALL_CASES:
        if _tc.question_type not in _seen:
            _seen.add(_tc.question_type)
            _fast_cases.append(_tc)
    _ALL_CASES = _fast_cases

# ---------------------------------------------------------------------------
# Per-test event loop + fresh httpx client fixture
# ---------------------------------------------------------------------------

@pytest.fixture()
def event_loop():
    """
    Create a fresh event loop per test and reset the OpenRouter client singleton.
    deepeval's assert_test closes the loop after running; the singleton httpx client
    would be bound to the old closed loop on the next test without this reset.
    """
    import app.services.grading.llm.openrouter_client as _oc_module

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    if _oc_module._client is not None:
        try:
            loop.run_until_complete(_oc_module._client.close())
        except Exception:
            pass
        _oc_module._client = None

    yield loop
    loop.close()

# ---------------------------------------------------------------------------
# Grading agent dispatch
# ---------------------------------------------------------------------------

async def _run_grading_agent(tc: GradingTestCase):
    """Call the appropriate grading agent and return the result."""
    from app.services.grading.grading_agents.coding import grade_coding
    from app.services.grading.grading_agents.long_answer import grade_long_answer
    from app.services.grading.grading_agents.mathematics import grade_mathematics
    from app.services.grading.grading_agents.short_answer import grade_short_answer

    qt = tc.question_type

    if qt == "short_answer":
        return await grade_short_answer(
            question_id=tc.id,
            question_prompt=tc.question_prompt,
            student_answer=tc.student_answer,
            max_points=tc.max_points,
            rubric=tc.rubric,
        )
    elif qt in ("long_answer", "essay"):
        return await grade_long_answer(
            question_id=tc.id,
            question_prompt=tc.question_prompt,
            question_type=qt,
            student_answer=tc.student_answer,
            max_points=tc.max_points,
            rubric=tc.rubric,
        )
    elif qt == "coding":
        return await grade_coding(
            question_id=tc.id,
            question_prompt=tc.question_prompt,
            student_answer=tc.student_answer,
            max_points=tc.max_points,
            language=tc.language or "python",
            rubric=tc.rubric,
        )
    elif qt == "mathematics":
        return await grade_mathematics(
            question_id=tc.id,
            question_prompt=tc.question_prompt,
            student_answer=tc.student_answer,
            max_points=tc.max_points,
            rubric=tc.rubric,
        )
    else:
        raise ValueError(f"Unknown question_type: {qt!r}")


# ---------------------------------------------------------------------------
# Parametrized test
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("tc", _ALL_CASES, ids=[tc.id for tc in _ALL_CASES])
def test_grading_quality(tc: GradingTestCase, event_loop: asyncio.AbstractEventLoop) -> None:
    """
    For each GradingTestCase:
      1. Call the appropriate grading agent.
      2. Build an LLMTestCase with score metadata.
      3. Assert ScoreRangeMetric + CriterionConsistencyMetric always pass.
      4. Optionally assert GEval rationale quality when DEEPEVAL_ENABLE_GEVAL=1.
    """
    result = event_loop.run_until_complete(_run_grading_agent(tc))

    criterion_dicts = [
        {
            "criterion_id": cr.criterion_id,
            "criterion_label": cr.criterion_label,
            "score": cr.score,
            "max_points": cr.max_points,
        }
        for cr in (result.criterion_results or [])
    ]

    llm_test_case = LLMTestCase(
        input=f"{tc.question_prompt}\n\nStudent Answer: {tc.student_answer}",
        actual_output=result.rationale or "",
        additional_metadata={
            "normalized_score": result.normalized_score,
            "min": tc.min_expected_score,
            "max": tc.max_expected_score,
            "criterion_results": criterion_dicts,
            "raw_score": result.raw_score,
        },
    )

    metrics = [ScoreRangeMetric(), CriterionConsistencyMetric()]

    if os.environ.get("DEEPEVAL_ENABLE_GEVAL") == "1":
        from deepeval.metrics import GEval
        from deepeval.test_case import LLMTestCaseParams

        metrics.append(GEval(
            name="Rationale Quality",
            criteria=(
                "The rationale should reference specific content from the student's answer, "
                "explain why the score was assigned, and align with the rubric criteria provided."
            ),
            evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
            threshold=0.6,
        ))

    assert_test(llm_test_case, metrics)
