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

from fastapi import APIRouter

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
    save_proctoring_sync,
)
from app.services.analytics.ai_service import analytics_chat, generate_ai_summary
from app.storage.grading_storage import get_grading_store
from app.storage.exam_storage import get_exam_store

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# ---- Fixture exam registry -----------------------------------------
# Lazy-loaded so we don't import fixture builders at module load time.

def _try_fixture_exam(exam_id: str):
    """Return a fixture ExamDefinitionOut for known exam IDs, or None."""
    try:
        from app.fixtures.mgmt2110_exam import EXAM_ID as MGMT_ID, build_mgmt2110_exam
        if exam_id == MGMT_ID:
            return build_mgmt2110_exam()
    except Exception:
        pass
    try:
        from app.fixtures.comp1023_exam import build_comp1023_exam
        # COMP1023 uses "comp1023-midterm-f25" in the backend fixture
        if exam_id in ("comp1023-midterm-f25", "comp1023-midterm-s26"):
            return build_comp1023_exam()
    except Exception:
        pass
    return None


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


def _empty_snapshot(exam_id: str) -> ExamAnalyticsSnapshotOut:
    """Return an empty snapshot when no grading data is available yet.
    Proctoring-only data (risk summaries) is still included via students."""
    proc = get_proctoring_for_exam(exam_id)
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


def _get_snapshot(exam_id: str) -> ExamAnalyticsSnapshotOut:
    """Build analytics snapshot for an exam.

    Resolution order:
      1. Exam definition from live exam_store (created via API)
      2. Known backend fixture builders (MGMT2110, COMP1023)
      3. Empty snapshot (proctoring-only) — never 404
    """
    grading_store = get_grading_store()

    # 1. Live exam store
    exam = get_exam_store().get_definition(exam_id)

    # 2. Fixture fallback
    if exam is None:
        exam = _try_fixture_exam(exam_id)

    # 3. No grading runs → empty/proctoring-only snapshot
    runs = grading_store.list_runs_for_exam(exam_id)
    if not runs:
        if exam is not None:
            # We have exam metadata but no grades yet
            snap = _empty_snapshot(exam_id)
            snap.course_code = exam.course_code
            snap.course_name = exam.course_name
            snap.exam_title = exam.title
            return snap
        return _empty_snapshot(exam_id)

    # 4. Full snapshot
    question_meta = _build_question_meta(exam) if exam else []
    return build_analytics_snapshot(
        exam_id=exam_id,
        course_code=exam.course_code if exam else "—",
        course_name=exam.course_name if exam else "—",
        exam_title=exam.title if exam else exam_id,
        max_total_points=exam.total_points if exam else sum(r.max_total_points for r in runs[:1]),
        grading_runs=runs,
        question_meta=question_meta,
    )


@router.get(
    "/exams/{exam_id}/snapshot",
    response_model=ExamAnalyticsSnapshotOut,
)
async def api_get_analytics_snapshot(exam_id: str) -> ExamAnalyticsSnapshotOut:
    """Get the full analytics snapshot for an exam."""
    snapshot = _get_snapshot(exam_id)

    # Attempt AI summary (non-blocking, optional)
    try:
        summary = await generate_ai_summary(snapshot)
        if summary:
            snapshot.ai_summary = summary
    except Exception:
        pass  # AI is optional

    return snapshot


@router.post(
    "/exams/{exam_id}/chat",
    response_model=AnalyticsChatResponse,
)
async def api_analytics_chat(
    exam_id: str,
    body: AnalyticsChatRequest,
) -> AnalyticsChatResponse:
    """Chat with AI about exam analytics."""
    snapshot = _get_snapshot(exam_id)
    reply = await analytics_chat(snapshot, body.message, body.history)
    return AnalyticsChatResponse(
        reply=reply,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/exams/{exam_id}/proctoring-sync")
async def api_sync_proctoring(
    exam_id: str,
    body: ProctoringSessionSync,
) -> dict:
    """Sync proctoring session data for analytics consumption."""
    save_proctoring_sync(
        exam_id=body.exam_id or exam_id,
        student_id=body.student_id,
        student_name=body.student_name,
        risk_score=body.risk_score,
        high_severity_event_count=body.high_severity_event_count,
        event_count=body.event_count,
    )
    return {"status": "synced", "student_id": body.student_id}
