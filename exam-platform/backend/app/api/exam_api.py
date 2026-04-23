"""
HKUST CSE Exam Platform – Exam Definition & Attempt API

Endpoints:
  POST   /api/exams                    – create an exam definition
  GET    /api/exams                    – list all exam definitions
  GET    /api/exams/{exam_id}          – get a single exam definition
  PUT    /api/exams/{exam_id}          – update an exam definition
  GET    /api/exams/{exam_id}/attempts – list attempts for an exam
  POST   /api/exams/{exam_id}/attempt  – start or resume an attempt
  PUT    /api/exams/{exam_id}/attempt  – save draft progress
  POST   /api/exams/{exam_id}/submit   – submit a completed attempt
  GET    /api/exams/{exam_id}/attempt  – get current attempt state
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models.core import Exam, ExamAttempt, QuestionResponse, User
from app.db.models.proctoring import ProctoringSession, ProctoringEvent, ProctoringBucket
from app.models.exam_models import (
    ExamAttemptIn,
    ExamAttemptOut,
    ExamDefinitionIn,
    ExamDefinitionOut,
)
from app.dependencies.auth import get_current_user, require_roles
from app.db.session import get_db
from app.db.repositories.exam_repository import ExamRepository
from app.db.repositories.attempt_repository import AttemptRepository

router = APIRouter(prefix="/api/exams", tags=["exams"])


# -----------------------------------------------------------------------
# Exam definitions (staff authoring)
# -----------------------------------------------------------------------

@router.post("", response_model=ExamDefinitionOut)
async def create_exam(
    body: ExamDefinitionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "administrator")),
) -> ExamDefinitionOut:
    """Create a new exam definition."""
    return ExamRepository(db).create(body)


@router.get("", response_model=list[ExamDefinitionOut])
async def list_exams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ExamDefinitionOut]:
    """List all exam definitions."""
    return ExamRepository(db).list()


@router.get("/{exam_id}", response_model=ExamDefinitionOut)
async def get_exam(
    exam_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExamDefinitionOut:
    """Get a single exam definition by ID."""
    definition = ExamRepository(db).get(exam_id)
    if not definition:
        raise HTTPException(status_code=404, detail="Exam not found.")
    return definition


@router.put("/{exam_id}", response_model=ExamDefinitionOut)
async def update_exam(
    exam_id: str,
    body: ExamDefinitionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "administrator")),
) -> ExamDefinitionOut:
    """Update an existing exam definition."""
    updated = ExamRepository(db).update(exam_id, body)
    if not updated:
        raise HTTPException(status_code=404, detail="Exam not found.")
    return updated


# -----------------------------------------------------------------------
# Student attempts
# -----------------------------------------------------------------------

@router.get("/{exam_id}/attempts", response_model=list[ExamAttemptOut])
async def list_attempts(
    exam_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> list[ExamAttemptOut]:
    """List all persisted attempts for an exam."""
    return AttemptRepository(db).list_attempts_for_exam(exam_id)

@router.post("/{exam_id}/attempt", response_model=ExamAttemptOut)
async def start_attempt(
    exam_id: str,
    body: ExamAttemptIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExamAttemptOut:
    """Start or resume a student attempt."""
    body.exam_id = exam_id
    if current_user.role == "student":
        body.student_id = current_user.id
    return AttemptRepository(db).start_attempt(body)


@router.put("/{exam_id}/attempt", response_model=ExamAttemptOut)
async def save_draft(
    exam_id: str,
    body: ExamAttemptIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExamAttemptOut:
    """Save draft progress for a student attempt."""
    body.exam_id = exam_id
    if current_user.role == "student":
        body.student_id = current_user.id
    result = AttemptRepository(db).save_draft(body)
    if not result:
        raise HTTPException(status_code=404, detail="No active attempt found.")
    return result


@router.post("/{exam_id}/submit", response_model=ExamAttemptOut)
async def submit_attempt(
    exam_id: str,
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExamAttemptOut:
    """Submit a completed attempt."""
    if current_user.role == "student":
        student_id = current_user.id
    result = AttemptRepository(db).submit_attempt(exam_id, student_id)
    if not result:
        raise HTTPException(status_code=404, detail="No active attempt found.")
    return result


@router.get("/{exam_id}/attempt")
async def get_attempt(
    exam_id: str,
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Optional[ExamAttemptOut]:
    """Get the current attempt state for a student."""
    if current_user.role == "student":
        student_id = current_user.id
    result = AttemptRepository(db).get_attempt(exam_id, student_id)
    if not result:
        return None
    return result


# -----------------------------------------------------------------------
# Exam reset (instructor / administrator only)
# -----------------------------------------------------------------------

@router.post("/{exam_id}/reset", response_model=dict)
async def reset_exam(
    exam_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "administrator")),
) -> dict:
    """
    Reset an exam back to its pre-attempt state.

    Deletes all student attempts (and their responses), all proctoring
    sessions, events and buckets for this exam, then sets the exam status
    back to 'current' so it can be retaken from scratch.

    Intended for demo / testing purposes only.
    """
    exam: Optional[Exam] = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    # 1. Delete proctoring data -----------------------------------------
    sessions = (
        db.query(ProctoringSession)
        .filter(ProctoringSession.exam_id == exam_id)
        .all()
    )
    for session in sessions:
        db.query(ProctoringEvent).filter(
            ProctoringEvent.session_id == session.id
        ).delete(synchronize_session=False)
        db.query(ProctoringBucket).filter(
            ProctoringBucket.session_id == session.id
        ).delete(synchronize_session=False)
        db.delete(session)

    # 2. Delete all attempts and their responses ------------------------
    attempts = (
        db.query(ExamAttempt)
        .filter(ExamAttempt.exam_id == exam_id)
        .all()
    )
    for attempt in attempts:
        db.query(QuestionResponse).filter(
            QuestionResponse.attempt_id == attempt.id
        ).delete(synchronize_session=False)
        db.delete(attempt)

    # 3. Reset exam status to 'current' and extend its window --------------------------------
    exam.status = "current"
    # To ensure it shows up as current even if it was scheduled in the past,
    # shift the start time to 'now' and the date to today.
    from datetime import datetime, timedelta
    now_dt = datetime.utcnow()
    exam.date = now_dt.strftime("%Y-%m-%d")
    exam.start_time = now_dt.strftime("%H:%M")

    db.commit()

    return {
        "status": "reset",
        "exam_id": exam_id,
        "attempts_deleted": len(attempts),
        "sessions_deleted": len(sessions),
    }
