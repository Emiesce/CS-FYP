"""
HKUST CSE Exam Platform – Analytics API

Endpoints:
  GET    /api/analytics/exams/{exam_id}/snapshot      – full analytics snapshot
  POST   /api/analytics/exams/{exam_id}/chat          – analytics chat
  POST   /api/analytics/exams/{exam_id}/proctoring-sync – sync proctoring data
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models.core import User
from app.dependencies.auth import require_roles
from app.models.analytics_models import (
    AnalyticsChatRequest,
    AnalyticsChatResponse,
    AnalyticsOverviewOut,
    ExamAnalyticsSnapshotOut,
    ProctoringSessionSync,
)
from app.services.analytics import (
    build_analytics_snapshot,
    get_proctoring_for_exam,
)
from app.services.analytics.ai_service import analytics_chat, generate_ai_summary
from app.db.repositories.grading_repository import GradingRepository
from app.db.session import get_db
from app.db.repositories.exam_repository import ExamRepository

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _build_question_meta(exam) -> list[dict]:
    """Extract question metadata from an exam definition."""
    meta = []
    for q in exam.questions:
        td = q.type_data
        meta.append({
            "id": q.id,
            "title": q.title,
            "type": td.type,
            "points": q.points,
            "topic_ids": [],
        })
    return meta


def _empty_snapshot(exam_id: str, db: Optional[Session] = None) -> ExamAnalyticsSnapshotOut:
    """Return an empty snapshot when no grading data is available yet.
    Proctoring-only data (risk summaries) is still included via students."""
    proc = get_proctoring_for_exam(exam_id, db=db)
    now = datetime.now(timezone.utc).isoformat()

    from app.models.analytics_models import StudentAnalyticsRecord
    students = [
        StudentAnalyticsRecord(
            student_id=sid,
            student_name=info.get("student_name", sid),
            total_score=0,
            max_score=0,
            percentage=0,
            question_scores={},
            topic_scores={},
            risk_score=info.get("risk_score"),
            high_severity_event_count=info.get("high_severity_event_count"),
            proctoring_event_count=info.get("event_count"),
            review_override_count=0,
        )
        for sid, info in proc.items()
    ]

    overview = AnalyticsOverviewOut(
        exam_id=exam_id,
        student_count=len(students),
        graded_count=0,
        mean_score=0,
        median_score=0,
        highest_score=0,
        lowest_score=0,
        std_dev=0,
        max_total_points=0,
        mean_percentage=0,
        score_distribution=[],
        pass_rate=0,
    )

    return ExamAnalyticsSnapshotOut(
        exam_id=exam_id,
        course_code="—",
        course_name="—",
        exam_title=exam_id,
        generated_at=now,
        overview=overview,
        questions=[],
        topics=[],
        students=students,
    )


def _get_snapshot(exam_id: str, db=None) -> tuple[ExamAnalyticsSnapshotOut, list]:
    """Build analytics snapshot for an exam. Returns (snapshot, grading_runs).

    Resolution order:
      1. Exam definition from DB (via exam repository)
      2. Empty snapshot (proctoring-only) — never 404
    """
    grading_store = GradingRepository(db) if db else None

    # 1. DB-backed exam
    exam = ExamRepository(db).get(exam_id) if db else None

    # 2. No grading runs → empty/proctoring-only snapshot
    runs = grading_store.list_runs_for_exam(exam_id) if grading_store else []
    if not runs:
        if exam is not None:
            # We have exam metadata but no grades yet
            snap = _empty_snapshot(exam_id, db=db)
            snap.course_code = exam.course_code
            snap.course_name = exam.course_name
            snap.exam_title = exam.title
            return snap, []
        return _empty_snapshot(exam_id, db=db), []

    # 4. Full snapshot
    question_meta = _build_question_meta(exam) if exam else []
    snap = build_analytics_snapshot(
        exam_id=exam_id,
        course_code=exam.course_code if exam else "—",
        course_name=exam.course_name if exam else "—",
        exam_title=exam.title if exam else exam_id,
        max_total_points=exam.total_points if exam else sum(r.max_total_points for r in runs[:1]),
        grading_runs=runs,
        question_meta=question_meta,
        db=db,
    )
    return snap, runs


@router.get(
    "/exams/{exam_id}/snapshot",
    response_model=ExamAnalyticsSnapshotOut,
)
async def api_get_analytics_snapshot(
    exam_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> ExamAnalyticsSnapshotOut:
    """Get the full analytics snapshot for an exam."""
    snapshot, runs = _get_snapshot(exam_id, db=db)

    # Attempt AI summary (non-blocking, optional)
    try:
        summary = await generate_ai_summary(snapshot, grading_runs=runs, db=db)
        if summary:
            snapshot.ai_summary = summary
    except Exception as _ai_err:
        import logging as _log
        _log.getLogger(__name__).warning("AI summary failed for %s: %s", exam_id, _ai_err)

    return snapshot


@router.post(
    "/exams/{exam_id}/chat",
    response_model=AnalyticsChatResponse,
)
async def api_analytics_chat(
    exam_id: str,
    body: AnalyticsChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> AnalyticsChatResponse:
    """Chat with AI about exam analytics."""
    snapshot, runs = _get_snapshot(exam_id, db=db)
    reply = await analytics_chat(snapshot, body.message, body.history, grading_runs=runs)
    return AnalyticsChatResponse(
        reply=reply,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/exams/{exam_id}/proctoring-sync")
async def api_sync_proctoring(
    exam_id: str,
    body: ProctoringSessionSync,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "teaching_assistant", "administrator")),
) -> dict:
    """Sync proctoring session data to the database."""
    resolved_exam_id = body.exam_id or exam_id

    # 1. Persist to DB via proctoring repository
    from app.db.repositories.proctoring_repository import ProctoringRepository
    from datetime import datetime as _dt

    repo = ProctoringRepository(db)

    started_at = None
    ended_at = None
    if body.started_at:
        try:
            started_at = _dt.fromisoformat(body.started_at.replace("Z", "+00:00"))
        except ValueError:
            pass
    if body.ended_at:
        try:
            ended_at = _dt.fromisoformat(body.ended_at.replace("Z", "+00:00"))
        except ValueError:
            pass

    session_row = repo.upsert_session(
        exam_id=resolved_exam_id,
        student_id=body.student_id,
        student_name=body.student_name,
        student_number=getattr(body, "student_number", ""),
        avatar_url=getattr(body, "avatar_url", None),
        session_status=getattr(body, "session_status", "live"),
        started_at=started_at,
        ended_at=ended_at,
        risk_score=body.risk_score,
        rolling_average=getattr(body, "rolling_average", body.risk_score),
        event_count=body.event_count,
        high_severity_event_count=body.high_severity_event_count,
        live_status_json=getattr(body, "live_status", None),
    )
    repo.upsert_events(session_row, body.events)
    repo.sync_buckets(session_row, getattr(body, "buckets", []))
    db.commit()


    return {"status": "synced", "session_id": session_row.id, "student_id": body.student_id}
