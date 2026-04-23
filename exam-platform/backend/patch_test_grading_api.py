import re

with open("app/api/test_grading_api.py", "r") as f:
    code = f.read()

code = code.replace("from app.storage.grading_storage import get_grading_store", "from app.db.repositories.grading_repository import GradingRepository\nfrom app.db.session import get_db\nfrom fastapi import Depends\nfrom sqlalchemy.orm import Session")

code = re.sub(r'async def submit_and_grade\(body: SubmitRequest\) -> GradingRunOut:', r'async def submit_and_grade(body: SubmitRequest, db: Session = Depends(get_db)) -> GradingRunOut:', code)
code = re.sub(r'get_grading_store\(\)\.save_run\(result\)', r'GradingRepository(db).save_run(result)', code)

code = re.sub(r'async def submit_and_grade_stream\(body: SubmitRequest\):', r'async def submit_and_grade_stream(body: SubmitRequest, db: Session = Depends(get_db)):', code)
code = re.sub(r'get_grading_store\(\)\.save_run\(final_run\)', r'GradingRepository(db).save_run(final_run)', code)

code = re.sub(r'async def clear_all_results\(\) -> dict:', r'async def clear_all_results(db: Session = Depends(get_db)) -> dict:', code)
code = re.sub(r'count = get_grading_store\(\)\.clear_all\(\)', r'count = db.query(GradingRepository(db)._model).delete()\ndb.commit()', code)

code = re.sub(r'async def get_test_results\(run_id: str\) -> GradingRunOut:', r'async def get_test_results(run_id: str, db: Session = Depends(get_db)) -> GradingRunOut:', code)
code = re.sub(r'run = get_grading_store\(\)\.get_run\(run_id\)', r'run = GradingRepository(db).get_run(run_id)', code)

code = re.sub(r'async def submit_test_review\(run_id: str, body: ReviewSubmitRequest\) -> GradingRunOut:', r'async def submit_test_review(run_id: str, body: ReviewSubmitRequest, db: Session = Depends(get_db)) -> GradingRunOut:', code)
code = re.sub(r'store = get_grading_store\(\)', r'store = GradingRepository(db)', code)
code = code.replace("updated = store.apply_review(run.attempt_id, review)", """
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

with open("app/api/test_grading_api.py", "w") as f:
    f.write(code)
