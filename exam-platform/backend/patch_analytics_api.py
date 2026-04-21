import re

with open("app/api/analytics_api.py", "r") as f:
    code = f.read()

code = code.replace("from app.storage.grading_storage import get_grading_store", "from app.db.repositories.grading_repository import GradingRepository")

# _get_snapshot replacement
code = code.replace("grading_store = get_grading_store()", "grading_store = GradingRepository(db) if db else None")
code = code.replace("runs = grading_store.list_runs_for_exam(exam_id)", "runs = grading_store.list_runs_for_exam(exam_id) if grading_store else []")

with open("app/api/analytics_api.py", "w") as f:
    f.write(code)
