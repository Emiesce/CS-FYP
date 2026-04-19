"""
HKUST CSE Exam Platform – Grading Settings

Centralised configuration for all grading-related settings.
Model IDs, routing thresholds, concurrency limits, and cost controls.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class GradingSettings:
    """Immutable grading configuration loaded once at startup."""

    # ---- OpenRouter connection ----------------------------------------
    openrouter_api_key: str = os.environ.get("OPENROUTER_API_KEY", "PLACEHOLDER")
    openrouter_base_url: str = os.environ.get(
        "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
    )

    # ---- Model IDs (all configurable via env) -------------------------
    # Per-agent-type models
    short_answer_model: str = os.environ.get(
        "GRADING_SHORT_ANSWER_MODEL", "deepseek/deepseek-v3.2"
    )
    math_model: str = os.environ.get(
        "GRADING_MATH_MODEL", "moonshotai/kimi-k2.5"
    )
    coding_model: str = os.environ.get(
        "GRADING_CODING_MODEL", "deepseek/deepseek-v3.2"
    )
    long_answer_model: str = os.environ.get(
        "GRADING_LONG_ANSWER_MODEL", "deepseek/deepseek-v3.2"
    )
    essay_model: str = os.environ.get(
        "GRADING_ESSAY_MODEL", "deepseek/deepseek-v3.2"
    )
    # Routing model (for future LLM-based routing)
    routing_model: str = os.environ.get(
        "GRADING_ROUTING_MODEL", "meta-llama/llama-3.3-70b-instruct"
    )
    # Evidence highlighting & verification model
    evidence_model: str = os.environ.get(
        "GRADING_EVIDENCE_MODEL", "deepseek/deepseek-v3.2"
    )
    # Verification agent model
    verification_model: str = os.environ.get(
        "GRADING_VERIFICATION_MODEL", "deepseek/deepseek-v3.2"
    )

    # Legacy fallback models (used by lane-based routing)
    cheap_model: str = os.environ.get(
        "GRADING_CHEAP_MODEL", "deepseek/deepseek-v3.2"
    )
    quality_model: str = os.environ.get(
        "GRADING_QUALITY_MODEL", "deepseek/deepseek-v3.2"
    )
    rubric_gen_model: str = os.environ.get(
        "GRADING_RUBRIC_MODEL", "deepseek/deepseek-v3.2"
    )
    rubric_gen_fallback_model: str = os.environ.get(
        "GRADING_RUBRIC_FALLBACK_MODEL", "deepseek/deepseek-v3.2"
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

    # ---- Optional expensive passes ------------------------------------
    enable_verification_pass: bool = os.environ.get(
        "GRADING_ENABLE_VERIFICATION_PASS", "false"
    ).lower() == "true"
    enable_evidence_fallback: bool = os.environ.get(
        "GRADING_ENABLE_EVIDENCE_FALLBACK", "false"
    ).lower() == "true"

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
