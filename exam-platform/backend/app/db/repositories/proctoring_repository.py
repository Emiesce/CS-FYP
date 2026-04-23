"""
HKUST CSE Exam Platform – Proctoring Repository

Provides upsert / save methods for proctoring sessions, events and buckets.
All writes are idempotent — repeated syncs from the frontend are safe.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.db.models.proctoring import ProctoringBucket, ProctoringEvent, ProctoringSession


class ProctoringRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Session upsert
    # ------------------------------------------------------------------

    def upsert_session(
        self,
        *,
        exam_id: str,
        student_id: str,
        student_name: str = "",
        student_number: str = "",
        avatar_url: Optional[str] = None,
        session_status: str = "live",
        started_at: Optional[datetime] = None,
        ended_at: Optional[datetime] = None,
        risk_score: float = 0.0,
        rolling_average: float = 0.0,
        event_count: int = 0,
        high_severity_event_count: int = 0,
        live_status_json: Optional[dict] = None,
    ) -> ProctoringSession:
        """Create or update a proctoring session row."""
        row = (
            self.db.query(ProctoringSession)
            .filter(
                ProctoringSession.exam_id == exam_id,
                ProctoringSession.student_id == student_id,
            )
            .first()
        )

        now = datetime.utcnow()

        if row is None:
            import uuid
            row = ProctoringSession(
                id=str(uuid.uuid4()),
                exam_id=exam_id,
                student_id=student_id,
                student_name=student_name,
                student_number=student_number,
                avatar_url=avatar_url,
                session_status=session_status,
                started_at=started_at or now,
                updated_at=now,
                ended_at=ended_at,
                risk_score=risk_score,
                rolling_average=rolling_average,
                event_count=event_count,
                high_severity_event_count=high_severity_event_count,
                live_status_json=live_status_json,
            )
            self.db.add(row)
        else:
            row.student_name = student_name or row.student_name
            row.student_number = student_number or row.student_number
            if avatar_url is not None:
                row.avatar_url = avatar_url
            row.session_status = session_status
            if ended_at is not None:
                row.ended_at = ended_at
            row.updated_at = now
            row.risk_score = risk_score
            row.rolling_average = rolling_average
            row.event_count = event_count
            row.high_severity_event_count = high_severity_event_count
            if live_status_json is not None:
                row.live_status_json = live_status_json

        self.db.flush()
        return row

    # ------------------------------------------------------------------
    # Event upsert
    # ------------------------------------------------------------------

    def upsert_events(
        self,
        session: ProctoringSession,
        events: list[dict],
    ) -> int:
        """Insert events that don't exist yet (keyed by event id).
        Returns the count of newly inserted rows."""
        if not events:
            return 0

        incoming_ids = [ev.get("id") for ev in events if ev.get("id")]
        existing_ids = set()
        if incoming_ids:
            existing_ids = {
                row[0]
                for row in self.db.query(ProctoringEvent.id)
                .filter(ProctoringEvent.id.in_(incoming_ids))
                .all()
            }

        new_count = 0
        for ev in events:
            ev_id = ev.get("id") or ""
            if ev_id in existing_ids:
                continue

            timestamp = _parse_dt(ev.get("timestamp")) or datetime.utcnow()
            started_at = _parse_dt(ev.get("startedAt") or ev.get("started_at"))

            row = ProctoringEvent(
                id=ev_id or _uuid(),
                session_id=session.id,
                exam_id=session.exam_id,
                student_id=session.student_id,
                event_type=ev.get("type") or ev.get("event_type") or "unknown",
                severity=float(ev.get("severity", 0.0)),
                timestamp=timestamp,
                started_at=started_at,
                duration_seconds=ev.get("durationSeconds") or ev.get("duration_seconds"),
                message=ev.get("message", ""),
                has_evidence_clip=ev.get("evidenceClipMimeType") or ev.get("has_evidence_clip"),
            )
            self.db.add(row)
            new_count += 1

        self.db.flush()
        return new_count

    # ------------------------------------------------------------------
    # Bucket sync (full replace per session)
    # ------------------------------------------------------------------

    def sync_buckets(
        self,
        session: ProctoringSession,
        buckets: list[dict],
    ) -> None:
        """Replace all bucket rows for a session with the supplied list."""
        self.db.query(ProctoringBucket).filter(
            ProctoringBucket.session_id == session.id
        ).delete(synchronize_session=False)

        for i, b in enumerate(buckets):
            row = ProctoringBucket(
                id=_uuid(),
                session_id=session.id,
                bucket_index=i,
                label=b.get("label", f"{(i + 1) * 10}s"),
                score=float(b.get("score", 0.0)),
            )
            self.db.add(row)

        self.db.flush()

    # ------------------------------------------------------------------
    # Read helpers
    # ------------------------------------------------------------------

    def get_session(
        self, exam_id: str, student_id: str
    ) -> Optional[ProctoringSession]:
        return (
            self.db.query(ProctoringSession)
            .filter(
                ProctoringSession.exam_id == exam_id,
                ProctoringSession.student_id == student_id,
            )
            .first()
        )

    def list_sessions_for_exam(self, exam_id: str) -> list[ProctoringSession]:
        return (
            self.db.query(ProctoringSession)
            .filter(ProctoringSession.exam_id == exam_id)
            .order_by(ProctoringSession.started_at)
            .all()
        )

    def list_events_for_session(self, session_id: str) -> list[ProctoringEvent]:
        return (
            self.db.query(ProctoringEvent)
            .filter(ProctoringEvent.session_id == session_id)
            .order_by(ProctoringEvent.timestamp)
            .all()
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _uuid() -> str:
    import uuid
    return str(uuid.uuid4())


def _parse_dt(value: object) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None
