import re

with open("app/services/analytics/__init__.py", "r") as f:
    code = f.read()

# remove _proctoring_store declarations
code = re.sub(r'# ---- Proctoring store \(simple in-memory\) ----------------------------\n\n_proctoring_store: dict\[str, dict\[str, dict\]\] = \{\}  # examId -> studentId -> summary\n\n\ndef save_proctoring_sync\([\s\S]*?\) -> None:\n    _proctoring_store\.setdefault\([\s\S]*?\}\n\n\n', '', code)

code = code.replace("def get_proctoring_for_exam(", "def get_proctoring_for_exam(")
# replace get_proctoring_for_exam body
code = re.sub(r'def get_proctoring_for_exam\(\n\s+exam_id: str,\n\s+db: Optional\[Session\] = None,\n\) -> dict\[str, dict\]:[\s\S]*?return hydrated\n', """def get_proctoring_for_exam(
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
""", code)

with open("app/services/analytics/__init__.py", "w") as f:
    f.write(code)

with open("app/api/analytics_api.py", "r") as f:
    api_code = f.read()

api_code = re.sub(r'    save_proctoring_sync,\n', '', api_code)
api_code = re.sub(r'    # 2. Keep in-memory analytics cache updated\n    save_proctoring_sync\([\s\S]*?event_count=body.event_count,\n    \)\n', '', api_code)

with open("app/api/analytics_api.py", "w") as f:
    f.write(api_code)

