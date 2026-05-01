"""
HKUST CSE Exam Platform – Mathematics Grading Agent

Tries numeric exact-match first, then uses LLM for explanation/reasoning answers.
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
from app.models.exam_models import QuestionType  # noqa: F401 – kept for type hints in callers
from app.services.grading.llm.json_extraction import extract_json_dict
from app.services.grading.grading_agents.deterministic import grade_numeric_match
from app.services.grading.llm.model_registry import get_math_model, _peer_model
from app.services.grading.settings import get_grading_settings
from app.services.grading.llm.openrouter_client import get_openrouter_client
from app.services.grading.llm.prompt_templates import (
    GRADING_OUTPUT_SCHEMA,
    GRADING_SYSTEM_PREFIX,
    build_grading_user_prompt,
)

logger = logging.getLogger(__name__)


async def grade_mathematics(
    *,
    question_id: str,
    question_prompt: str,
    student_answer: str,
    max_points: float,
    rubric: StructuredRubric | None = None,
    expected_values: list[str] | None = None,
    lecture_context: str | None = None,
    mode: str = "balanced",
    use_cache: bool = True,
) -> QuestionGradeResult:
    """Grade a mathematics question."""

    # ---- Deterministic numeric match ----
    if expected_values:
        det = grade_numeric_match(
            student_answer=student_answer,
            expected_values=expected_values,
            max_points=max_points,
        )
        if det is not None:
            det.question_id = question_id
            return det

    # ---- LLM path ----
    lane = GradingLane.CHEAP_LLM if mode != "quality_first" else GradingLane.QUALITY_LLM
    model = get_math_model()
    peer = _peer_model(model, get_grading_settings().math_models)
    fallback = peer if peer != model else get_grading_settings().quality_fallback_model
    assert model is not None

    rubric_json = json.dumps(
        [c.model_dump() for c in rubric.criteria] if rubric else [],
        indent=2,
    )

    user_prompt = build_grading_user_prompt(
        question_prompt=question_prompt,
        question_type="mathematics",
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
        max_tokens=8192,
        fallback_model=fallback,
        use_cache=use_cache,
    )

    try:
        data = extract_json_dict(result["content"], context=f"math:{question_id}")
    except ValueError as parse_err:
        logger.warning("Math parse error for %s: %s", question_id, parse_err)
        return QuestionGradeResult(
            question_id=question_id,
            question_type="mathematics",
            status=QuestionGradingStatus.ESCALATED,
            lane=lane,
            model=model,
            raw_score=0,
            max_points=max_points,
            normalized_score=0,
            confidence=0,
            rationale="Failed to parse grading output.",
            student_answer=student_answer,
            escalation_notes=f"Malformed JSON from model: {parse_err}",
        )

    # Build result
    criterion_results = []
    evidence_spans = []
    for cr in data.get("criterion_results", []):
        spans = [
            EvidenceSpan(
                start_index=max(0, s.get("start_index", 0)),
                end_index=max(0, s.get("end_index", 0)),
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
        question_type="mathematics",
        status=QuestionGradingStatus.GRADED,
        lane=lane,
        model=model,
        raw_score=raw,
        max_points=max_points,
        normalized_score=min(raw / max_points, 1.0) if max_points > 0 else 0,
        confidence=1.0,
        rationale=data.get("rationale", ""),
        student_answer=student_answer,
        criterion_results=criterion_results,
        evidence_spans=evidence_spans,
        latency_ms=result.get("latency_ms"),
        token_usage=token_usage,
    )
