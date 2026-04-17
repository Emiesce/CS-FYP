"""
HKUST CSE Exam Platform – Test Grading API

Self-contained sandbox endpoint for testing the AI grading pipeline
with the COMP1023 midterm exam.

POST /api/test-grading/submit   – submit answers → grade → return results
GET  /api/test-grading/exam     – get the exam definition (questions only, no answers)
GET  /api/test-grading/results/{run_id} – fetch a stored run
PUT  /api/test-grading/review/{run_id}  – submit review override
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.fixtures.comp1023_exam import (
    CORRECT_ANSWERS,
    MODEL_ANSWERS,
    build_comp1023_exam,
    build_comp1023_rubrics,
)
from app.models.exam_models import (
    AttemptStatus,
    ExamAttemptOut,
    ExamDefinitionOut,
    QuestionResponseIn,
    QuestionType,
)
from app.models.grading_models import (
    GradingReviewDecision,
    GradingRunOut,
    GradingRunStatus,
    ReviewSubmitRequest,
)
from app.services.grading.orchestrator import run_grading, run_grading_streaming
from app.storage.grading_storage import get_grading_store

router = APIRouter(prefix="/api/test-grading", tags=["test-grading"])

# Cache the exam definition so it's stable across calls
_exam: ExamDefinitionOut | None = None


def _get_exam() -> ExamDefinitionOut:
    global _exam
    if _exam is None:
        _exam = build_comp1023_exam()
    return _exam


# ---- Request / response models --------------------------------------

class AnswerPayload(BaseModel):
    question_id: str
    value: str  # raw text answer


class SubmitRequest(BaseModel):
    answers: list[AnswerPayload]


class ExamQuestionOut(BaseModel):
    """Question sent to the test-taker (no correct answers)."""
    id: str
    order: int
    title: str
    prompt: str
    points: float
    question_type: str
    options: Optional[List[dict]] = None  # for MCQ only


class ExamOut(BaseModel):
    id: str
    course_code: str
    course_name: str
    title: str
    total_points: float
    questions: list[ExamQuestionOut]


# ---- Endpoints -------------------------------------------------------

@router.get("/exam", response_model=ExamOut)
async def get_test_exam() -> ExamOut:
    """Return the COMP1023 exam without correct answers."""
    exam = _get_exam()
    questions_out: list[ExamQuestionOut] = []
    for q in exam.questions:
        opts = None
        if q.type_data.type == "mcq":
            opts = [{"id": o.id, "label": o.label} for o in q.type_data.options]
        questions_out.append(ExamQuestionOut(
            id=q.id,
            order=q.order,
            title=q.title,
            prompt=q.prompt,
            points=q.points,
            question_type=q.type_data.type,
            options=opts,
        ))
    return ExamOut(
        id=exam.id,
        course_code=exam.course_code,
        course_name=exam.course_name,
        title=exam.title,
        total_points=exam.total_points,
        questions=questions_out,
    )


@router.post("/submit", response_model=GradingRunOut)
async def submit_and_grade(body: SubmitRequest) -> GradingRunOut:
    """Accept student answers, build an attempt, grade it, return results."""
    exam = _get_exam()
    rubrics = build_comp1023_rubrics()

    # Map question types
    q_type_map: dict[str, str] = {}
    for q in exam.questions:
        q_type_map[q.id] = q.type_data.type

    # Build responses
    responses: list[QuestionResponseIn] = []
    now = datetime.utcnow()
    for ans in body.answers:
        qt_str = q_type_map.get(ans.question_id, "short_answer")
        responses.append(QuestionResponseIn(
            question_id=ans.question_id,
            question_type=QuestionType(qt_str),
            value=ans.value,
            answered_at=now,
        ))

    # Fabricate a submitted attempt
    attempt = ExamAttemptOut(
        id=f"test-attempt-{now.strftime('%H%M%S')}",
        exam_id=exam.id,
        student_id="test-student",
        status=AttemptStatus.SUBMITTED,
        started_at=now,
        submitted_at=now,
        responses=responses,
        current_question_index=0,
        flagged_question_ids=[],
    )

    # Run the grading pipeline
    result = await run_grading(
        exam=exam,
        attempt=attempt,
        rubrics=rubrics,
        mode="quality_first",
    )

    # Persist so we can fetch / review later
    get_grading_store().save_run(result)

    return result


@router.post("/submit-stream")
async def submit_and_grade_stream(body: SubmitRequest):
    """SSE endpoint: streams each question result as it completes."""
    exam = _get_exam()
    rubrics = build_comp1023_rubrics()

    q_type_map: dict[str, str] = {}
    for q in exam.questions:
        q_type_map[q.id] = q.type_data.type

    responses: list[QuestionResponseIn] = []
    now = datetime.utcnow()
    for ans in body.answers:
        qt_str = q_type_map.get(ans.question_id, "short_answer")
        responses.append(QuestionResponseIn(
            question_id=ans.question_id,
            question_type=QuestionType(qt_str),
            value=ans.value,
            answered_at=now,
        ))

    attempt = ExamAttemptOut(
        id=f"test-attempt-{now.strftime('%H%M%S')}",
        exam_id=exam.id,
        student_id="test-student",
        status=AttemptStatus.SUBMITTED,
        started_at=now,
        submitted_at=now,
        responses=responses,
        current_question_index=0,
        flagged_question_ids=[],
    )

    queue: asyncio.Queue = asyncio.Queue()

    async def on_result(qr):
        await queue.put(("result", qr))

    async def run_pipeline():
        try:
            final_run = await run_grading_streaming(
                exam=exam,
                attempt=attempt,
                rubrics=rubrics,
                mode="quality_first",
                on_result=on_result,
            )
            get_grading_store().save_run(final_run)
            await queue.put(("done", final_run))
        except Exception as e:
            await queue.put(("error", str(e)))

    async def event_generator():
        task = asyncio.ensure_future(run_pipeline())
        try:
            while True:
                msg_type, payload = await queue.get()
                if msg_type == "result":
                    data = payload.model_dump(mode="json")
                    yield f"event: result\ndata: {json.dumps(data)}\n\n"
                elif msg_type == "done":
                    data = payload.model_dump(mode="json")
                    yield f"event: done\ndata: {json.dumps(data)}\n\n"
                    break
                elif msg_type == "error":
                    yield f"event: error\ndata: {json.dumps({'error': payload})}\n\n"
                    break
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/results/{run_id}", response_model=GradingRunOut)
async def get_test_results(run_id: str) -> GradingRunOut:
    """Fetch a stored grading run."""
    run = get_grading_store().get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found.")
    return run


@router.put("/review/{run_id}", response_model=GradingRunOut)
async def submit_test_review(run_id: str, body: ReviewSubmitRequest) -> GradingRunOut:
    """Submit a review override for a question in the run."""
    store = get_grading_store()
    run = store.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found.")

    original_score = 0.0
    for qr in run.question_results:
        if qr.question_id == body.question_id:
            original_score = qr.raw_score
            break

    review = GradingReviewDecision(
        question_id=body.question_id,
        reviewer_id="test-instructor",
        original_score=original_score,
        override_score=body.override_score,
        comment=body.comment,
        accepted=body.accepted,
        reviewed_at=datetime.utcnow(),
    )

    updated = store.apply_review(run.attempt_id, review)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to apply review.")
    return updated
