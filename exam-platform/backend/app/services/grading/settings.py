"""
HKUST CSE Exam Platform – Grading Settings

Centralised configuration for all grading-related settings.
Model IDs, routing thresholds, concurrency limits, and cost controls.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class GradingSettings:
    """Immutable grading configuration loaded once at startup."""

    # ---- OpenRouter connection ----------------------------------------
    openrouter_api_key: str = os.environ.get("OPENROUTER_API_KEY", "PLACEHOLDER")
    openrouter_base_url: str = os.environ.get(
        "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
    )

    # ---- Model IDs (all configurable via env) -------------------------
    cheap_model: str = os.environ.get(
        "GRADING_CHEAP_MODEL", "deepseek/deepseek-chat-v3-0324"
    )
    quality_model: str = os.environ.get(
        "GRADING_QUALITY_MODEL", "deepseek/deepseek-chat-v3-0324"
    )
    rubric_gen_model: str = os.environ.get(
        "GRADING_RUBRIC_MODEL", "deepseek/deepseek-chat-v3-0324"
    )
    rubric_gen_fallback_model: str = os.environ.get(
        "GRADING_RUBRIC_FALLBACK_MODEL", "deepseek/deepseek-chat-v3-0324"
    )

    # ---- Routing thresholds -------------------------------------------
    confidence_threshold: float = float(
        os.environ.get("GRADING_CONFIDENCE_THRESHOLD", "0.7")
    )
    escalation_max_retries: int = int(
        os.environ.get("GRADING_ESCALATION_MAX_RETRIES", "2")
    )

    # ---- Concurrency --------------------------------------------------
    cheap_concurrency: int = int(os.environ.get("GRADING_CHEAP_CONCURRENCY", "10"))
    quality_concurrency: int = int(
        os.environ.get("GRADING_QUALITY_CONCURRENCY", "3")
    )
    embedding_concurrency: int = int(
        os.environ.get("GRADING_EMBEDDING_CONCURRENCY", "5")
    )

    # ---- Cost mode (low_cost | balanced | quality_first) ---------------
    default_mode: str = os.environ.get("GRADING_DEFAULT_MODE", "balanced")

    # ---- Token budgets ------------------------------------------------
    max_answer_tokens: int = int(
        os.environ.get("GRADING_MAX_ANSWER_TOKENS", "4096")
    )
    max_rubric_context_tokens: int = int(
        os.environ.get("GRADING_MAX_RUBRIC_CONTEXT_TOKENS", "2048")
    )
    max_lecture_context_tokens: int = int(
        os.environ.get("GRADING_MAX_LECTURE_CONTEXT_TOKENS", "1024")
    )


# Singleton — reset on reload
_settings = None


def get_grading_settings() -> GradingSettings:
    global _settings
    if _settings is None:
        _settings = GradingSettings()
    return _settings


def reset_grading_settings() -> None:
    global _settings
    _settings = None
