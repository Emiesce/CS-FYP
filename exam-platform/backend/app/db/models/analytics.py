"""
ORM models for analytics: AI summary cache and per-user chat history.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, String, Text

from app.db.base import Base


class AiSummaryCache(Base):
    __tablename__ = "ai_summary_cache"

    # Composite natural key: one row per (exam, grading snapshot)
    exam_id = Column(String, primary_key=True, nullable=False)
    grading_hash = Column(String, primary_key=True, nullable=False)

    # Serialised AnalyticsAISummaryOut JSON
    payload = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ChatHistory(Base):
    """Persists AI analytics chat messages per (exam, user).

    ``messages_json`` holds the full message list as a JSON array of
    ``{role, content, timestamp}`` objects (max 40 entries, trimmed on write).
    """

    __tablename__ = "chat_history"

    exam_id = Column(String, primary_key=True, nullable=False)
    user_id = Column(String, primary_key=True, nullable=False)
    messages_json = Column(Text, nullable=False, default="[]")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
