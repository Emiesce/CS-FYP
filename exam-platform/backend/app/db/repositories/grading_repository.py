import uuid
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.models.grading import GradingRun, Rubric
from app.models.grading_models import GradingRunOut, ModelUsageRecord, StructuredRubric

class GradingRepository:
    def __init__(self, db: Session):
        self.db = db

    def _derive_max_total_points(self, run: GradingRun) -> float:
        question_results = run.question_results or []
        return float(sum(float(question.get("max_points", 0) or 0) for question in question_results))

    def _derive_model_usage(self, run: GradingRun) -> list[dict]:
        question_results = run.question_results or []
        usage_records: list[dict] = []
        for question in question_results:
            model = question.get("model")
            token_usage = question.get("token_usage") or {}
            if not model:
                continue
            usage_records.append(
                ModelUsageRecord(
                    model=model,
                    question_id=question.get("question_id", ""),
                    prompt_tokens=int(token_usage.get("prompt", 0) or 0),
                    completion_tokens=int(token_usage.get("completion", 0) or 0),
                    latency_ms=int(question.get("latency_ms", 0) or 0),
                    cached=False,
                ).model_dump(mode="json")
            )
        return usage_records

    def _to_pydantic(self, run: GradingRun) -> GradingRunOut:
        max_total_points = self._derive_max_total_points(run)
        model_usage = self._derive_model_usage(run)
        return GradingRunOut(**{
            "id": run.id,
            "exam_id": run.exam_id,
            "attempt_id": run.attempt_id,
            "student_id": run.student_id,
            "total_score": run.total_score,
            "status": run.status,
            "started_at": run.started_at,
            "completed_at": run.completed_at,
            "question_results": run.question_results or [],
            "reviews": run.reviews or [],
            "max_total_points": max_total_points,
            "model_usage": model_usage,
        })

    def save_run(self, run_out: GradingRunOut) -> GradingRunOut:
        # Use (exam_id, student_id) as the stable key to detect re-grades,
        # since attempt_id is regenerated on every grading run.
        run = (
            self.db.query(GradingRun)
            .filter(
                GradingRun.exam_id == run_out.exam_id,
                GradingRun.student_id == run_out.student_id,
            )
            .first()
        )
        if run:
            # Re-grade: overwrite all fields on the existing row
            run.id = run_out.id
            run.attempt_id = run_out.attempt_id
        else:
            # First-time grade: insert a new row
            run = GradingRun(id=run_out.id)
            run.attempt_id = run_out.attempt_id
            self.db.add(run)

        run.exam_id = run_out.exam_id
        run.student_id = run_out.student_id
        run.total_score = run_out.total_score
        # status may be a GradingRunStatus enum or a plain string (e.g. after review)
        run.status = run_out.status.value if hasattr(run_out.status, "value") else run_out.status
        run.started_at = run_out.started_at
        run.completed_at = run_out.completed_at
        run.question_results = [q.model_dump(mode="json") for q in run_out.question_results]
        run.reviews = [r.model_dump(mode="json") for r in run_out.reviews]

        self.db.commit()
        self.db.refresh(run)
        return self._to_pydantic(run)

    def get_run(self, run_id: str) -> Optional[GradingRunOut]:
        run = self.db.query(GradingRun).filter(GradingRun.id == run_id).first()
        if not run:
            return None
        return self._to_pydantic(run)

    def get_run_by_attempt(self, attempt_id: str) -> Optional[GradingRunOut]:
        run = self.db.query(GradingRun).filter(GradingRun.attempt_id == attempt_id).first()
        if not run:
            return None
        return self._to_pydantic(run)

    def list_runs_for_exam(self, exam_id: str) -> List[GradingRunOut]:
        runs = self.db.query(GradingRun).filter(GradingRun.exam_id == exam_id).all()
        return [self._to_pydantic(run) for run in runs]

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
