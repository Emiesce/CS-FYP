"""
HKUST CSE Exam Platform – Model Registry

Maps grading lanes and question types to model IDs.
"""

from __future__ import annotations

import itertools
from typing import Optional
from app.models.exam_models import QuestionType
from app.models.grading_models import GradingLane
from app.services.grading.settings import get_grading_settings

# ---------------------------------------------------------------------------
# Round-robin counter for short-answer model rotation.
# itertools.count() is not thread-safe in CPython's GIL sense, but asyncio is
# single-threaded so this is safe for our async grading pipeline.
# ---------------------------------------------------------------------------
_short_answer_counter = itertools.count()
_coding_counter = itertools.count()
_math_counter = itertools.count()


def get_short_answer_model() -> str:
    """Return the next model from the short-answer rotation pool (round-robin)."""
    pool = get_grading_settings().short_answer_models
    idx = next(_short_answer_counter) % len(pool)
    return pool[idx]


def get_coding_model() -> str:
    """Return the next model from the coding rotation pool (round-robin)."""
    pool = get_grading_settings().coding_models
    idx = next(_coding_counter) % len(pool)
    return pool[idx]


def get_math_model() -> str:
    """Return the next model from the math rotation pool (round-robin)."""
    pool = get_grading_settings().math_models
    idx = next(_math_counter) % len(pool)
    return pool[idx]


def _peer_model(model: str, pool: list[str]) -> str | None:
    """Return the other model in the pool (the one that isn't `model`), or None."""
    others = [m for m in pool if m != model]
    return others[0] if others else None


def get_model_for_question_type(question_type: QuestionType) -> str:
    """Return the model ID for a given question type."""
    s = get_grading_settings()
    mapping = {
        QuestionType.SHORT_ANSWER: s.short_answer_model,
        QuestionType.MATHEMATICS: s.math_model,
        QuestionType.CODING: s.coding_model,
        QuestionType.LONG_ANSWER: s.long_answer_model,
        QuestionType.ESSAY: s.essay_model,
    }
    return mapping.get(question_type, s.cheap_model)


def get_model_for_lane(lane: GradingLane) -> Optional[str]:
    """Return the model ID for a given grading lane, or None for deterministic."""
    s = get_grading_settings()
    if lane == GradingLane.DETERMINISTIC:
        return None
    if lane == GradingLane.CHEAP_LLM:
        return s.cheap_model
    if lane == GradingLane.QUALITY_LLM:
        return s.quality_model
    if lane == GradingLane.ESCALATED:
        return s.quality_model
    return s.cheap_model


def get_evidence_model() -> str:
    """Return the model ID for evidence highlighting and verification."""
    return get_grading_settings().evidence_model


def select_lane(
    question_type: QuestionType,
    *,
    has_exact_answer: bool = False,
    high_stakes: bool = False,
    mode: str = "balanced",
) -> GradingLane:
    """Choose the default grading lane based on question type and context."""

    # Deterministic-first: MCQ is always deterministic
    if question_type == QuestionType.MCQ:
        return GradingLane.DETERMINISTIC

    # Exact-match short answers or simple math
    if has_exact_answer and question_type in (
        QuestionType.SHORT_ANSWER,
        QuestionType.MATHEMATICS,
    ):
        return GradingLane.DETERMINISTIC

    # Quality-first mode or high-stakes → always quality
    if mode == "quality_first" or high_stakes:
        return GradingLane.QUALITY_LLM

    # Low-cost mode → always cheap
    if mode == "low_cost":
        return GradingLane.CHEAP_LLM

    # Balanced: route by question type
    if question_type in (QuestionType.SHORT_ANSWER, QuestionType.MATHEMATICS):
        return GradingLane.CHEAP_LLM

    if question_type in (
        QuestionType.LONG_ANSWER,
        QuestionType.ESSAY,
        QuestionType.CODING,
    ):
        return GradingLane.QUALITY_LLM

    return GradingLane.CHEAP_LLM
