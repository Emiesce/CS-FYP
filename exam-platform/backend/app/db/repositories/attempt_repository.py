from __future__ import annotations

from typing import List, Optional
from sqlalchemy.orm import Session
from app.db.models.core import CourseEnrollment, Exam, ExamAttempt, QuestionResponse
from app.models.exam_models import ExamAttemptIn, ExamAttemptOut, AttemptStatus, QuestionResponseIn
import uuid
from datetime import datetime

class AttemptRepository:
    def __init__(self, db: Session):
        self.db = db

    def _to_pydantic(self, attempt: ExamAttempt) -> ExamAttemptOut:
        responses = []
        for r in attempt.responses:
            responses.append(QuestionResponseIn(
                question_id=r.question_id,
                question_type=r.question_type,
                value=r.value_json,
                answered_at=r.answered_at
            ))
            
        return ExamAttemptOut(
            id=attempt.id,
            exam_id=attempt.exam_id,
            student_id=attempt.student_id,
            status=AttemptStatus(attempt.status),
            started_at=attempt.started_at,
            submitted_at=attempt.submitted_at,
            current_question_index=attempt.current_question_index,
            flagged_question_ids=attempt.flagged_question_ids_json,
            responses=responses
        )

    def start_attempt(self, payload: ExamAttemptIn) -> ExamAttemptOut:
        existing = self.db.query(ExamAttempt).filter(
            ExamAttempt.exam_id == payload.exam_id,
            ExamAttempt.student_id == payload.student_id
        ).first()
        
        if existing:
            return self._to_pydantic(existing)
            
        attempt_id = str(uuid.uuid4())
        at = ExamAttempt(
            id=attempt_id,
            exam_id=payload.exam_id,
            student_id=payload.student_id,
            status="in_progress",
            current_question_index=payload.current_question_index,
            flagged_question_ids_json=payload.flagged_question_ids
        )
        self.db.add(at)
        
        for r in payload.responses:
            qr = QuestionResponse(
                id=str(uuid.uuid4()),
                attempt_id=attempt_id,
                question_id=r.question_id,
                question_type=r.question_type,
                value_json=r.value,
                answered_at=r.answered_at
            )
            self.db.add(qr)
            
        self.db.commit()
        self.db.refresh(at)
        return self._to_pydantic(at)

    def get_attempt(self, exam_id: str, student_id: str) -> Optional[ExamAttemptOut]:
        attempt = self.db.query(ExamAttempt).filter(
            ExamAttempt.exam_id == exam_id,
            ExamAttempt.student_id == student_id
        ).first()
        
        if not attempt:
            return None
        return self._to_pydantic(attempt)

    def list_attempts_for_exam(self, exam_id: str) -> List[ExamAttemptOut]:
        attempts = (
            self.db.query(ExamAttempt)
            .filter(ExamAttempt.exam_id == exam_id)
            .all()
        )
        return [self._to_pydantic(attempt) for attempt in attempts]

    def save_draft(self, payload: ExamAttemptIn) -> Optional[ExamAttemptOut]:
        attempt = self.db.query(ExamAttempt).filter(
            ExamAttempt.exam_id == payload.exam_id,
            ExamAttempt.student_id == payload.student_id
        ).first()
        
        if not attempt:
            return None
            
        attempt.current_question_index = payload.current_question_index
        attempt.flagged_question_ids_json = payload.flagged_question_ids
        
        # Naive approach: overwrite responses
        self.db.query(QuestionResponse).filter(QuestionResponse.attempt_id == attempt.id).delete()
        for r in payload.responses:
            qr = QuestionResponse(
                id=str(uuid.uuid4()),
                attempt_id=attempt.id,
                question_id=r.question_id,
                question_type=r.question_type,
                value_json=r.value,
                answered_at=r.answered_at
            )
            self.db.add(qr)
            
        self.db.commit()
        self.db.refresh(attempt)
        return self._to_pydantic(attempt)

    def submit_attempt(self, exam_id: str, student_id: str) -> Optional[ExamAttemptOut]:
        attempt = self.db.query(ExamAttempt).filter(
            ExamAttempt.exam_id == exam_id,
            ExamAttempt.student_id == student_id
        ).first()
        
        if not attempt:
            return None
            
        attempt.status = "submitted"
        attempt.submitted_at = datetime.utcnow()
        self.db.flush()

        # Mark the exam as "past" once all enrolled students have submitted.
        exam = self.db.query(Exam).filter(Exam.id == exam_id).first()
        if exam and exam.status == "current":
            enrolled_ids = set(
                row.user_id
                for row in self.db.query(CourseEnrollment).filter(
                    CourseEnrollment.course_id == exam.course_id
                ).all()
            )
            submitted_ids = set(
                row.student_id
                for row in self.db.query(ExamAttempt).filter(
                    ExamAttempt.exam_id == exam_id,
                    ExamAttempt.status.in_(["submitted", "timed_out"]),
                ).all()
            )
            if enrolled_ids and enrolled_ids.issubset(submitted_ids):
                exam.status = "past"

        self.db.commit()
        self.db.refresh(attempt)
        return self._to_pydantic(attempt)