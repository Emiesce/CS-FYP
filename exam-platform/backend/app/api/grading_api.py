"""
HKUST CSE Exam Platform – Grading API

Endpoints:
  POST   /api/grading/rubric/generate                              – generate rubric
  POST   /api/grading/exams/{exam_id}/attempts/{attempt_id}/run    – start grading run
  GET    /api/grading/exams/{exam_id}/attempts/{attempt_id}        – get grading results
  PUT    /api/grading/exams/{exam_id}/attempts/{attempt_id}/review – submit review
  GET    /api/grading/exams/{exam_id}/runs                         – list runs for exam
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.grading_models import (
    GradingReviewDecision,
    GradingRunOut,
    GradingRunRequest,
    ReviewSubmitRequest,
    RubricGenerateRequest,
    RubricGenerateResponse,
    StructuredRubric,
)
from app.services.grading.orchestrator import run_grading
from app.services.grading.rubric_generation import generate_rubric
from app.db.repositories.grading_repository import GradingRepository
from app.db.session import get_db
from app.db.repositories.exam_repository import ExamRepository
from app.db.repositories.attempt_repository import AttemptRepository
from app.db.models.core import User
from app.dependencies.auth import require_roles
from sqlalchemy.orm import Session
from fastapi import Depends

router = APIRouter(prefix="/api/grading", tags=["grading"])


# ---- Rubric generation -----------------------------------------------

@router.post("/rubric/generate", response_model=RubricGenerateResponse)
async def api_generate_rubric(
    body: RubricGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> RubricGenerateResponse:
    """Generate a structured rubric for a question using AI."""
    try:
        rubric, model_used, latency_ms = await generate_rubric(
            question_id=body.question_id,
            question_prompt=body.question_prompt,
            question_type=body.question_type,
            points=body.points,
            instructor_notes=body.instructor_notes,
            support_text=body.support_file_text,
            model_answer=body.model_answer,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Persist the rubric
    GradingRepository(db).save_rubric(rubric)

    return RubricGenerateResponse(
        rubric=rubric,
        generated_by=model_used,
        latency_ms=latency_ms,
    )


# ---- Grading runs ----------------------------------------------------

@router.post(
    "/exams/{exam_id}/attempts/{attempt_id}/run",
    response_model=GradingRunOut,
)
async def api_start_grading_run(
    exam_id: str,
    attempt_id: str,
    body: GradingRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> GradingRunOut:
    """Start a grading run for a submitted attempt."""
    grading_store = GradingRepository(db)

    # Load exam definition from DB
    exam = ExamRepository(db).get(exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    # Load attempt from DB
    attempt = AttemptRepository(db).get_attempt(exam_id, body.student_id)
    if not attempt or attempt.id != attempt_id:
        raise HTTPException(status_code=404, detail="Attempt not found.")

    if attempt.status.value not in ("submitted", "timed_out"):
        raise HTTPException(
            status_code=400,
            detail="Can only grade submitted or timed-out attempts.",
        )

    # Gather rubrics: prefer request-provided, fall back to stored
    rubrics = body.rubrics or {}
    question_ids = [q.id for q in exam.questions]
    stored_rubrics = grading_store.list_rubrics_for_questions(question_ids)
    for qid, rub in stored_rubrics.items():
        if qid not in rubrics:
            rubrics[qid] = rub

    # Run grading
    result = await run_grading(
        exam=exam,
        attempt=attempt,
        rubrics=rubrics,
        mode=body.mode,
    )

    # Persist
    grading_store.save_run(result)
    return result


@router.get(
    "/exams/{exam_id}/attempts/{attempt_id}",
    response_model=GradingRunOut,
)
async def api_get_grading_result(
    exam_id: str,
    attempt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> GradingRunOut:
    """Get grading results for an attempt."""
    run = GradingRepository(db).get_run_by_attempt(attempt_id)
    if not run or run.exam_id != exam_id:
        raise HTTPException(status_code=404, detail="Grading run not found.")
    return run


@router.put(
    "/exams/{exam_id}/attempts/{attempt_id}/review",
    response_model=GradingRunOut,
)
async def api_submit_review(
    exam_id: str,
    attempt_id: str,
    body: ReviewSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> GradingRunOut:
    """Submit a staff review / override for a graded question."""
    store = GradingRepository(db)
    run = store.get_run_by_attempt(attempt_id)
    if not run or run.exam_id != exam_id:
        raise HTTPException(status_code=404, detail="Grading run not found.")

    review = GradingReviewDecision(
        question_id=body.question_id,
        reviewer_id=current_user.id,
        original_score=0,
        override_score=body.override_score,
        comment=body.comment,
        accepted=body.accepted,
        reviewed_at=datetime.utcnow(),
    )

    # Find original score
    for qr in run.question_results:
        if qr.question_id == body.question_id:
            review.original_score = qr.raw_score
            break

    
    # Apply override and recompute scores (human review takes precedence)
    criteria_overrides = getattr(body, "criteria_overrides", []) or []
    if criteria_overrides or review.override_score is not None:
        for qr in run.question_results:
            if qr.question_id == review.question_id:
                if criteria_overrides:
                    override_by_id  = {o.criterion_id: o.override_score for o in criteria_overrides}
                    reasoning_by_id = {o.criterion_id: o.reasoning       for o in criteria_overrides}
                    for cr in qr.criterion_results:
                        if cr.criterion_id in override_by_id:
                            cr.override_score     = override_by_id[cr.criterion_id]
                            cr.reviewer_rationale = reasoning_by_id.get(cr.criterion_id) or cr.reviewer_rationale
                    if qr.criterion_results:
                        qr.raw_score = sum(
                            (cr.override_score if cr.override_score is not None else cr.score)
                            for cr in qr.criterion_results
                        )
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
        raise HTTPException(status_code=404, detail="Failed to apply review.")
    return updated


@router.get(
    "/exams/{exam_id}/runs",
    response_model=list[GradingRunOut],
)
async def api_list_runs(
    exam_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> list[GradingRunOut]:
    """List all grading runs for an exam."""
    return GradingRepository(db).list_runs_for_exam(exam_id)


@router.get(
    "/my-results/{exam_id}",
    response_model=GradingRunOut,
)
async def api_get_my_grading_result(
    exam_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> GradingRunOut:
    """Get approved grading results for the current student's exam attempt.

    Only returns a result when a human grader has reviewed and approved the run
    (status == 'reviewed').
    """
    run = GradingRepository(db).get_run_for_student(exam_id, current_user.id)
    if not run:
        raise HTTPException(status_code=404, detail="No graded result found for this exam.")
    if run.status not in ("reviewed", "finalized"):
        raise HTTPException(
            status_code=404,
            detail="Results are not yet released. Grading is still pending human review.",
        )
    return run
