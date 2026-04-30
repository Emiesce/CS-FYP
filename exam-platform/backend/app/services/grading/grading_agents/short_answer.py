"""
HKUST CSE Exam Platform – Short Answer Grading Agent

Tries deterministic exact-match first, then uses cheap LLM with escalation.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.models.grading_models import (
    CriterionGradeResult,
    EvidenceSpan,
    GradingLane,
    QuestionGradeResult,
    QuestionGradingStatus,
    StructuredRubric,
    TokenUsage,
)
from app.models.exam_models import QuestionType
from app.services.grading.grading_agents.deterministic import grade_exact_match
from app.services.grading.llm.json_extraction import extract_json_dict
from app.services.grading.llm.model_registry import get_model_for_lane, get_model_for_question_type
from app.services.grading.llm.openrouter_client import get_openrouter_client
from app.services.grading.llm.prompt_templates import (
    GRADING_OUTPUT_SCHEMA,
    GRADING_SYSTEM_PREFIX,
    build_grading_user_prompt,
)

logger = logging.getLogger(__name__)


async def grade_short_answer(
    *,
    question_id: str,
    question_prompt: str,
    student_answer: str,
    max_points: float,
    rubric: StructuredRubric | None = None,
    acceptable_answers: list[str] | None = None,
    lecture_context: str | None = None,
    mode: str = "balanced",
    use_cache: bool = True,
) -> QuestionGradeResult:
    """Grade a short-answer question."""

    # ---- Deterministic path ----
    if acceptable_answers:
        det = grade_exact_match(
            student_answer=student_answer,
            acceptable_answers=acceptable_answers,
            max_points=max_points,
        )
        if det is not None:
            det.question_id = question_id
            return det

    # ---- LLM path ----
    lane = GradingLane.CHEAP_LLM if mode != "quality_first" else GradingLane.QUALITY_LLM
    model = get_model_for_question_type(QuestionType.SHORT_ANSWER)
    assert model is not None

    rubric_json = json.dumps(
        [c.model_dump() for c in rubric.criteria] if rubric else [],
        indent=2,
    )

    user_prompt = build_grading_user_prompt(
        question_prompt=question_prompt,
        question_type="short_answer",
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
        use_cache=use_cache,
    )

    try:
        data = extract_json_dict(result["content"], context=f"short_answer:{question_id}")
    except ValueError as parse_err:
        repaired = await _repair_json_response(
            client=client,
            model=model,
            original_messages=[
                {"role": "system", "content": GRADING_SYSTEM_PREFIX},
                {"role": "user", "content": user_prompt},
            ],
            bad_content=result["content"],
            context=f"short_answer_repair:{question_id}",
        )
        if repaired is not None:
            return _build_result(
                repaired,
                question_id,
                model,
                lane,
                result,
                max_points_override=max_points,
                student_answer=student_answer,
            )
        logger.warning("Short-answer parse error for %s: %s", question_id, parse_err)
        # Escalate on malformed output
        return await _escalate(
            question_id=question_id,
            question_prompt=question_prompt,
            student_answer=student_answer,
            max_points=max_points,
            rubric=rubric,
            lecture_context=lecture_context,
            reason=f"Malformed JSON from model: {parse_err}",
        )

    return _build_result(
        data,
        question_id,
        model,
        lane,
        result,
        max_points_override=max_points,
        student_answer=student_answer,
    )


async def _escalate(
    *,
    question_id: str,
    question_prompt: str,
    student_answer: str,
    max_points: float,
    rubric: StructuredRubric | None,
    lecture_context: str | None,
    reason: str,
) -> QuestionGradeResult:
    """Escalate to quality model."""
    logger.info("Escalating short_answer %s: %s", question_id, reason)

    lane = GradingLane.ESCALATED
    model = get_model_for_lane(lane)
    assert model is not None

    rubric_json = json.dumps(
        [c.model_dump() for c in rubric.criteria] if rubric else [],
        indent=2,
    )

    user_prompt = build_grading_user_prompt(
        question_prompt=question_prompt,
        question_type="short_answer",
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
        use_cache=use_cache,
    )

    try:
        data = extract_json_dict(result["content"], context=f"short_answer_escalated:{question_id}")
    except (json.JSONDecodeError, ValueError):
        repaired = await _repair_json_response(
            client=client,
            model=model,
            original_messages=[
                {"role": "system", "content": GRADING_SYSTEM_PREFIX},
                {"role": "user", "content": user_prompt},
            ],
            bad_content=result["content"],
            context=f"short_answer_escalated_repair:{question_id}",
        )
        if repaired is not None:
            qr = _build_result(
                repaired,
                question_id,
                model,
                lane,
                result,
                max_points_override=max_points,
                student_answer=student_answer,
            )
            qr.escalation_notes = reason
            return qr
        return QuestionGradeResult(
            question_id=question_id,
            question_type="short_answer",
            status=QuestionGradingStatus.ESCALATED,
            lane=lane,
            model=model,
            raw_score=0,
            max_points=max_points,
            normalized_score=0,
            confidence=0,
            rationale="Failed to parse grading output after escalation.",
            student_answer=student_answer,
            escalation_notes=reason,
        )

    qr = _build_result(
        data,
        question_id,
        model,
        lane,
        result,
        max_points_override=max_points,
        student_answer=student_answer,
    )
    qr.escalation_notes = reason
    return qr


async def _repair_json_response(
    *,
    client,
    model: str,
    original_messages: list[dict[str, str]],
    bad_content: str,
    context: str,
) -> dict[str, Any] | None:
    """Ask the model to repair a malformed grading response into valid JSON."""
    repair_messages = [
        *original_messages,
        {"role": "assistant", "content": bad_content or ""},
        {
            "role": "user",
            "content": (
                "Your previous response was invalid. "
                "Return ONLY one valid JSON object that matches the required schema exactly. "
                "Do not output a number, markdown, explanation, or code fence."
            ),
        },
    ]
    repair_result = await client.chat_completion(
        model=model,
        messages=repair_messages,
        json_schema=GRADING_OUTPUT_SCHEMA,
        max_tokens=2048,
        use_cache=False,
        max_retries=1,
    )
    try:
        return extract_json_dict(repair_result["content"], context=context)
    except ValueError:
        return None


def _build_result(
    data: dict,
    question_id: str,
    model: str,
    lane: GradingLane,
    api_result: dict,
    max_points_override: float = 0,
    student_answer: str | None = None,
) -> QuestionGradeResult:
    """Build a QuestionGradeResult from parsed JSON."""
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

    usage = api_result.get("usage")
    token_usage = None
    if usage and isinstance(usage, TokenUsage):
        token_usage = usage

    mp = max_points_override if max_points_override > 0 else data.get("max_points", 0)
    raw = data.get("raw_score", 0)
    return QuestionGradeResult(
        question_id=question_id,
        question_type="short_answer",
        status=QuestionGradingStatus.GRADED,
        lane=lane,
        model=model,
        raw_score=raw,
        max_points=mp,
        normalized_score=min(raw / mp, 1.0) if mp > 0 else 0,
        confidence=1.0,
        rationale=data.get("rationale", ""),
        student_answer=student_answer,
        criterion_results=criterion_results,
        evidence_spans=evidence_spans,
        latency_ms=api_result.get("latency_ms"),
        token_usage=token_usage,
    )
