"""
HKUST CSE Exam Platform – Exam Storage Layer

In-memory persistence for exam definitions and student attempts.
Consistent with the existing SessionStore pattern.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from app.models.exam_models import (
    AttemptStatus,
    ExamAttemptIn,
    ExamAttemptOut,
    ExamDefinitionIn,
    ExamDefinitionOut,
    ExamQuestionIn,
)


class ExamStore:
    """In-memory store for exam definitions and student attempts."""

    def __init__(self) -> None:
        self._definitions: dict[str, ExamDefinitionOut] = {}
        self._attempts: dict[str, ExamAttemptOut] = {}  # keyed by "examId:studentId"

    # ------------------------------------------------------------------
    # Exam definitions
    # ------------------------------------------------------------------

    def create_definition(self, data: ExamDefinitionIn) -> ExamDefinitionOut:
        exam_id = f"exam-{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow()
        total_points = sum(q.points for q in data.questions)
        definition = ExamDefinitionOut(
            id=exam_id,
            course_code=data.course_code,
            course_name=data.course_name,
            title=data.title,
            date=data.date,
            start_time=data.start_time,
            duration_seconds=data.duration_seconds,
            location=data.location,
            instructions=data.instructions,
            questions=data.questions,
            total_points=total_points,
            created_at=now,
            updated_at=now,
        )
        self._definitions[exam_id] = definition
        return definition

    def update_definition(
        self, exam_id: str, data: ExamDefinitionIn
    ) -> Optional[ExamDefinitionOut]:
        existing = self._definitions.get(exam_id)
        if not existing:
            return None
        total_points = sum(q.points for q in data.questions)
        updated = ExamDefinitionOut(
            id=exam_id,
            course_code=data.course_code,
            course_name=data.course_name,
            title=data.title,
            date=data.date,
            start_time=data.start_time,
            duration_seconds=data.duration_seconds,
            location=data.location,
            instructions=data.instructions,
            questions=data.questions,
            total_points=total_points,
            created_at=existing.created_at,
            updated_at=datetime.utcnow(),
        )
        self._definitions[exam_id] = updated
        return updated

    def get_definition(self, exam_id: str) -> Optional[ExamDefinitionOut]:
        return self._definitions.get(exam_id)

    def list_definitions(self) -> list[ExamDefinitionOut]:
        return list(self._definitions.values())

    # ------------------------------------------------------------------
    # Student attempts
    # ------------------------------------------------------------------

    def start_attempt(self, data: ExamAttemptIn) -> ExamAttemptOut:
        key = f"{data.exam_id}:{data.student_id}"
        existing = self._attempts.get(key)
        if existing and existing.status == AttemptStatus.IN_PROGRESS:
            return existing
        attempt_id = f"attempt-{uuid.uuid4().hex[:8]}"
        attempt = ExamAttemptOut(
            id=attempt_id,
            exam_id=data.exam_id,
            student_id=data.student_id,
            status=AttemptStatus.IN_PROGRESS,
            started_at=datetime.utcnow(),
            responses=data.responses,
            current_question_index=data.current_question_index,
            flagged_question_ids=data.flagged_question_ids,
        )
        self._attempts[key] = attempt
        return attempt

    def save_draft(self, data: ExamAttemptIn) -> Optional[ExamAttemptOut]:
        key = f"{data.exam_id}:{data.student_id}"
        existing = self._attempts.get(key)
        if not existing:
            return None
        existing.responses = data.responses
        existing.current_question_index = data.current_question_index
        existing.flagged_question_ids = data.flagged_question_ids
        return existing

    def submit_attempt(
        self, exam_id: str, student_id: str
    ) -> Optional[ExamAttemptOut]:
        key = f"{exam_id}:{student_id}"
        existing = self._attempts.get(key)
        if not existing:
            return None
        existing.status = AttemptStatus.SUBMITTED
        existing.submitted_at = datetime.utcnow()
        return existing

    def get_attempt(
        self, exam_id: str, student_id: str
    ) -> Optional[ExamAttemptOut]:
        return self._attempts.get(f"{exam_id}:{student_id}")


# Singleton
_exam_store: Optional[ExamStore] = None


def get_exam_store() -> ExamStore:
    global _exam_store
    if _exam_store is None:
        _exam_store = ExamStore()
    return _exam_store
