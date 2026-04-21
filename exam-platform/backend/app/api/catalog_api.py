from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.models.core import Course, CourseEnrollment, CourseStaff, Exam, ExamAttempt, User
from app.db.repositories.user_repository import UserRepository
from app.db.session import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models.auth_models import AuthUserOut
from app.models.catalog_models import (
    AdminCatalogOut,
    CourseMembersUpdateIn,
    CourseOut,
    CourseUpsertIn,
    CurrentExamOut,
    DashboardCatalogOut,
    DashboardExamOut,
    SemesterOut,
    UserRoleUpdateIn,
)


router = APIRouter(prefix="/api/catalog", tags=["catalog"])


SEMESTERS = [
    SemesterOut(
        id="2025-26-fall",
        label="Fall 2025-26",
        term="fall",
        academic_year="2025-26",
        start_date="2025-09-01",
        end_date="2025-12-31",
    ),
    SemesterOut(
        id="2025-26-winter",
        label="Winter 2025-26",
        term="winter",
        academic_year="2025-26",
        start_date="2026-01-01",
        end_date="2026-01-31",
    ),
    SemesterOut(
        id="2025-26-spring",
        label="Spring 2025-26",
        term="spring",
        academic_year="2025-26",
        start_date="2026-02-01",
        end_date="2026-05-31",
    ),
    SemesterOut(
        id="2025-26-summer",
        label="Summer 2025-26",
        term="summer",
        academic_year="2025-26",
        start_date="2026-06-01",
        end_date="2026-08-31",
    ),
    SemesterOut(
        id="2026-27-fall",
        label="Fall 2026-27",
        term="fall",
        academic_year="2026-27",
        start_date="2026-09-01",
        end_date="2026-12-31",
    ),
]


def _current_semester_id(today: Optional[datetime] = None) -> str:
    now = today or datetime.utcnow()
    iso = now.date().isoformat()
    for semester in SEMESTERS:
        if semester.start_date <= iso <= semester.end_date:
            return semester.id

    past = [semester for semester in SEMESTERS if semester.end_date < iso]
    if past:
        return sorted(past, key=lambda item: item.end_date)[-1].id
    return SEMESTERS[0].id


def _to_user_out(user: User) -> AuthUserOut:
    return AuthUserOut(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        student_number=user.student_number,
        avatar_url=user.avatar_url,
    )


def _visible_courses_for_user(db: Session, user: User) -> list[Course]:
    query = db.query(Course)
    if user.role == "administrator":
        return query.order_by(Course.code.asc()).all()
    if user.role in {"instructor", "teaching_assistant"}:
        return (
            query.join(CourseStaff, CourseStaff.course_id == Course.id)
            .filter(CourseStaff.user_id == user.id)
            .order_by(Course.code.asc())
            .all()
        )
    return (
        query.join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
        .filter(CourseEnrollment.user_id == user.id)
        .order_by(Course.code.asc())
        .all()
    )


def _visible_exams_for_user(db: Session, user: User) -> list[Exam]:
    query = db.query(Exam)
    if user.role == "administrator":
        return query.order_by(Exam.date.asc(), Exam.start_time.asc()).all()
    if user.role in {"instructor", "teaching_assistant"}:
        return (
            query.join(CourseStaff, CourseStaff.course_id == Exam.course_id)
            .filter(CourseStaff.user_id == user.id)
            .order_by(Exam.date.asc(), Exam.start_time.asc())
            .all()
        )
    return (
        query.join(CourseEnrollment, CourseEnrollment.course_id == Exam.course_id)
        .filter(CourseEnrollment.user_id == user.id)
        .order_by(Exam.date.asc(), Exam.start_time.asc())
        .all()
    )


def _serialize_exam(db: Session, exam: Exam, user: User) -> DashboardExamOut:
    status_value = exam.status
    if user.role == "student" and exam.status == "current":
        attempt = (
            db.query(ExamAttempt)
            .filter(ExamAttempt.exam_id == exam.id, ExamAttempt.student_id == user.id)
            .first()
        )
        if attempt and attempt.status in {"submitted", "timed_out"}:
            status_value = "past"

    student_count = len(exam.course.enrollments) if exam.course else 0
    return DashboardExamOut(
        id=exam.id,
        course_code=exam.course_code,
        course_name=exam.course_name,
        title=exam.title,
        date=exam.date,
        start_time=exam.start_time,
        duration_seconds=exam.duration_seconds,
        location=exam.location,
        status=status_value,
        semester_id=exam.semester_id or (exam.course.semester_id if exam.course else ""),
        student_count=student_count,
    )


def _serialize_course(course: Course) -> CourseOut:
    instructor_ids = [item.user_id for item in course.staff_assignments if item.role == "instructor"]
    ta_ids = [item.user_id for item in course.staff_assignments if item.role == "teaching_assistant"]
    student_ids = [item.user_id for item in course.enrollments]
    return CourseOut(
        id=course.id,
        code=course.code,
        name=course.name,
        semester_id=course.semester_id,
        instructor_ids=instructor_ids,
        ta_ids=ta_ids,
        student_ids=student_ids,
        created_at=course.created_at.isoformat(),
        updated_at=course.updated_at.isoformat(),
    )


@router.get("/dashboard", response_model=DashboardCatalogOut)
async def api_get_dashboard_catalog(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardCatalogOut:
    exams = [_serialize_exam(db, exam, current_user) for exam in _visible_exams_for_user(db, current_user)]
    return DashboardCatalogOut(
        current_semester_id=_current_semester_id(),
        semesters=SEMESTERS,
        exams=exams,
    )


@router.get("/current-exam", response_model=CurrentExamOut)
async def api_get_current_exam(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentExamOut:
    exams = [_serialize_exam(db, exam, current_user) for exam in _visible_exams_for_user(db, current_user)]
    exam = next((item for item in exams if item.status == "current"), None)
    return CurrentExamOut(exam=exam)


@router.get("/courses", response_model=list[CourseOut])
async def api_list_courses(
    semester_id: Optional[str] = Query(default=None),
    scope: str = Query(default="visible"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CourseOut]:
    if scope == "all":
        if current_user.role != "administrator":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required.")
        courses = db.query(Course).order_by(Course.code.asc()).all()
    else:
        courses = _visible_courses_for_user(db, current_user)

    if semester_id:
        courses = [course for course in courses if course.semester_id == semester_id]

    return [_serialize_course(course) for course in courses]


@router.get("/admin/bootstrap", response_model=AdminCatalogOut)
async def api_get_admin_bootstrap(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrator")),
) -> AdminCatalogOut:
    courses = db.query(Course).order_by(Course.code.asc()).all()
    users = UserRepository(db).list_all()
    return AdminCatalogOut(
        current_semester_id=_current_semester_id(),
        semesters=SEMESTERS,
        courses=[_serialize_course(course) for course in courses],
        users=[_to_user_out(user) for user in users],
    )


@router.post("/admin/courses", response_model=CourseOut)
async def api_create_course(
    body: CourseUpsertIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrator")),
) -> CourseOut:
    existing = db.query(Course).filter(Course.code == body.code.strip().upper()).first()
    if existing:
        raise HTTPException(status_code=409, detail="A course with that code already exists.")

    now = datetime.utcnow()
    course = Course(
        code=body.code.strip().upper(),
        name=body.name.strip(),
        semester_id=body.semester_id,
        created_at=now,
        updated_at=now,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return _serialize_course(course)


@router.put("/admin/courses/{course_id}", response_model=CourseOut)
async def api_update_course(
    course_id: str,
    body: CourseUpsertIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrator")),
) -> CourseOut:
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found.")

    duplicate = (
        db.query(Course)
        .filter(Course.code == body.code.strip().upper(), Course.id != course_id)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="A course with that code already exists.")

    course.code = body.code.strip().upper()
    course.name = body.name.strip()
    course.semester_id = body.semester_id
    course.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(course)
    return _serialize_course(course)


@router.delete("/admin/courses/{course_id}")
async def api_delete_course(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrator")),
) -> dict:
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found.")
    if course.exams:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a course that still has exams attached.",
        )
    db.delete(course)
    db.commit()
    return {"status": "deleted", "course_id": course_id}


@router.put("/admin/courses/{course_id}/members", response_model=CourseOut)
async def api_update_course_members(
    course_id: str,
    body: CourseMembersUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrator")),
) -> CourseOut:
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found.")

    db.query(CourseStaff).filter(CourseStaff.course_id == course_id).delete()
    db.query(CourseEnrollment).filter(CourseEnrollment.course_id == course_id).delete()

    for user_id in body.instructor_ids:
        db.add(CourseStaff(course_id=course_id, user_id=user_id, role="instructor"))
    for user_id in body.ta_ids:
        db.add(CourseStaff(course_id=course_id, user_id=user_id, role="teaching_assistant"))
    for user_id in body.student_ids:
        db.add(CourseEnrollment(course_id=course_id, user_id=user_id))

    course.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(course)
    return _serialize_course(course)


@router.put("/admin/users/{user_id}/role", response_model=AuthUserOut)
async def api_update_user_role(
    user_id: str,
    body: UserRoleUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrator")),
) -> AuthUserOut:
    user = UserRepository(db).get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    user.role = body.role
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return _to_user_out(user)
