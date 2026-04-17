"""
HKUST CSE Exam Platform – Rubric Generation

AI-powered rubric generation with validation and escalation.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any

from app.models.grading_models import (
    RubricCriterion,
    RubricScoreBand,
    StructuredRubric,
)
from app.services.grading.llm.openrouter_client import get_openrouter_client
from app.services.grading.llm.prompt_templates import (
    RUBRIC_GENERATION_SYSTEM_PREFIX,
    RUBRIC_OUTPUT_SCHEMA,
    build_rubric_generation_prompt,
)
from app.services.grading.settings import get_grading_settings

logger = logging.getLogger(__name__)


def _validate_rubric(data: dict[str, Any], expected_points: float) -> list[str]:
    """Validate rubric structure and return list of issues."""
    issues: list[str] = []
    criteria = data.get("criteria", [])
    if not criteria:
        issues.append("Rubric has no criteria.")
        return issues

    total = 0.0
    for i, c in enumerate(criteria):
        if not c.get("id"):
            issues.append(f"Criterion {i} missing id.")
        if not c.get("label"):
            issues.append(f"Criterion {i} missing label.")
        mp = c.get("max_points", 0)
        if mp <= 0:
            issues.append(f"Criterion '{c.get('label', i)}' has non-positive max_points.")
        total += mp
        bands = c.get("score_bands", [])
        if len(bands) < 2:
            issues.append(f"Criterion '{c.get('label', i)}' needs at least 2 score bands.")

    if abs(total - expected_points) > 0.01:
        issues.append(
            f"Criteria total ({total}) does not match question points ({expected_points})."
        )

    return issues


def _parse_rubric(
    raw_json: str, question_id: str, expected_points: float
) -> tuple[StructuredRubric | None, list[str]]:
    """Parse raw JSON into a StructuredRubric. Returns (rubric, issues)."""
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        return None, [f"Invalid JSON: {e}"]

    issues = _validate_rubric(data, expected_points)
    if issues:
        return None, issues

    criteria = []
    for c in data["criteria"]:
        bands = [
            RubricScoreBand(
                label=b["label"],
                min_points=b["min_points"],
                max_points=b["max_points"],
                description=b.get("description", ""),
            )
            for b in c.get("score_bands", [])
        ]
        criteria.append(
            RubricCriterion(
                id=c["id"],
                label=c["label"],
                description=c.get("description", ""),
                max_points=c["max_points"],
                score_bands=bands,
            )
        )

    rubric = StructuredRubric(
        question_id=question_id,
        criteria=criteria,
        total_points=data.get("total_points", expected_points),
        version=1,
    )
    return rubric, []


async def generate_rubric(
    *,
    question_id: str,
    question_prompt: str,
    question_type: str,
    points: float,
    instructor_notes: str | None = None,
    support_text: str | None = None,
) -> tuple[StructuredRubric, str, int]:
    """
    Generate a structured rubric for a question.

    Returns (rubric, model_used, latency_ms).
    Tries cheap model first, escalates on validation failure.
    """
    settings = get_grading_settings()
    client = get_openrouter_client()

    user_prompt = build_rubric_generation_prompt(
        question_prompt=question_prompt,
        question_type=question_type,
        points=points,
        instructor_notes=instructor_notes,
        support_text=support_text,
    )

    messages = [
        {"role": "system", "content": RUBRIC_GENERATION_SYSTEM_PREFIX},
        {"role": "user", "content": user_prompt},
    ]

    # Attempt 1: cheap model
    model = settings.rubric_gen_model
    t0 = time.monotonic()

    result = await client.chat_completion(
        model=model,
        messages=messages,
        json_schema=RUBRIC_OUTPUT_SCHEMA,
        max_tokens=2048,
    )

    rubric, issues = _parse_rubric(result["content"], question_id, points)

    if rubric is not None:
        latency = int((time.monotonic() - t0) * 1000)
        rubric.generated_by = model
        return rubric, model, latency

    # Escalation: use fallback model with repair prompt
    logger.warning(
        "Rubric generation failed validation with %s: %s. Escalating to %s.",
        model,
        issues,
        settings.rubric_gen_fallback_model,
    )

    model = settings.rubric_gen_fallback_model
    repair_msg = (
        f"The previous rubric had validation issues: {issues}. "
        "Please fix these issues and regenerate the rubric."
    )
    messages.append({"role": "assistant", "content": result["content"]})
    messages.append({"role": "user", "content": repair_msg})

    result = await client.chat_completion(
        model=model,
        messages=messages,
        json_schema=RUBRIC_OUTPUT_SCHEMA,
        max_tokens=2048,
    )

    rubric, issues = _parse_rubric(result["content"], question_id, points)
    latency = int((time.monotonic() - t0) * 1000)

    if rubric is not None:
        rubric.generated_by = model
        return rubric, model, latency

    raise ValueError(
        f"Rubric generation failed after escalation. Issues: {issues}"
    )
