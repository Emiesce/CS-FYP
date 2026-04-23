from datetime import datetime, timedelta

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.db.models.core import User, Course, CourseStaff, CourseEnrollment, Exam, ExamQuestion, ExamAttempt, QuestionResponse
from app.db.models.grading import GradingRun, Rubric
from app.db.models.proctoring import ProctoringBucket, ProctoringEvent, ProctoringSession
from app.fixtures.comp1023_exam import build_comp1023_exam
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

    for index, row in enumerate(answer_rows):
        student_number = str(row["studentId"])
        first_name, last_name = _split_name(str(row["studentName"]))
        user_id = f"mgmt-stu-{student_number}"
        started_at = base_started_at + timedelta(minutes=index)
        submitted_at = started_at + timedelta(minutes=45)

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

        db.add(CourseEnrollment(course_id="course-mgmt2110", user_id=user_id))

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

def run():
    db = SessionLocal()
    try:
        clear_data(db)
        seed_users(db)
        seed_courses(db)
        seed_exams(db)
        seed_mgmt2110_dataset(db)
        print("Seed data successfully inserted.")
    except Exception as e:
        print("Error during seeding:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run()