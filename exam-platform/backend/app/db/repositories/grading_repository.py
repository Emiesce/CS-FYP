import uuid
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.models.grading import GradingRun, Rubric
from app.models.grading_models import GradingRunOut, StructuredRubric

class GradingRepository:
    def __init__(self, db: Session):
        self.db = db

    def save_run(self, run_out: GradingRunOut) -> GradingRunOut:
        run = self.db.query(GradingRun).filter(GradingRun.id == run_out.id).first()
        if not run:
            run = GradingRun(id=run_out.id)
            self.db.add(run)

        run.exam_id = run_out.exam_id
        run.attempt_id = run_out.attempt_id
        run.student_id = run_out.student_id
        run.total_score = run_out.total_score
        run.status = run_out.status.value
        run.started_at = run_out.started_at
        run.completed_at = run_out.completed_at
        run.question_results = [q.model_dump(mode="json") for q in run_out.question_results]
        run.reviews = [r.model_dump(mode="json") for r in run_out.reviews]

        self.db.commit()
        self.db.refresh(run)
        return run_out

    def get_run(self, run_id: str) -> Optional[GradingRunOut]:
        run = self.db.query(GradingRun).filter(GradingRun.id == run_id).first()
        if not run:
            return None
        return GradingRunOut(**{
            "id": run.id,
            "exam_id": run.exam_id,
            "attempt_id": run.attempt_id,
            "student_id": run.student_id,
            "total_score": run.total_score,
            "status": run.status,
            "started_at": run.started_at,
            "completed_at": run.completed_at,
            "question_results": run.question_results,
            "reviews": run.reviews,
        })

    def get_run_by_attempt(self, attempt_id: str) -> Optional[GradingRunOut]:
        run = self.db.query(GradingRun).filter(GradingRun.attempt_id == attempt_id).first()
        if not run:
            return None
        return GradingRunOut(**{
            "id": run.id,
            "exam_id": run.exam_id,
            "attempt_id": run.attempt_id,
            "student_id": run.student_id,
            "total_score": run.total_score,
            "status": run.status,
            "started_at": run.started_at,
            "completed_at": run.completed_at,
            "question_results": run.question_results,
            "reviews": run.reviews,
        })

    def list_runs_for_exam(self, exam_id: str) -> List[GradingRunOut]:
        runs = self.db.query(GradingRun).filter(GradingRun.exam_id == exam_id).all()
        return [
            GradingRunOut(**{
                "id": run.id,
                "exam_id": run.exam_id,
                "attempt_id": run.attempt_id,
                "student_id": run.student_id,
                "total_score": run.total_score,
                "status": run.status,
                "started_at": run.started_at,
                "completed_at": run.completed_at,
                "question_results": run.question_results,
                "reviews": run.reviews,
            })
            for run in runs
        ]

    def save_rubric(self, rubric: StructuredRubric) -> StructuredRubric:
        r = self.db.query(Rubric).filter(Rubric.question_id == rubric.question_id).first()
        if not r:
            r = Rubric(id=str(uuid.uuid4()), question_id=rubric.question_id)
            self.db.add(r)
        
        r.content = rubric.model_dump(mode="json")
        self.db.commit()
        return rubric

    def get_rubric(self, question_id: str) -> Optional[StructuredRubric]:
        r = self.db.query(Rubric).filter(Rubric.question_id == question_id).first()
        if not r:
            return None
        return StructuredRubric(**r.content)

    def list_rubrics_for_questions(self, question_ids: List[str]) -> dict[str, StructuredRubric]:
        rubrics = self.db.query(Rubric).filter(Rubric.question_id.in_(question_ids)).all()
        return {
            r.question_id: StructuredRubric(**r.content)
            for r in rubrics
        }
