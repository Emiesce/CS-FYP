"""
HKUST CSE Exam Platform – Grading Orchestrator

LangGraph-based multi-agent grading workflow with typed state,
question-level fan-out/fan-in, routing, evidence highlighting,
and verification.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime
from typing import Any, Callable, Coroutine, Optional, TypedDict

from langgraph.graph import END, StateGraph

from app.models.exam_models import (
    ExamDefinitionOut,
    ExamAttemptOut,
    ExamQuestionIn,
    QuestionType,
)
from app.models.grading_models import (
    GradingLane,
    GradingRunOut,
    GradingRunRequest,
    GradingRunStatus,
    ModelUsageRecord,
    QuestionGradeResult,
    QuestionGradingStatus,
    StructuredRubric,
)
from app.services.grading.evidence_highlighting import add_evidence, needs_evidence_pass
from app.services.grading.grading_agents.mcq import grade_mcq_question
from app.services.grading.grading_agents.short_answer import grade_short_answer
from app.services.grading.grading_agents.long_answer import grade_long_answer
from app.services.grading.grading_agents.coding import grade_coding
from app.services.grading.grading_agents.mathematics import grade_mathematics
from app.services.grading.routing import route_question
from app.services.grading.settings import get_grading_settings
from app.services.grading.validation.output_validation import (
    validate_grade_result,
    validate_grading_run_totals,
)
from app.services.grading.validation.score_consistency import clamp_scores

logger = logging.getLogger(__name__)


# ---- LangGraph State -------------------------------------------------

class GradingState(TypedDict):
    """Typed state passed through the grading graph."""
    exam: ExamDefinitionOut
    attempt: ExamAttemptOut
    rubrics: dict[str, StructuredRubric]
    mode: str
    question_results: list[QuestionGradeResult]
    model_usage: list[ModelUsageRecord]
    status: str
    errors: list[str]


# ---- Node: Intake & Normalisation ------------------------------------

async def intake_node(state: GradingState) -> GradingState:
    """Validate inputs and prepare for grading."""
    exam = state["exam"]
    attempt = state["attempt"]

    if not attempt.responses:
        state["errors"].append("No responses in attempt")
        state["status"] = GradingRunStatus.FAILED.value
        return state

    state["status"] = GradingRunStatus.IN_PROGRESS.value
    return state


# ---- Node: Fan-out grading per question ------------------------------

async def grade_questions_node(state: GradingState) -> GradingState:
    """Grade all questions in parallel."""
    exam = state["exam"]
    attempt = state["attempt"]
    rubrics = state["rubrics"]
    mode = state["mode"]
    settings = get_grading_settings()

    # Build lookup maps
    question_map: dict[str, ExamQuestionIn] = {q.id: q for q in exam.questions}
    response_map: dict[str, Any] = {r.question_id: r for r in attempt.responses}

    # Create grading tasks
    tasks = []
    task_question_ids: list[str] = []  # track which question each task belongs to
    task_questions: list[ExamQuestionIn] = []
    for question in exam.questions:
        response = response_map.get(question.id)
        if response is None:
            # Unanswered → zero score
            state["question_results"].append(
                QuestionGradeResult(
                    question_id=question.id,
                    question_type=question.type_data.type,
                    status=QuestionGradingStatus.GRADED,
                    lane=GradingLane.DETERMINISTIC,
                    raw_score=0,
                    max_points=question.points,
                    normalized_score=0,
                    confidence=1.0,
                    rationale="Question was not answered.",
                )
            )
            continue

        rubric = rubrics.get(question.id)
        student_answer = response.value if isinstance(response.value, str) else response.value
        q_type = question.type_data.type

        tasks.append(
            _grade_single_question(
                question=question,
                student_answer=student_answer,
                rubric=rubric,
                mode=mode,
            )
        )
        task_question_ids.append(question.id)
        task_questions.append(question)

    # Fan-out: run all grading tasks concurrently with concurrency limits
    cheap_sem = asyncio.Semaphore(settings.cheap_concurrency)
    quality_sem = asyncio.Semaphore(settings.quality_concurrency)

    results = await asyncio.gather(*tasks, return_exceptions=True)

    for i, r in enumerate(results):
        if isinstance(r, Exception):
            qid = task_question_ids[i]
            q = task_questions[i]
            logger.error("Grading task failed for %s: %s", qid, r)
            state["errors"].append(f"{qid}: {r}")
            # Create a fallback result so the question isn't lost
            state["question_results"].append(
                QuestionGradeResult(
                    question_id=qid,
                    question_type=q.type_data.type,
                    status=QuestionGradingStatus.ESCALATED,
                    lane=GradingLane.QUALITY_LLM,
                    raw_score=0,
                    max_points=q.points,
                    normalized_score=0,
                    confidence=0,
                    rationale=f"Grading failed: {r}",
                    escalation_notes=str(r),
                )
            )
        elif isinstance(r, QuestionGradeResult):
            state["question_results"].append(r)

    return state


async def _grade_single_question(
    *,
    question: ExamQuestionIn,
    student_answer: str | list[str],
    rubric: StructuredRubric | None,
    mode: str,
) -> QuestionGradeResult:
    """Dispatch a single question to the appropriate grading agent."""
    q_type = question.type_data.type
    answer_str = student_answer if isinstance(student_answer, str) else " ".join(student_answer)

    if q_type == QuestionType.MCQ.value:
        # Extract correct option IDs
        correct_ids = [
            o.id for o in question.type_data.options if o.is_correct
        ]
        return await grade_mcq_question(
            question_id=question.id,
            student_answer=student_answer,
            correct_option_ids=correct_ids,
            allow_multiple=question.type_data.allow_multiple,
            max_points=question.points,
            rubric=rubric,
        )

    elif q_type == QuestionType.SHORT_ANSWER.value:
        return await grade_short_answer(
            question_id=question.id,
            question_prompt=question.prompt,
            student_answer=answer_str,
            max_points=question.points,
            rubric=rubric,
            mode=mode,
        )

    elif q_type in (QuestionType.LONG_ANSWER.value, QuestionType.ESSAY.value):
        return await grade_long_answer(
            question_id=question.id,
            question_prompt=question.prompt,
            question_type=q_type,
            student_answer=answer_str,
            max_points=question.points,
            rubric=rubric,
            mode=mode,
        )

    elif q_type == QuestionType.CODING.value:
        return await grade_coding(
            question_id=question.id,
            question_prompt=question.prompt,
            student_answer=answer_str,
            max_points=question.points,
            language=question.type_data.language,
            rubric=rubric,
            mode=mode,
        )

    elif q_type == QuestionType.MATHEMATICS.value:
        return await grade_mathematics(
            question_id=question.id,
            question_prompt=question.prompt,
            student_answer=answer_str,
            max_points=question.points,
            rubric=rubric,
            mode=mode,
        )

    else:
        # Fallback: treat as short answer
        return await grade_short_answer(
            question_id=question.id,
            question_prompt=question.prompt,
            student_answer=answer_str,
            max_points=question.points,
            rubric=rubric,
            mode=mode,
        )


# ---- Node: Evidence highlighting ------------------------------------

async def evidence_node(state: GradingState) -> GradingState:
    """Add evidence spans where missing."""
    attempt = state["attempt"]
    response_map = {r.question_id: r for r in attempt.responses}

    for i, qr in enumerate(state["question_results"]):
        if needs_evidence_pass(qr):
            response = response_map.get(qr.question_id)
            if response is None:
                continue
            answer = response.value if isinstance(response.value, str) else " ".join(response.value)
            try:
                spans = await add_evidence(
                    student_answer=answer,
                    grading_result=qr,
                )
                state["question_results"][i].evidence_spans = spans
                # Also update criterion results
                span_map: dict[str, list] = {}
                for s in spans:
                    span_map.setdefault(s.criterion_id, []).append(s)
                for cr in state["question_results"][i].criterion_results:
                    if cr.criterion_id in span_map:
                        cr.evidence_spans = span_map[cr.criterion_id]
            except Exception as e:
                logger.warning("Evidence pass failed for %s: %s", qr.question_id, e)

    return state


# ---- Node: Verification & finalization -------------------------------

async def verify_node(state: GradingState) -> GradingState:
    """Validate all results and clamp scores."""
    all_issues: list[str] = []

    for i, qr in enumerate(state["question_results"]):
        issues = validate_grade_result(qr)
        if issues:
            logger.warning("Validation issues for %s: %s", qr.question_id, issues)
            all_issues.extend(f"{qr.question_id}: {iss}" for iss in issues)
        # Always clamp
        state["question_results"][i] = clamp_scores(qr)

    # Check totals
    expected_max = state["exam"].total_points
    total_issues = validate_grading_run_totals(state["question_results"], expected_max)
    all_issues.extend(total_issues)

    if all_issues:
        state["errors"].extend(all_issues)

    state["status"] = GradingRunStatus.COMPLETED.value
    return state


# ---- Build the graph -------------------------------------------------

def build_grading_graph() -> StateGraph:
    """Build the LangGraph grading workflow."""
    graph = StateGraph(GradingState)

    graph.add_node("intake", intake_node)
    graph.add_node("grade_questions", grade_questions_node)
    graph.add_node("evidence", evidence_node)
    graph.add_node("verify", verify_node)

    graph.set_entry_point("intake")

    # Conditional: if intake fails, go to END
    def after_intake(state: GradingState) -> str:
        if state["status"] == GradingRunStatus.FAILED.value:
            return END
        return "grade_questions"

    graph.add_conditional_edges("intake", after_intake, {END: END, "grade_questions": "grade_questions"})
    graph.add_edge("grade_questions", "evidence")
    graph.add_edge("evidence", "verify")
    graph.add_edge("verify", END)

    return graph


# ---- Public API: run grading ----------------------------------------

async def run_grading(
    *,
    exam: ExamDefinitionOut,
    attempt: ExamAttemptOut,
    rubrics: dict[str, StructuredRubric] | None = None,
    mode: str = "balanced",
) -> GradingRunOut:
    """
    Execute a full grading run for one student attempt.

    Returns a GradingRunOut with all question results, scores, and evidence.
    """
    t0 = time.monotonic()
    run_id = f"run-{uuid.uuid4().hex[:8]}"

    initial_state: GradingState = {
        "exam": exam,
        "attempt": attempt,
        "rubrics": rubrics or {},
        "mode": mode,
        "question_results": [],
        "model_usage": [],
        "status": GradingRunStatus.PENDING.value,
        "errors": [],
    }

    graph = build_grading_graph()
    compiled = graph.compile()
    final_state = await compiled.ainvoke(initial_state)

    total_score = sum(qr.raw_score for qr in final_state["question_results"])
    max_total = sum(qr.max_points for qr in final_state["question_results"])

    # Collect model usage
    usage_records: list[ModelUsageRecord] = []
    for qr in final_state["question_results"]:
        if qr.model and qr.token_usage:
            usage_records.append(
                ModelUsageRecord(
                    model=qr.model,
                    question_id=qr.question_id,
                    prompt_tokens=qr.token_usage.prompt,
                    completion_tokens=qr.token_usage.completion,
                    latency_ms=qr.latency_ms or 0,
                    cached=False,
                )
            )

    now = datetime.utcnow()
    return GradingRunOut(
        id=run_id,
        exam_id=exam.id,
        attempt_id=attempt.id,
        student_id=attempt.student_id,
        status=GradingRunStatus(final_state["status"]),
        question_results=final_state["question_results"],
        total_score=total_score,
        max_total_points=max_total,
        reviews=[],
        started_at=now,
        completed_at=datetime.utcnow(),
        model_usage=usage_records,
    )


# ---- Public API: streaming grading -----------------------------------

OnResultCallback = Callable[[QuestionGradeResult], Coroutine[Any, Any, None]]


async def run_grading_streaming(
    *,
    exam: ExamDefinitionOut,
    attempt: ExamAttemptOut,
    rubrics: Optional[dict[str, StructuredRubric]] = None,
    mode: str = "balanced",
    on_result: Optional[OnResultCallback] = None,
) -> GradingRunOut:
    """
    Grade questions concurrently but stream each result via on_result callback
    as soon as it completes, before evidence/verify passes.
    """
    t0 = time.monotonic()
    run_id = f"run-{uuid.uuid4().hex[:8]}"
    rubrics = rubrics or {}

    response_map: dict[str, Any] = {r.question_id: r for r in attempt.responses}
    all_results: list[QuestionGradeResult] = []
    errors: list[str] = []

    # Deterministic questions: grade immediately and stream
    tasks = []
    task_meta: list[tuple[str, ExamQuestionIn]] = []

    for question in exam.questions:
        response = response_map.get(question.id)
        if response is None:
            qr = QuestionGradeResult(
                question_id=question.id,
                question_type=question.type_data.type,
                status=QuestionGradingStatus.GRADED,
                lane=GradingLane.DETERMINISTIC,
                raw_score=0, max_points=question.points,
                normalized_score=0, confidence=1.0,
                rationale="Question was not answered.",
            )
            all_results.append(qr)
            if on_result:
                await on_result(qr)
            continue

        rubric = rubrics.get(question.id)
        student_answer = response.value if isinstance(response.value, str) else response.value

        tasks.append(
            _grade_single_question(
                question=question,
                student_answer=student_answer,
                rubric=rubric,
                mode=mode,
            )
        )
        task_meta.append((question.id, question))

    # Run all tasks concurrently, stream results as they finish
    pending = set()
    task_to_meta: dict[asyncio.Task, tuple[str, ExamQuestionIn]] = {}
    for i, coro in enumerate(tasks):
        t = asyncio.ensure_future(coro)
        pending.add(t)
        task_to_meta[t] = task_meta[i]

    while pending:
        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        for t in done:
            qid, q = task_to_meta[t]
            exc = t.exception()
            if exc is not None:
                logger.error("Grading task failed for %s: %s", qid, exc)
                errors.append(f"{qid}: {exc}")
                qr = QuestionGradeResult(
                    question_id=qid,
                    question_type=q.type_data.type,
                    status=QuestionGradingStatus.ESCALATED,
                    lane=GradingLane.QUALITY_LLM,
                    raw_score=0, max_points=q.points,
                    normalized_score=0, confidence=0,
                    rationale=f"Grading failed: {exc}",
                    escalation_notes=str(exc),
                )
            else:
                qr = t.result()
            # Clamp
            qr = clamp_scores(qr)
            all_results.append(qr)
            if on_result:
                await on_result(qr)

    # Evidence pass
    for i, qr in enumerate(all_results):
        if needs_evidence_pass(qr):
            response = response_map.get(qr.question_id)
            if response is None:
                continue
            answer = response.value if isinstance(response.value, str) else " ".join(response.value)
            try:
                spans = await add_evidence(student_answer=answer, grading_result=qr)
                all_results[i].evidence_spans = spans
                span_map: dict[str, list] = {}
                for s in spans:
                    span_map.setdefault(s.criterion_id, []).append(s)
                for cr in all_results[i].criterion_results:
                    if cr.criterion_id in span_map:
                        cr.evidence_spans = span_map[cr.criterion_id]
                # Stream updated result with evidence
                if on_result:
                    await on_result(all_results[i])
            except Exception as e:
                logger.warning("Evidence pass failed for %s: %s", qr.question_id, e)

    total_score = sum(qr.raw_score for qr in all_results)
    max_total = sum(qr.max_points for qr in all_results)
    elapsed_ms = int((time.monotonic() - t0) * 1000)

    usage_records: list[ModelUsageRecord] = []
    for qr in all_results:
        if qr.model and qr.token_usage:
            usage_records.append(
                ModelUsageRecord(
                    model=qr.model,
                    question_id=qr.question_id,
                    prompt_tokens=qr.token_usage.prompt,
                    completion_tokens=qr.token_usage.completion,
                    latency_ms=qr.latency_ms or 0,
                    cached=False,
                )
            )

    now = datetime.utcnow()
    return GradingRunOut(
        id=run_id,
        exam_id=exam.id,
        attempt_id=attempt.id,
        student_id=attempt.student_id,
        status=GradingRunStatus.COMPLETED,
        question_results=all_results,
        total_score=total_score,
        max_total_points=max_total,
        reviews=[],
        started_at=now,
        completed_at=datetime.utcnow(),
        model_usage=usage_records,
    )
