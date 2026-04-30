"""
HKUST CSE Exam Platform – Test Grading API

Self-contained sandbox endpoint for testing the AI grading pipeline
with seeded test exams such as the COMP1023 midterm and the MGMT2110
essay-only grading dataset.

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
    build_comp1023_exam,
    build_comp1023_rubrics,
)
from app.fixtures.mgmt2110_exam import (
    EXAM_ID as MGMT2110_EXAM_ID,
    build_mgmt2110_exam,
    build_mgmt2110_rubrics,
)
from app.models.exam_models import (
    AttemptStatus,
    ExamAttemptOut,
    ExamDefinitionOut,
    QuestionResponseIn,
    QuestionType,
)
from app.models.grading_models import (
    CriterionReviewOverride,
    GradingReviewDecision,
    GradingRunOut,
    GradingRunStatus,
    ReviewSubmitRequest,
)
from app.services.grading.orchestrator import run_grading, run_grading_streaming
from app.db.repositories.grading_repository import GradingRepository
from app.db.session import get_db
from app.db.models.core import User
from app.dependencies.auth import require_roles
from fastapi import Depends
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/test-grading", tags=["test-grading"])

# Cache the exam definition so it's stable across calls
_exam_cache: dict[str, ExamDefinitionOut] = {}


def _get_exam(exam_id: str) -> ExamDefinitionOut:
    if exam_id not in _exam_cache:
        if exam_id == MGMT2110_EXAM_ID:
            _exam_cache[exam_id] = build_mgmt2110_exam()
        else:
            _exam_cache[exam_id] = build_comp1023_exam()
    return _exam_cache[exam_id]


def _get_rubrics(exam_id: str):
    if exam_id == MGMT2110_EXAM_ID:
        return build_mgmt2110_rubrics()
    return build_comp1023_rubrics()


# ---- Request / response models --------------------------------------

class AnswerPayload(BaseModel):
    question_id: str
    value: str  # raw text answer


class SubmitRequest(BaseModel):
    exam_id: str = Field(default="comp1023-midterm-f25")
    student_id: str = Field(default="test-student")
    answers: list[AnswerPayload]
    use_cache: bool = Field(default=True)


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
async def get_test_exam(
    exam_id: str = "comp1023-midterm-f25",
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> ExamOut:
    """Return the requested test exam without correct answers."""
    exam = _get_exam(exam_id)
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
async def submit_and_grade(
    body: SubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> GradingRunOut:
    """Accept student answers, build an attempt, grade it, return results."""
    exam = _get_exam(body.exam_id)
    rubrics = _get_rubrics(body.exam_id)

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
        student_id=body.student_id,
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
        use_cache=body.use_cache,
    )

    # Persist so we can fetch / review later
    GradingRepository(db).save_run(result)

    return result


@router.post("/submit-stream")
async def submit_and_grade_stream(
    body: SubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
):
    """SSE endpoint: streams each question result as it completes."""
    exam = _get_exam(body.exam_id)
    rubrics = _get_rubrics(body.exam_id)

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
        student_id=body.student_id,
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
                use_cache=body.use_cache,
                on_result=on_result,
            )
            GradingRepository(db).save_run(final_run)
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


@router.delete("/results", status_code=200)
async def clear_all_results(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> dict:
    """Delete all stored grading runs from the in-memory store (for testing)."""
    from app.db.models.grading import GradingRun
    count = db.query(GradingRun).delete()
    db.commit()
    return {"cleared": count, "message": f"Cleared {count} grading run(s) from server memory."}


@router.get("/current-run", response_model=GradingRunOut)
async def get_current_run(
    exam_id: str = "comp1023-midterm-f25",
    student_id: str = "test-student",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> GradingRunOut:
    """Fetch the most recent grading run for the given test exam + student.

    Used by the test-grading UI on mount to restore session state from the DB
    instead of from localStorage.
    """
    run = GradingRepository(db).get_run_for_student(exam_id, student_id)
    if not run:
        raise HTTPException(status_code=404, detail="No run found.")
    return run


@router.get("/results/{run_id}", response_model=GradingRunOut)
async def get_test_results(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> GradingRunOut:
    """Fetch a stored grading run."""
    run = GradingRepository(db).get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found.")
    return run


@router.put("/review/{run_id}", response_model=GradingRunOut)
async def submit_test_review(
    run_id: str,
    body: ReviewSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> GradingRunOut:
    """Submit a review override for a question in the run."""
    store = GradingRepository(db)
    run = store.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found.")

    original_score = 0.0
    criteria_overrides: list[CriterionReviewOverride] = []
    for qr in run.question_results:
        if qr.question_id == body.question_id:
            original_score = qr.raw_score
            override_by_id = {
                override.criterion_id: override
                for override in body.criteria_overrides
            }
            for cr in qr.criterion_results:
                override = override_by_id.get(cr.criterion_id)
                if not override:
                    continue
                criteria_overrides.append(
                    CriterionReviewOverride(
                        criterion_id=cr.criterion_id,
                        original_score=cr.score,
                        override_score=override.override_score,
                        reasoning=override.reasoning,
                    )
                )
            break

    review = GradingReviewDecision(
        question_id=body.question_id,
        reviewer_id=current_user.id,
        original_score=original_score,
        override_score=body.override_score,
        comment=body.comment,
        criteria_overrides=criteria_overrides,
        accepted=body.accepted,
        reviewed_at=datetime.utcnow(),
    )

    
    if review.override_score is not None or criteria_overrides:
        for qr in run.question_results:
            if qr.question_id == review.question_id:
                # Apply per-criterion score overrides first
                if criteria_overrides:
                    override_by_id   = {o.criterion_id: o.override_score for o in criteria_overrides}
                    reasoning_by_id  = {o.criterion_id: o.reasoning       for o in criteria_overrides}
                    for cr in qr.criterion_results:
                        if cr.criterion_id in override_by_id:
                            # Store human score separately – never overwrite the original AI score
                            cr.override_score     = override_by_id[cr.criterion_id]
                            cr.reviewer_rationale = reasoning_by_id.get(cr.criterion_id) or cr.reviewer_rationale
                    # Recompute raw_score using effective (human > AI) score per criterion
                    if qr.criterion_results:
                        qr.raw_score = sum(
                            (cr.override_score if cr.override_score is not None else cr.score)
                            for cr in qr.criterion_results
                        )

                # If an explicit top-level override was also provided, it takes precedence
                if review.override_score is not None:
                    qr.raw_score = review.override_score

                qr.status = "reviewed"
                if qr.max_points > 0:
                    qr.normalized_score = qr.raw_score / qr.max_points
                break
    run.reviews.append(review)
    run.total_score = sum(qr.raw_score for qr in run.question_results)
    run.status = "reviewed"
    updated = store.save_run(run)

    if not updated:
        raise HTTPException(status_code=500, detail="Failed to apply review.")
    return updated
