"""
HKUST CSE Exam Platform – Long Answer / Essay Grading Agent

Routes directly to quality LLM. Rubric-aware, evidence-aware.
"""

from __future__ import annotations

import json
import logging

from app.models.grading_models import (
    CriterionGradeResult,
    EvidenceSpan,
    GradingLane,
    QuestionGradeResult,
    QuestionGradingStatus,
    StructuredRubric,
    TokenUsage,
)
from app.services.grading.llm.model_registry import get_model_for_lane
from app.services.grading.llm.openrouter_client import get_openrouter_client
from app.services.grading.llm.prompt_templates import (
    GRADING_OUTPUT_SCHEMA,
    GRADING_SYSTEM_PREFIX,
    build_grading_user_prompt,
)

logger = logging.getLogger(__name__)


async def grade_long_answer(
    *,
    question_id: str,
    question_prompt: str,
    question_type: str,          # "long_answer" or "essay"
    student_answer: str,
    max_points: float,
    rubric: StructuredRubric | None = None,
    lecture_context: str | None = None,
    mode: str = "balanced",
) -> QuestionGradeResult:
    """Grade a long-answer or essay question using quality LLM."""

    lane = GradingLane.QUALITY_LLM
    model = get_model_for_lane(lane)
    assert model is not None

    rubric_json = json.dumps(
        [c.model_dump() for c in rubric.criteria] if rubric else [],
        indent=2,
    )

    user_prompt = build_grading_user_prompt(
        question_prompt=question_prompt,
        question_type=question_type,
        rubric_json=rubric_json,
        student_answer=student_answer,
        max_points=max_points,
        lecture_context=lecture_context,
    )

    client = get_openrouter_client()
    result = await client.chat_completion(
        model=model,
        messages=[
            {"role": "system", "content": GRADING_SYSTEM_PREFIX},
            {"role": "user", "content": user_prompt},
        ],
        json_schema=GRADING_OUTPUT_SCHEMA,
        max_tokens=4096,
    )

    try:
        data = json.loads(result["content"])
    except json.JSONDecodeError:
        return QuestionGradeResult(
            question_id=question_id,
            question_type=question_type,
            status=QuestionGradingStatus.ESCALATED,
            lane=lane,
            model=model,
            raw_score=0,
            max_points=max_points,
            normalized_score=0,
            confidence=0,
            rationale="Failed to parse grading output.",
            escalation_notes="Malformed JSON from quality model",
        )

    criterion_results = []
    evidence_spans = []

    for cr in data.get("criterion_results", []):
        spans = [
            EvidenceSpan(
                start_index=s.get("start_index", 0),
                end_index=s.get("end_index", 0),
                quote=s.get("quote", ""),
                criterion_id=s.get("criterion_id", cr.get("criterion_id", "")),
                reason=s.get("reason", ""),
            )
            for s in cr.get("evidence_spans", [])
        ]
        evidence_spans.extend(spans)
        criterion_results.append(
            CriterionGradeResult(
                criterion_id=cr.get("criterion_id", ""),
                criterion_label=cr.get("criterion_label", ""),
                score=cr.get("score", 0),
                max_points=cr.get("max_points", 0),
                rationale=cr.get("rationale", ""),
                evidence_spans=spans,
            )
        )

    usage = result.get("usage")
    token_usage = usage if isinstance(usage, TokenUsage) else None

    raw = data.get("raw_score", 0)
    return QuestionGradeResult(
        question_id=question_id,
        question_type=question_type,
        status=QuestionGradingStatus.GRADED,
        lane=lane,
        model=model,
        raw_score=raw,
        max_points=max_points,
        normalized_score=min(raw / max_points, 1.0) if max_points > 0 else 0,
        confidence=data.get("confidence", 0.5),
        rationale=data.get("rationale", ""),
        criterion_results=criterion_results,
        evidence_spans=evidence_spans,
        latency_ms=result.get("latency_ms"),
        token_usage=token_usage,
    )
