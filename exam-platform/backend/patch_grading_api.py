import re

with open("app/api/grading_api.py", "r") as f:
    code = f.read()

code = code.replace("from app.storage.grading_storage import get_grading_store", "from app.db.repositories.grading_repository import GradingRepository")

code = re.sub(r'async def api_generate_rubric\(body: RubricGenerateRequest\)', r'async def api_generate_rubric(body: RubricGenerateRequest, db: Session = Depends(get_db))', code)
code = re.sub(r'get_grading_store\(\)\.save_rubric\(rubric\)', r'GradingRepository(db).save_rubric(rubric)', code)

code = re.sub(r'grading_store = get_grading_store\(\)', r'grading_store = GradingRepository(db)', code)

code = re.sub(r'async def api_get_grading_result\(\n\s+exam_id: str,\n\s+attempt_id: str,\n\)', r'async def api_get_grading_result(\n    exam_id: str,\n    attempt_id: str,\n    db: Session = Depends(get_db),\n)', code)
code = re.sub(r'get_grading_store\(\)\.get_run_by_attempt\(attempt_id\)', r'GradingRepository(db).get_run_by_attempt(attempt_id)', code)

code = re.sub(r'async def api_submit_review\(\n\s+exam_id: str,\n\s+attempt_id: str,\n\s+body: ReviewSubmitRequest,\n\)', r'async def api_submit_review(\n    exam_id: str,\n    attempt_id: str,\n    body: ReviewSubmitRequest,\n    db: Session = Depends(get_db),\n)', code)
code = re.sub(r'store = get_grading_store\(\)', r'store = GradingRepository(db)', code)
code = code.replace("updated = store.apply_review(attempt_id, review)", """
    # Re-use legacy apply_review logic here, or just inline it:
    if review.override_score is not None:
        for qr in run.question_results:
            if qr.question_id == review.question_id:
                qr.raw_score = review.override_score
                qr.status = "reviewed"
                if qr.max_points > 0:
                    qr.normalized_score = qr.raw_score / qr.max_points
                break
    run.reviews.append(review)
    run.total_score = sum(qr.raw_score for qr in run.question_results)
    run.status = "reviewed"
    updated = store.save_run(run)
""")


code = re.sub(r'async def api_list_runs\(exam_id: str\) -> list\[GradingRunOut\]:', r'async def api_list_runs(exam_id: str, db: Session = Depends(get_db)) -> list[GradingRunOut]:', code)
code = re.sub(r'get_grading_store\(\)\.list_runs_for_exam\(exam_id\)', r'GradingRepository(db).list_runs_for_exam(exam_id)', code)

with open("app/api/grading_api.py", "w") as f:
    f.write(code)
