"""
ORM model for persisting AI-generated analytics summaries.

The summary is keyed by (exam_id, grading_hash) where grading_hash is a
SHA-256 digest of the set of grading-run IDs and graded_count for the exam.
This ensures a new summary is generated only when grading data actually changes,
not on every page load.
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
