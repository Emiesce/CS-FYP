"""
HKUST CSE Exam Platform – Proctoring Persistence API

Endpoints:
  POST /api/proctoring/sync                       – upsert session + events + buckets
  GET  /api/proctoring/exams/{exam_id}/sessions   – list all sessions for an exam
  GET  /api/proctoring/sessions/{session_id}      – single session with events
  WS   /ws/proctoring/{exam_id}                   – real-time alert stream for staff
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.redis import publish_alert, subscribe_alerts
from app.db.models.core import User
from app.db.models.proctoring import ProctoringSession as ProctoringSessionModel, ProctoringEvent as ProctoringEventModel
from app.db.session import get_db
from app.db.repositories.proctoring_repository import ProctoringRepository
from app.dependencies.auth import get_current_user, require_roles
from app.models.analytics_models import (
    ProctoringSessionOut,
    ProctoringSessionSync,
    ProctoringEventOut,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/proctoring", tags=["proctoring"])
ws_router = APIRouter(prefix="/ws/proctoring", tags=["proctoring-ws"])


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

    # ---- Publish new events to Redis so staff dashboards receive them in
    #      real time via the WebSocket endpoint below. ----
    if new_events and exam_id:
        alert_payload = {
            "session_id": session.id,
            "student_id": body.student_id,
            "student_name": body.student_name,
            "risk_score": body.risk_score,
            "rolling_average": body.rolling_average,
            "events": [
                {
                    "id": ev.get("id"),
                    "type": ev.get("type"),
                    "severity": ev.get("severity"),
                    "timestamp": ev.get("timestamp"),
                    "message": ev.get("message"),
                    "duration_seconds": ev.get("durationSeconds"),
                }
                for ev in (body.events or [])
            ],
        }
        try:
            await publish_alert(exam_id, alert_payload)
        except Exception:
            # Redis being unavailable must not fail the sync response.
            logger.warning("[proctoring-sync] Could not publish alert to Redis", exc_info=True)

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


# ---------------------------------------------------------------------------
# Evidence clip upload / retrieval
# ---------------------------------------------------------------------------

@router.put("/events/{event_id}/clip")
async def upload_event_clip(
    event_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Upload raw video bytes for a specific proctoring event.

    The client must set Content-Type to the clip mime type (e.g. video/webm).
    Only the owning student or staff may upload.
    """
    event: ProctoringEventModel | None = (
        db.query(ProctoringEventModel).filter_by(id=event_id).first()
    )
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if current_user.role == "student" and event.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty clip body")

    content_type = request.headers.get("content-type", "video/webm")
    event.clip_data = body
    event.has_evidence_clip = content_type
    db.commit()
    return {"status": "ok", "event_id": event_id, "bytes": len(body)}


@router.get("/events/{event_id}/clip")
async def get_event_clip(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Stream the stored video clip for a proctoring event."""
    event: ProctoringEventModel | None = (
        db.query(ProctoringEventModel).filter_by(id=event_id).first()
    )
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if current_user.role == "student" and event.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not event.clip_data:
        raise HTTPException(status_code=404, detail="No clip stored for this event")

    mime = event.has_evidence_clip or "video/webm"
    return Response(content=event.clip_data, media_type=mime)


# ---------------------------------------------------------------------------
# WebSocket – real-time alert stream for staff dashboards
# ---------------------------------------------------------------------------

# Simple in-process connection registry per exam so we can track active
# connections for health-check purposes without any extra infrastructure.
_ACTIVE_CONNECTIONS: dict[str, set[WebSocket]] = {}


@ws_router.websocket("/{exam_id}")
async def ws_proctoring_alerts(
    exam_id: str,
    websocket: WebSocket,
) -> None:
    """
    Staff WebSocket: ``ws://backend/ws/proctoring/{exam_id}``

    The client authenticates by sending a JSON handshake immediately after
    connecting::

        { "type": "auth", "token": "<JWT>" }

    After a successful auth acknowledgement, the connection receives a stream
    of JSON alert messages whenever a student's browser POSTs to
    ``/api/proctoring/sync``.  Each message has the shape::

        {
          "type": "alert",
          "exam_id": "...",
          "session_id": "...",
          "student_id": "...",
          "student_name": "...",
          "risk_score": 42,
          "rolling_average": 30,
          "events": [ { "id", "type", "severity", "timestamp", "message" }, ... ]
        }

    The server also sends a periodic ``{"type": "ping"}`` every 25 seconds so
    firewalls / load-balancers don't tear down idle connections.
    """
    await websocket.accept()

    # ---- Simple JWT auth handshake ----------------------------------------
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        handshake = json.loads(raw)
    except (asyncio.TimeoutError, json.JSONDecodeError):
        await websocket.close(code=4001, reason="auth_timeout")
        return

    token: str = handshake.get("token", "")
    if not token:
        await websocket.close(code=4001, reason="missing_token")
        return

    # Re-use the existing JWT verification logic via a lightweight import.
    from app.core.tokens import decode_access_token  # type: ignore[import]
    try:
        claims = decode_access_token(token)
        role: str = claims.get("role", "student")
    except Exception:
        await websocket.close(code=4003, reason="invalid_token")
        return

    if role not in ("instructor", "teaching_assistant", "administrator"):
        await websocket.close(code=4003, reason="forbidden")
        return

    await websocket.send_json({"type": "auth_ok", "exam_id": exam_id})

    # ---- Register connection -----------------------------------------------
    _ACTIVE_CONNECTIONS.setdefault(exam_id, set()).add(websocket)
    logger.info("[ws-proctoring] Staff connected for exam %s  (total=%d)", exam_id, len(_ACTIVE_CONNECTIONS[exam_id]))

    # ---- Main loop: forward Redis messages to the WebSocket ----------------
    ping_task: asyncio.Task | None = None

    async def _ping() -> None:
        """Keep the connection alive with periodic pings."""
        while True:
            await asyncio.sleep(25)
            try:
                await websocket.send_json({"type": "ping"})
            except Exception:
                return

    ping_task = asyncio.create_task(_ping())

    try:
        async with subscribe_alerts(exam_id) as pubsub:
            async for raw_msg in pubsub.listen():
                if raw_msg["type"] != "message":
                    continue
                try:
                    payload = json.loads(raw_msg["data"])
                except json.JSONDecodeError:
                    continue

                alert = {"type": "alert", "exam_id": exam_id, **payload}
                try:
                    await websocket.send_json(alert)
                except WebSocketDisconnect:
                    break
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("[ws-proctoring] Unexpected error for exam %s: %s", exam_id, exc)
    finally:
        ping_task.cancel()
        _ACTIVE_CONNECTIONS.get(exam_id, set()).discard(websocket)
        logger.info("[ws-proctoring] Staff disconnected from exam %s", exam_id)
        try:
            await websocket.close()
        except Exception:
            pass
