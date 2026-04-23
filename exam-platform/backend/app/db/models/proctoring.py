"""
HKUST CSE Exam Platform – Proctoring ORM Models

Tables:
  proctoring_sessions  – one row per (exam_id, student_id) session
  proctoring_events    – one row per individual violation event
  proctoring_buckets   – one row per 10-second risk-score bucket
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class ProctoringSession(Base):
    __tablename__ = "proctoring_sessions"

    id = Column(String, primary_key=True, default=_uuid)

    # Identifiers
    exam_id = Column(String, nullable=False, index=True)
    student_id = Column(String, nullable=False, index=True)
    student_name = Column(String, nullable=False, default="")
    student_number = Column(String, nullable=False, default="")
    avatar_url = Column(String, nullable=True)

    # Lifecycle
    session_status = Column(String, nullable=False, default="live")  # live | completed | aborted
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    # Aggregates (kept denormalised for fast reads)
    risk_score = Column(Float, nullable=False, default=0.0)
    rolling_average = Column(Float, nullable=False, default=0.0)
    event_count = Column(Integer, nullable=False, default=0)
    high_severity_event_count = Column(Integer, nullable=False, default=0)

    # Snapshot of the last live status blob  {"gazeStatus":…, "cameraStatus":…, …}
    live_status_json = Column(JSONB, nullable=True)

    events = relationship(
        "ProctoringEvent",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ProctoringEvent.timestamp",
    )
    buckets = relationship(
        "ProctoringBucket",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ProctoringBucket.bucket_index",
    )


class ProctoringEvent(Base):
    __tablename__ = "proctoring_events"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(String, ForeignKey("proctoring_sessions.id"), nullable=False, index=True)

    # Denormalised for direct queries without join
    exam_id = Column(String, nullable=False, index=True)
    student_id = Column(String, nullable=False, index=True)

    event_type = Column(String, nullable=False)          # gaze_away | face_missing | …
    severity = Column(Float, nullable=False, default=0.0)
    timestamp = Column(DateTime, nullable=False)
    started_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    message = Column(Text, nullable=False, default="")

    # Optional clip metadata (URL is ephemeral; we store type + flag only)
    has_evidence_clip = Column(String, nullable=True)    # mime type, e.g. "video/webm"
    clip_data = Column(LargeBinary, nullable=True)       # raw video bytes uploaded after exam

    session = relationship("ProctoringSession", back_populates="events")


class ProctoringBucket(Base):
    __tablename__ = "proctoring_buckets"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(String, ForeignKey("proctoring_sessions.id"), nullable=False, index=True)

    bucket_index = Column(Integer, nullable=False)   # 0-based ordinal
    label = Column(String, nullable=False)           # e.g. "10s", "20s"
    score = Column(Float, nullable=False, default=0.0)

    session = relationship("ProctoringSession", back_populates="buckets")
