"""
HKUST CSE Exam Platform – Evidence Highlighting Agent

Identifies answer spans that justify criterion scores.
Invoked only when existing evidence is missing or weak.
"""

from __future__ import annotations

import json
import logging

from app.models.grading_models import EvidenceSpan, QuestionGradeResult
from app.services.grading.llm.openrouter_client import get_openrouter_client
from app.services.grading.llm.prompt_templates import (
    EVIDENCE_OUTPUT_SCHEMA,
    EVIDENCE_SYSTEM_PREFIX,
    build_evidence_user_prompt,
)
from app.services.grading.settings import get_grading_settings

logger = logging.getLogger(__name__)


def needs_evidence_pass(result: QuestionGradeResult) -> bool:
    """Check if a grading result needs an additional evidence highlighting pass."""
    # Skip deterministic results — evidence is trivial
    if result.lane == "deterministic":
        return False
    # If we already have evidence for most criteria, skip
    criteria_with_evidence = {
        s.criterion_id for s in result.evidence_spans
    }
    criteria_ids = {cr.criterion_id for cr in result.criterion_results}
    # Need evidence pass if less than half of criteria have evidence
    if not criteria_ids:
        return False
    coverage = len(criteria_with_evidence & criteria_ids) / len(criteria_ids)
    return coverage < 0.5


async def add_evidence(
    *,
    student_answer: str,
    grading_result: QuestionGradeResult,
) -> list[EvidenceSpan]:
    """
    Run a separate evidence extraction pass.
    Returns updated evidence spans.
    """
    settings = get_grading_settings()
    client = get_openrouter_client()

    grading_json = json.dumps(
        {
            "raw_score": grading_result.raw_score,
            "criterion_results": [
                {
                    "criterion_id": cr.criterion_id,
                    "criterion_label": cr.criterion_label,
                    "score": cr.score,
                    "max_points": cr.max_points,
                    "rationale": cr.rationale,
                }
                for cr in grading_result.criterion_results
            ],
        },
        indent=2,
    )

    user_prompt = build_evidence_user_prompt(
        student_answer=student_answer,
        grading_result_json=grading_json,
    )

    result = await client.chat_completion(
        model=settings.evidence_model,
        messages=[
            {"role": "system", "content": EVIDENCE_SYSTEM_PREFIX},
            {"role": "user", "content": user_prompt},
        ],
        json_schema=EVIDENCE_OUTPUT_SCHEMA,
        max_tokens=2048,
    )

    try:
        data = json.loads(result["content"])
    except json.JSONDecodeError:
        logger.warning("Evidence extraction returned malformed JSON")
        return grading_result.evidence_spans

    spans = []
    for s in data.get("evidence_spans", []):
        spans.append(
            EvidenceSpan(
                start_index=s.get("start_index", 0),
                end_index=s.get("end_index", 0),
                quote=s.get("quote", ""),
                criterion_id=s.get("criterion_id", ""),
                reason=s.get("reason", ""),
            )
        )

    return spans if spans else grading_result.evidence_spans
