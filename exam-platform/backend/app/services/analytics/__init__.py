"""
HKUST CSE Exam Platform – Analytics Aggregation Service

Pure-function analytics that operates on grading runs + proctoring data.
"""

from __future__ import annotations

import math
import statistics
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.analytics_models import (
    AnalyticsOverviewOut,
    ExamAnalyticsSnapshotOut,
    QuestionAnalyticsOut,
    ScoreBucket,
    StudentAnalyticsRecord,
    TopicAnalyticsOut,
)
from app.models.grading_models import GradingRunOut


def get_proctoring_for_exam(
    exam_id: str,
    db: Session,
) -> dict[str, dict]:
    from app.db.repositories.proctoring_repository import ProctoringRepository

    sessions = ProctoringRepository(db).list_sessions_for_exam(exam_id)
    if not sessions:
        return {}

    return {
        session.student_id: {
            "student_name": session.student_name,
            "risk_score": session.risk_score,
            "high_severity_event_count": session.high_severity_event_count,
            "event_count": session.event_count,
        }
        for session in sessions
    }


# ---- Helpers --------------------------------------------------------

def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    return float(statistics.median(values))


def _stdev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    return float(statistics.stdev(values))


def _score_distribution(scores: list[float], max_pts: float) -> list[ScoreBucket]:
    """Build 10-bucket distribution from 0% to 100%."""
    if max_pts <= 0:
        return []
    buckets: list[ScoreBucket] = []
    step = max_pts / 10
    for i in range(10):
        lo = i * step
        hi = (i + 1) * step
        label = f"{int(lo)}-{int(hi)}"
        count = sum(1 for s in scores if lo <= s < hi or (i == 9 and s == hi))
        buckets.append(ScoreBucket(label=label, count=count))
    return buckets


# ---- Snapshot builder -----------------------------------------------

def build_analytics_snapshot(
    exam_id: str,
    course_code: str,
    course_name: str,
    exam_title: str,
    max_total_points: float,
    grading_runs: list[GradingRunOut],
    question_meta: list[dict],  # [{id, title, type, points, topic_ids}]
    db: Optional[Session] = None,
) -> ExamAnalyticsSnapshotOut:
    """Build a full analytics snapshot from grading runs + proctoring."""

    proctoring = get_proctoring_for_exam(exam_id, db=db)

    # ---- student records ----
    students: list[StudentAnalyticsRecord] = []
    total_scores: list[float] = []

    # question_id -> list of scores
    q_scores: dict[str, list[float]] = {q["id"]: [] for q in question_meta}
    q_overrides: dict[str, int] = {q["id"]: 0 for q in question_meta}

    for run in grading_runs:
        qs: dict[str, dict[str, float]] = {}
        override_count = 0
        for qr in run.question_results:
            effective = qr.raw_score
            qs[qr.question_id] = {"score": effective, "max_points": qr.max_points}
            if qr.question_id in q_scores:
                q_scores[qr.question_id].append(effective)
            # count overrides
            has_override = any(
                cr.override_score is not None for cr in qr.criterion_results
            )
            if has_override:
                override_count += 1
                q_overrides[qr.question_id] = q_overrides.get(qr.question_id, 0) + 1

        # topic aggregation
        topic_agg: dict[str, dict[str, float]] = {}
        for qm in question_meta:
            qid = qm["id"]
            if qid in qs:
                for tid in qm.get("topic_ids", []):
                    if tid not in topic_agg:
                        topic_agg[tid] = {"score": 0.0, "max_points": 0.0}
                    topic_agg[tid]["score"] += qs[qid]["score"]
                    topic_agg[tid]["max_points"] += qs[qid]["max_points"]

        proc = proctoring.get(run.student_id, {})
        total = run.total_score
        total_scores.append(total)

        students.append(StudentAnalyticsRecord(
            student_id=run.student_id,
            student_name=proc.get("student_name", run.student_id),
            total_score=total,
            max_score=run.max_total_points,
            percentage=round(total / run.max_total_points * 100, 1) if run.max_total_points > 0 else 0,
            question_scores=qs,
            topic_scores=topic_agg,
            risk_score=proc.get("risk_score"),
            high_severity_event_count=proc.get("high_severity_event_count"),
            proctoring_event_count=proc.get("event_count"),
            review_override_count=override_count,
        ))

    graded_count = len(students)

    # ---- overview ----
    overview = AnalyticsOverviewOut(
        exam_id=exam_id,
        student_count=graded_count,
        graded_count=graded_count,
        mean_score=round(statistics.mean(total_scores), 2) if total_scores else 0,
        median_score=round(_median(total_scores), 2),
        highest_score=max(total_scores) if total_scores else 0,
        lowest_score=min(total_scores) if total_scores else 0,
        std_dev=round(_stdev(total_scores), 2),
        max_total_points=max_total_points,
        mean_percentage=round(
            statistics.mean(total_scores) / max_total_points * 100, 1
        ) if total_scores and max_total_points > 0 else 0,
        score_distribution=_score_distribution(total_scores, max_total_points),
        pass_rate=round(
            sum(1 for s in total_scores if s >= max_total_points * 0.5) / len(total_scores) * 100, 1
        ) if total_scores else 0,
    )

    # ---- question analytics ----
    questions: list[QuestionAnalyticsOut] = []
    for qm in question_meta:
        qid = qm["id"]
        scores = q_scores.get(qid, [])
        mp = qm["points"]
        questions.append(QuestionAnalyticsOut(
            question_id=qid,
            question_title=qm["title"],
            question_type=qm["type"],
            max_points=mp,
            topic_ids=qm.get("topic_ids", []),
            mean_score=round(statistics.mean(scores), 2) if scores else 0,
            median_score=round(_median(scores), 2),
            min_score=min(scores) if scores else 0,
            max_score=max(scores) if scores else 0,
            std_dev=round(_stdev(scores), 2),
            success_rate=round(
                sum(1 for s in scores if mp > 0 and s / mp >= 0.7) / len(scores) * 100, 1
            ) if scores else 0,
            override_count=q_overrides.get(qid, 0),
            score_distribution=_score_distribution(scores, mp),
        ))

    # ---- topic analytics ----
    topic_map: dict[str, dict] = {}
    for qm in question_meta:
        for tid in qm.get("topic_ids", []):
            if tid not in topic_map:
                topic_map[tid] = {"label": tid, "questions": [], "scores": [], "max": 0}
            topic_map[tid]["questions"].append(qm["id"])
            topic_map[tid]["max"] += qm["points"]

    topics: list[TopicAnalyticsOut] = []
    for tid, tm in topic_map.items():
        # gather mean per question to find weakest
        q_means: dict[str, float] = {}
        for qa in questions:
            if qa.question_id in tm["questions"]:
                q_means[qa.question_id] = qa.mean_score / qa.max_points if qa.max_points > 0 else 0

        topic_total_scores: list[float] = []
        for s in students:
            ts = s.topic_scores.get(tid)
            if ts:
                topic_total_scores.append(ts["score"])

        mean_s = statistics.mean(topic_total_scores) if topic_total_scores else 0
        weakest = min(q_means, key=q_means.get) if q_means else None  # type: ignore

        topics.append(TopicAnalyticsOut(
            topic_id=tid,
            topic_label=tm["label"],
            question_count=len(tm["questions"]),
            mean_score=round(mean_s, 2),
            max_possible=tm["max"],
            percentage=round(mean_s / tm["max"] * 100, 1) if tm["max"] > 0 else 0,
            weakest_question_id=weakest,
        ))

    return ExamAnalyticsSnapshotOut(
        exam_id=exam_id,
        course_code=course_code,
        course_name=course_name,
        exam_title=exam_title,
        generated_at=datetime.now(timezone.utc).isoformat(),
        overview=overview,
        questions=questions,
        topics=topics,
        students=students,
    )
