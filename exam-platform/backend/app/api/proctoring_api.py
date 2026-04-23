"""
HKUST CSE Exam Platform – Proctoring Persistence API

Endpoints:
  POST /api/proctoring/sync                       – upsert session + events + buckets
  GET  /api/proctoring/exams/{exam_id}/sessions   – list all sessions for an exam
  GET  /api/proctoring/sessions/{session_id}      – single session with events
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models.core import User
from app.db.session import get_db
from app.db.repositories.proctoring_repository import ProctoringRepository
from app.db.models.proctoring import ProctoringSession as ProctoringSessionModel
from app.dependencies.auth import get_current_user, require_roles
from app.models.analytics_models import (
    ProctoringSessionOut,
    ProctoringSessionSync,
    ProctoringEventOut,
)

router = APIRouter(prefix="/api/proctoring", tags=["proctoring"])


def _session_to_out(
    session,
    include_events: bool = False,
) -> ProctoringSessionOut:
    events_out: list[ProctoringEventOut] = []
    if include_events:
        for ev in session.events:
            events_out.append(
                ProctoringEventOut(
                    id=ev.id,
                    exam_id=ev.exam_id,
                    student_id=ev.student_id,
                    event_type=ev.event_type,
                    severity=ev.severity,
                    timestamp=ev.timestamp.isoformat(),
                    started_at=ev.started_at.isoformat() if ev.started_at else None,
                    duration_seconds=ev.duration_seconds,
                    message=ev.message,
                    has_evidence_clip=ev.has_evidence_clip,
                )
            )

    buckets_out = [
        {"label": b.label, "score": b.score}
        for b in sorted(session.buckets, key=lambda b: b.bucket_index)
    ]

    return ProctoringSessionOut(
        id=session.id,
        exam_id=session.exam_id,
        student_id=session.student_id,
        student_name=session.student_name,
        student_number=session.student_number,
        avatar_url=session.avatar_url,
        session_status=session.session_status,
        started_at=session.started_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
        ended_at=session.ended_at.isoformat() if session.ended_at else None,
        risk_score=session.risk_score,
        rolling_average=session.rolling_average,
        event_count=session.event_count,
        high_severity_event_count=session.high_severity_event_count,
        live_status=session.live_status_json,
        events=events_out,
        buckets=buckets_out,
    )


@router.post("/sync", response_model=dict)
async def api_proctoring_sync(
    body: ProctoringSessionSync,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Upsert a proctoring session and its events/buckets from the browser."""
    exam_id = body.exam_id or ""
    if not exam_id or not body.student_id:
        raise HTTPException(status_code=422, detail="exam_id and student_id are required")
    if current_user.role == "student":
        body.student_id = current_user.id

    repo = ProctoringRepository(db)

    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    if body.started_at:
        try:
            started_at = datetime.fromisoformat(body.started_at.replace("Z", "+00:00"))
        except ValueError:
            pass

    if body.ended_at:
        try:
            ended_at = datetime.fromisoformat(body.ended_at.replace("Z", "+00:00"))
        except ValueError:
            pass

    session = repo.upsert_session(
        exam_id=exam_id,
        student_id=body.student_id,
        student_name=body.student_name,
        student_number=body.student_number,
        avatar_url=body.avatar_url,
        session_status=body.session_status,
        started_at=started_at,
        ended_at=ended_at,
        risk_score=body.risk_score,
        rolling_average=body.rolling_average,
        event_count=body.event_count,
        high_severity_event_count=body.high_severity_event_count,
        live_status_json=body.live_status,
    )

    new_events = repo.upsert_events(session, body.events)
    repo.sync_buckets(session, body.buckets)
    db.commit()

    return {
        "status": "synced",
        "session_id": session.id,
        "new_events": new_events,
    }


@router.get(
    "/exams/{exam_id}/sessions",
    response_model=list[ProctoringSessionOut],
)
async def api_list_proctoring_sessions(
    exam_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> list[ProctoringSessionOut]:
    """List all proctoring sessions for an exam (summary, no events)."""
    repo = ProctoringRepository(db)
    sessions = repo.list_sessions_for_exam(exam_id)
    return [_session_to_out(s, include_events=False) for s in sessions]


@router.get(
    "/sessions/{session_id}",
    response_model=ProctoringSessionOut,
)
async def api_get_proctoring_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> ProctoringSessionOut:
    """Get a single proctoring session including its full event log."""
    row = db.query(ProctoringSessionModel).filter_by(id=session_id).first()

    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return _session_to_out(row, include_events=True)


@router.get(
    "/exams/{exam_id}/sessions/{student_id}",
    response_model=ProctoringSessionOut,
)
async def api_get_student_proctoring_session(
    exam_id: str,
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProctoringSessionOut:
    """Get the proctoring session for a specific student in an exam."""
    if current_user.role == "student":
        student_id = current_user.id
    repo = ProctoringRepository(db)
    row = repo.get_session(exam_id, student_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_to_out(row, include_events=True)
