from datetime import datetime, timedelta
import json
import os

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.db.models.core import User, Course, CourseStaff, CourseEnrollment, Exam, ExamQuestion, ExamAttempt, QuestionResponse
from app.db.models.grading import GradingRun, Rubric
from app.db.models.proctoring import ProctoringBucket, ProctoringEvent, ProctoringSession
from app.fixtures.comp1023_exam import build_comp1023_exam
from app.fixtures.comp1023_finals_exam import build_comp1023_finals_exam
from app.fixtures.mgmt2110_exam import (
    EXAM_ID as MGMT2110_EXAM_ID,
    build_mgmt2110_exam,
    load_answer_dataset,
)
from app.seed_data import DEMO_COURSES, DEMO_CURRENT_EXAM, DEMO_UPCOMING_EXAMS, DEMO_USERS

def clear_data(db):
    print("Clearing old data...")
    db.query(ProctoringBucket).delete()
    db.query(ProctoringEvent).delete()
    db.query(ProctoringSession).delete()
    db.query(GradingRun).delete()
    db.query(Rubric).delete()
    db.query(QuestionResponse).delete()
    db.query(ExamAttempt).delete()
    db.query(ExamQuestion).delete()
    db.query(Exam).delete()
    db.query(CourseEnrollment).delete()
    db.query(CourseStaff).delete()
    db.query(Course).delete()
    db.query(User).delete()
    db.commit()

def seed_users(db):
    print("Seeding users...")
    users = []
    for account in DEMO_USERS:
        user = User(
            id=account["id"],
            email=account["email"],
            first_name=account["first_name"],
            last_name=account["last_name"],
            role=account["role"],
            student_number=account["student_number"],
            avatar_url=account["avatar_url"],
            password_hash=hash_password(account["password"]),
        )
        users.append(user)
        db.merge(user)
    db.commit()
    return users

def seed_courses(db):
    print("Seeding courses...")
    for course_data in DEMO_COURSES:
        course = Course(
            id=course_data["id"],
            code=course_data["code"],
            name=course_data["name"],
            semester_id=course_data["semester_id"],
        )
        db.merge(course)

        for instructor_id in course_data["instructor_ids"]:
            db.merge(CourseStaff(course_id=course.id, user_id=instructor_id, role="instructor"))
        for ta_id in course_data["ta_ids"]:
            db.merge(CourseStaff(course_id=course.id, user_id=ta_id, role="teaching_assistant"))
        for student_id in course_data["student_ids"]:
            db.merge(CourseEnrollment(course_id=course.id, user_id=student_id))

    db.commit()

def seed_exams(db):
    print("Seeding exams...")

    for builder, cid in [
        (build_comp1023_exam, "course-comp1023"),
        (build_comp1023_finals_exam, "course-comp1023"),
        (build_mgmt2110_exam, "course-mgmt2110"),
    ]:
        fixture = builder()
        semester_id = db.query(Course).filter(Course.id == cid).first().semester_id
        exam = Exam(
            id=fixture.id,
            course_id=cid,
            course_code=fixture.course_code,
            course_name=fixture.course_name,
            semester_id=semester_id,
            status="past",
            title=fixture.title,
            date=fixture.date,
            start_time=fixture.start_time,
            duration_seconds=fixture.duration_seconds,
            location=fixture.location,
            instructions=fixture.instructions,
            total_points=fixture.total_points
        )
        db.merge(exam)
        
        for q in fixture.questions:
            eq = ExamQuestion(
                id=q.id,
                exam_id=exam.id,
                order=q.order,
                title=q.title,
                prompt=q.prompt,
                points=q.points,
                required=q.required,
                rubric_json=q.rubric.model_dump() if q.rubric else None,
                type=q.type_data.type,
                type_data_json=q.type_data.model_dump()
            )
            db.merge(eq)

    current_exam = Exam(
        id=DEMO_CURRENT_EXAM["id"],
        course_id=DEMO_CURRENT_EXAM["course_id"],
        course_code=DEMO_CURRENT_EXAM["course_code"],
        course_name=DEMO_CURRENT_EXAM["course_name"],
        semester_id=DEMO_CURRENT_EXAM["semester_id"],
        status=DEMO_CURRENT_EXAM["status"],
        title=DEMO_CURRENT_EXAM["title"],
        date=DEMO_CURRENT_EXAM["date"],
        start_time=DEMO_CURRENT_EXAM["start_time"],
        duration_seconds=DEMO_CURRENT_EXAM["duration_seconds"],
        location=DEMO_CURRENT_EXAM["location"],
        instructions=DEMO_CURRENT_EXAM["instructions"],
        total_points=0,
    )
    db.merge(current_exam)

    for upcoming in DEMO_UPCOMING_EXAMS:
        db.merge(
            Exam(
                id=upcoming["id"],
                course_id=upcoming["course_id"],
                course_code=upcoming["course_code"],
                course_name=upcoming["course_name"],
                semester_id=upcoming["semester_id"],
                status=upcoming["status"],
                title=upcoming["title"],
                date=upcoming["date"],
                start_time=upcoming["start_time"],
                duration_seconds=upcoming["duration_seconds"],
                location=upcoming["location"],
                instructions=upcoming["instructions"],
                total_points=0,
            )
        )

    db.commit()


def _split_name(full_name: str) -> tuple[str, str]:
    parts = [part for part in full_name.strip().split() if part]
    if not parts:
        return "Student", "User"
    if len(parts) == 1:
        return parts[0], "User"
    return parts[0], " ".join(parts[1:])


def seed_mgmt2110_dataset(db):
    print("Seeding MGMT2110 submitted answers...")

    answer_rows = load_answer_dataset()
    exam = build_mgmt2110_exam()
    question_type_map = {question.id: question.type_data.type for question in exam.questions}
    base_started_at = datetime(2026, 4, 17, 12, 0, 0)

    # Student number of the Demo Account – their answers will be linked to stu-001
    DEMO_STUDENT_NUMBER = "21841234"
    DEMO_USER_ID = "stu-001"

    for index, row in enumerate(answer_rows):
        student_number = str(row["studentId"])
        first_name, last_name = _split_name(str(row["studentName"]))

        # If this is the demo student, reuse the existing stu-001 account
        is_demo = (student_number == DEMO_STUDENT_NUMBER)
        user_id = DEMO_USER_ID if is_demo else f"mgmt-stu-{student_number}"

        started_at = base_started_at + timedelta(minutes=index)
        submitted_at = started_at + timedelta(minutes=45)

        if not is_demo:
            # Only create a separate user record for non-demo students
            db.merge(
                User(
                    id=user_id,
                    email=f"mgmt2110.{student_number}@seed.local",
                    first_name=first_name,
                    last_name=last_name,
                    role="student",
                    student_number=student_number,
                    avatar_url=None,
                    password_hash=hash_password(f"seed-{student_number}"),
                )
            )
        db.flush()

        # Enroll in MGMT2110 (merge is idempotent)
        db.merge(CourseEnrollment(course_id="course-mgmt2110", user_id=user_id))

        attempt_id = f"attempt-{MGMT2110_EXAM_ID}-{student_number}"
        db.add(
            ExamAttempt(
                id=attempt_id,
                exam_id=MGMT2110_EXAM_ID,
                student_id=user_id,
                status="submitted",
                started_at=started_at,
                submitted_at=submitted_at,
                current_question_index=0,
                flagged_question_ids_json=[],
            )
        )

        for answer_index, answer in enumerate(row.get("answers", []), start=1):
            question_id = str(answer["questionId"])
            db.add(
                QuestionResponse(
                    id=f"response-{MGMT2110_EXAM_ID}-{student_number}-{answer_index}",
                    attempt_id=attempt_id,
                    question_id=question_id,
                    question_type=question_type_map.get(question_id, "essay"),
                    value_json=str(answer.get("answerText", "")),
                    answered_at=submitted_at,
                )
            )

    db.commit()

def seed_comp1023_finals_dataset(db):
    print("Seeding COMP1023 Finals submitted answers...")

    EXAM_ID = "comp1023-finals-f25"
    COURSE_ID = "course-comp1023"
    Q_PREFIX = "finals-"
    EXAM_DATE = datetime(2025, 12, 12, 8, 30, 0)

    # Maps answer-file question IDs → fixture question IDs
    QID_MAP = {
        "q3aii_I":    "q3aii-I",
        "q3aii_II":   "q3aii-II",
        "q3aii_III":  "q3aii-III",
        "q3bii_I":    "q3bii-I",
        "q3bii_II":   "q3bii-II",
        # All four debug sub-parts belong to the single q3biii question
        "q3biii_I":   "q3biii",
        "q3biii_II":  "q3biii",
        "q3biii_III": "q3biii",
        "q3biii_IV":  "q3biii",
        # q4(a)(i) sub-parts
        "q4ai":          "q4ai-I",
        "q4ai_Purpose":  "q4ai-II",
        "q4ai_1":        "q4ai-I",
        "q4ai_2":        "q4ai-II",
        # q6(b) combined → map to q6bi; q6bii is not separately answered
        "q6b": "q6bi",
    }

    # Load the answer JSON
    json_path = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "comp1023Final_Answer.json")
    )
    with open(json_path, "r", encoding="utf-8") as f:
        answer_data = json.load(f)

    # Student placeholder names (stu-001 already exists)
    placeholder_names = {
        "stu-002":  ("Student", "Two"),
        "stu-003":  ("Student", "Three"),
        "stu-004":  ("Student", "Four"),
        "stu-005":  ("Student", "Five"),
        "stu-006":  ("Student", "Six"),
        "stu-007":  ("Student", "Seven"),
        "stu-008":  ("Student", "Eight"),
        "stu-009":  ("Student", "Nine"),
        "stu-0010": ("Student", "Ten"),
        "stu-0011": ("Student", "Eleven"),
        "stu-0012": ("Student", "Twelve"),
    }

    for entry in answer_data:
        student_id = entry["student_id"]

        # Create student user if not already existing
        if student_id != "stu-001":
            first, last = placeholder_names.get(student_id, ("Student", student_id))
            student_num = student_id.replace("stu-0", "2025").replace("stu-", "2025").zfill(8)
            db.merge(User(
                id=student_id,
                email=f"comp1023.{student_id}@seed.local",
                first_name=first,
                last_name=last,
                role="student",
                student_number=student_num,
                avatar_url=None,
                password_hash=hash_password(f"seed-{student_id}"),
            ))

        db.merge(CourseEnrollment(course_id=COURSE_ID, user_id=student_id))
        db.flush()

        responses_raw = entry.get("responses", [])

        # Derive attempt timestamps
        timestamps = [
            datetime.fromisoformat(r["answered_at"].replace("Z", "+00:00")).replace(tzinfo=None)
            for r in responses_raw if r.get("answered_at")
        ]
        started_at  = min(timestamps) if timestamps else EXAM_DATE
        submitted_at = max(timestamps) if timestamps else EXAM_DATE + timedelta(hours=3)

        attempt_id = f"attempt-{EXAM_ID}-{student_id}"
        db.merge(ExamAttempt(
            id=attempt_id,
            exam_id=EXAM_ID,
            student_id=student_id,
            status="submitted",
            started_at=started_at,
            submitted_at=submitted_at,
            current_question_index=entry.get("current_question_index", 0),
            flagged_question_ids_json=entry.get("flagged_question_ids", []),
        ))

        # Group responses by normalised question ID so that sub-parts of the
        # same fixture question (e.g. q3biii_I … IV) are merged into one entry.
        grouped: dict[str, dict] = {}  # canonical_qid → {value, answered_at, question_type}
        for resp in responses_raw:
            raw_qid = resp["question_id"]
            canonical_qid = QID_MAP.get(raw_qid, raw_qid)
            raw_value = resp.get("value")

            if raw_value is None:
                continue
            if isinstance(raw_value, str) and raw_value.strip() == "":
                continue

            answered_dt = resp.get("answered_at")
            if answered_dt:
                answered_dt = datetime.fromisoformat(
                    answered_dt.replace("Z", "+00:00")
                ).replace(tzinfo=None)
            else:
                answered_dt = submitted_at

            if canonical_qid not in grouped:
                grouped[canonical_qid] = {
                    "question_type": resp.get("question_type", "short_answer"),
                    "value_parts": [],
                    "answered_at": answered_dt,
                }

            # Serialise value for storage
            q_type = resp.get("question_type", "short_answer")
            if isinstance(raw_value, dict):
                part = json.dumps(raw_value)
            elif q_type == "mcq" and isinstance(raw_value, str) and raw_value in ("T", "F"):
                # Map shorthand T/F to the option ID used in the fixture
                part = f"{canonical_qid}-opt-{'t' if raw_value == 'T' else 'f'}"
            else:
                part = str(raw_value)
            grouped[canonical_qid]["value_parts"].append(part)
            # Keep the latest timestamp for merged sub-parts
            if answered_dt > grouped[canonical_qid]["answered_at"]:
                grouped[canonical_qid]["answered_at"] = answered_dt

        for idx, (canonical_qid, data) in enumerate(grouped.items(), start=1):
            value_stored = "\n".join(data["value_parts"]) if len(data["value_parts"]) > 1 else data["value_parts"][0]
            db.merge(QuestionResponse(
                id=f"response-{EXAM_ID}-{student_id}-{idx}",
                attempt_id=attempt_id,
                question_id=Q_PREFIX + canonical_qid,
                question_type=data["question_type"],
                value_json=value_stored,
                answered_at=data["answered_at"],
            ))

    db.commit()
    print(f"  → Seeded {len(answer_data)} student attempts for COMP1023 Finals.")


def run():
    db = SessionLocal()
    try:
        clear_data(db)
        seed_users(db)
        seed_courses(db)
        seed_exams(db)
        seed_mgmt2110_dataset(db)
        seed_comp1023_finals_dataset(db)
        print("Seed data successfully inserted.")
    except Exception as e:
        print("Error during seeding:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run()