"""
One-time migration: merge q6bii grading results into q6bi across all
persisted GradingRun rows for exam 'comp1023-finals-f25'.

What it does per student run:
  1. Find question_results entries for 'finals-q6bi' and 'finals-q6bii'.
  2. Sum raw_score; combine criterion_results lists.
  3. Set max_points = 4.0, recompute normalized_score.
  4. Merge rationale strings; keep q6bi student_answer (or concatenate).
  5. Remove the q6bii entry from question_results.
  6. Recompute run.total_score as sum of all raw_scores.
  7. Persist via GradingRepository.save_run().

Run from inside the backend/ directory:
    PYTHONPATH=. python scripts/merge_q6bii_into_q6bi.py
"""

import sys
import os

# Allow running from repo root or backend/ directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import SessionLocal
from app.db.repositories.grading_repository import GradingRepository

EXAM_ID = "comp1023-finals-f25"
Q_A_ID = "finals-q6bi"
Q_B_ID = "finals-q6bii"
NEW_MAX_POINTS = 4.0


def _get(d: dict, *keys, default=None):
    for k in keys:
        if k in d:
            return d[k]
    return default


def merge_run(run_out, repo) -> bool:
    """Merge q6bii into q6bi for a single GradingRunOut. Returns True if changed."""
    results = [r.model_dump(mode="json") for r in run_out.question_results]

    idx_a = next((i for i, r in enumerate(results) if r.get("question_id") == Q_A_ID), None)
    idx_b = next((i for i, r in enumerate(results) if r.get("question_id") == Q_B_ID), None)

    if idx_a is None:
        print(f"  [SKIP] student={run_out.student_id}: q6bi not found")
        return False

    if idx_b is None:
        # q6bii was not graded (absent / skipped); just update max_points on q6bi
        if abs(results[idx_a].get("max_points", 0) - NEW_MAX_POINTS) < 0.001:
            print(f"  [SKIP] student={run_out.student_id}: q6bii absent, q6bi already at 4.0 pts")
            return False
        results[idx_a]["max_points"] = NEW_MAX_POINTS
        raw = float(results[idx_a].get("raw_score") or 0)
        results[idx_a]["normalized_score"] = round(raw / NEW_MAX_POINTS, 6)
        print(f"  [UPDATE] student={run_out.student_id}: q6bii absent – updated q6bi max_points to 4.0")
    else:
        qa = results[idx_a]
        qb = results[idx_b]

        raw_a = float(qa.get("raw_score") or 0)
        raw_b = float(qb.get("raw_score") or 0)
        combined_raw = raw_a + raw_b

        # Merge criterion results
        crits_a = qa.get("criterion_results") or []
        crits_b = qb.get("criterion_results") or []
        combined_crits = crits_a + crits_b

        # Merge rationale
        rat_a = (qa.get("rationale") or "").strip()
        rat_b = (qb.get("rationale") or "").strip()
        combined_rationale = (
            f"[Part (i)] {rat_a}\n\n[Part (ii)] {rat_b}"
            if rat_a or rat_b
            else ""
        )

        # Merge student_answer
        ans_a = (qa.get("student_answer") or "").strip()
        ans_b = (qb.get("student_answer") or "").strip()
        combined_answer = (
            f"Part (i):\n{ans_a}\n\nPart (ii):\n{ans_b}"
            if ans_b
            else ans_a
        )

        # Determine merged status
        status_a = qa.get("status", "graded")
        status_b = qb.get("status", "graded")
        # escalated > incomplete > graded
        priority = {"escalated": 2, "incomplete": 1, "graded": 0}
        merged_status = max([status_a, status_b], key=lambda s: priority.get(s, 0))

        # Update q6bi in-place
        results[idx_a]["raw_score"] = combined_raw
        results[idx_a]["max_points"] = NEW_MAX_POINTS
        results[idx_a]["normalized_score"] = round(combined_raw / NEW_MAX_POINTS, 6)
        results[idx_a]["criterion_results"] = combined_crits
        results[idx_a]["rationale"] = combined_rationale
        results[idx_a]["student_answer"] = combined_answer
        results[idx_a]["status"] = merged_status

        # Remove q6bii
        results = [r for i, r in enumerate(results) if i != idx_b]

        print(
            f"  [MERGE] student={run_out.student_id}: "
            f"q6bi={raw_a:.2f} + q6bii={raw_b:.2f} → combined={combined_raw:.2f}/4.0"
        )

    # Recompute total_score
    new_total = sum(float(r.get("raw_score") or 0) for r in results)

    # Rebuild run_out with updated results using Pydantic model
    from app.models.grading_models import QuestionGradeResult, GradingRunOut

    updated_results = [QuestionGradeResult(**r) for r in results]
    updated_run = GradingRunOut(
        id=run_out.id,
        exam_id=run_out.exam_id,
        attempt_id=run_out.attempt_id,
        student_id=run_out.student_id,
        total_score=new_total,
        max_total_points=sum(float(r.get("max_points") or 0) for r in results),
        status=run_out.status,
        started_at=run_out.started_at,
        completed_at=run_out.completed_at,
        question_results=updated_results,
        reviews=run_out.reviews,
        model_usage=run_out.model_usage,
    )

    repo.save_run(updated_run)
    return True


def main():
    db = SessionLocal()
    try:
        repo = GradingRepository(db)
        runs = repo.list_runs_for_exam(EXAM_ID)
        print(f"Found {len(runs)} grading run(s) for exam '{EXAM_ID}'")

        changed = 0
        for run in runs:
            if merge_run(run, repo):
                changed += 1

        print(f"\nDone. {changed}/{len(runs)} run(s) updated.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
