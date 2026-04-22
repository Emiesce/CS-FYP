from __future__ import annotations

from typing import Optional
from sqlalchemy.orm import Session
from app.db.models.core import Course, Exam, ExamQuestion
from app.models.exam_models import ExamDefinitionIn, ExamDefinitionOut, ExamQuestionIn, QuestionRubric
import uuid

class ExamRepository:
    def __init__(self, db: Session):
        self.db = db

    def _to_pydantic(self, exam: Exam) -> ExamDefinitionOut:
        questions_in = []
        for q in exam.questions:
            rubric = QuestionRubric(**q.rubric_json) if q.rubric_json else None
            # Need to re-instantiate correct type enum
            q_data = {"type": q.type, **q.type_data_json}
            
            questions_in.append(ExamQuestionIn(
                id=q.id,
                order=q.order,
                title=q.title,
                prompt=q.prompt,
                points=q.points,
                required=q.required,
                rubric=rubric,
                type_data=q_data,
                topic_ids=q.topic_ids_json or [],
            ))
            
        return ExamDefinitionOut(
            id=exam.id,
            course_code=exam.course_code,
            course_name=exam.course_name,
            title=exam.title,
            date=exam.date,
            start_time=exam.start_time,
            duration_seconds=exam.duration_seconds,
            location=exam.location,
            instructions=exam.instructions,
            questions=questions_in,
            total_points=float(exam.total_points),
            created_at=exam.created_at,
            updated_at=exam.updated_at
        )

    def create(self, payload: ExamDefinitionIn) -> ExamDefinitionOut:
        exam_id = str(uuid.uuid4())
        course = (
            self.db.query(Course)
            .filter(Course.code == payload.course_code.strip().upper())
            .first()
        )
        if course is None:
            course = Course(
                code=payload.course_code.strip().upper(),
                name=payload.course_name,
                semester_id="2025-26-spring",
            )
            self.db.add(course)
            self.db.flush()

        total = sum(q.points for q in payload.questions)
        exam = Exam(
            id=exam_id,
            course_id=course.id,
            course_code=course.code,
            course_name=payload.course_name,
            semester_id=course.semester_id,
            status="upcoming",
            title=payload.title,
            date=payload.date,
            start_time=payload.start_time,
            duration_seconds=payload.duration_seconds,
            location=payload.location,
            instructions=payload.instructions,
            total_points=total
        )
        self.db.add(exam)
        
        for q in payload.questions:
            eq = ExamQuestion(
                id=q.id,
                exam_id=exam_id,
                order=q.order,
                title=q.title,
                prompt=q.prompt,
                points=q.points,
                required=q.required,
                rubric_json=q.rubric.model_dump(exclude={"structured_rubric"}, exclude_none=True) if q.rubric else None,
                type=q.type_data.type,
                type_data_json=q.type_data.model_dump(),
                topic_ids_json=q.topic_ids or [],
            )
            self.db.add(eq)
            
        self.db.commit()
        self.db.refresh(exam)
        return self._to_pydantic(exam)

    def list(self) -> list[ExamDefinitionOut]:
        exams = self.db.query(Exam).order_by(Exam.created_at.desc()).all()
        return [self._to_pydantic(e) for e in exams]

    def get(self, exam_id: str) -> Optional[ExamDefinitionOut]:
        exam = self.db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            return None
        return self._to_pydantic(exam)

    def update(self, exam_id: str, payload: ExamDefinitionIn) -> Optional[ExamDefinitionOut]:
        exam = self.db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            return None
            
        exam.course_code = payload.course_code
        exam.course_name = payload.course_name
        course = (
            self.db.query(Course)
            .filter(Course.code == payload.course_code.strip().upper())
            .first()
        )
        if course is not None:
            exam.course_id = course.id
            exam.semester_id = course.semester_id
        exam.title = payload.title
        exam.date = payload.date
        exam.start_time = payload.start_time
        exam.duration_seconds = payload.duration_seconds
        exam.location = payload.location
        exam.instructions = payload.instructions
        exam.total_points = sum(q.points for q in payload.questions)
        
        # Simple approach: delete existing questions, re-add new ones
        self.db.query(ExamQuestion).filter(ExamQuestion.exam_id == exam_id).delete()
        for q in payload.questions:
            eq = ExamQuestion(
                id=q.id,
                exam_id=exam_id,
                order=q.order,
                title=q.title,
                prompt=q.prompt,
                points=q.points,
                required=q.required,
                rubric_json=q.rubric.model_dump(exclude={"structured_rubric"}, exclude_none=True) if q.rubric else None,
                type=q.type_data.type,
                type_data_json=q.type_data.model_dump(),
                topic_ids_json=q.topic_ids or [],
            )
            self.db.add(eq)
            
        self.db.commit()
        self.db.refresh(exam)
        return self._to_pydantic(exam)