from datetime import datetime
from typing import Any
from sqlalchemy import (
    Column,
    String,
    Float,
    DateTime,
    ForeignKey,
    JSON,
    Enum,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB

from .core import Base

class GradingRun(Base):
    __tablename__ = "grading_runs"

    id = Column(String, primary_key=True)
    exam_id = Column(String, index=True, nullable=False)
    attempt_id = Column(String, index=True, nullable=False, unique=True)
    student_id = Column(String, index=True, nullable=False)
    
    total_score = Column(Float, nullable=False, default=0.0)
    status = Column(String, nullable=False)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Store the complex structured data as JSONB
    question_results = Column(JSONB, nullable=False, default=list)
    reviews = Column(JSONB, nullable=False, default=list)

class Rubric(Base):
    __tablename__ = "rubrics"

    id = Column(String, primary_key=True)
    question_id = Column(String, index=True, nullable=False, unique=True)
    content = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
