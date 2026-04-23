from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.models.auth_models import AuthUserOut


class SemesterOut(BaseModel):
    id: str
    label: str
    term: str
    academic_year: str
    start_date: str
    end_date: str


class DashboardExamOut(BaseModel):
    id: str
    course_code: str
    course_name: str
    title: str
    date: str
    start_time: str
    duration_seconds: int
    location: str
    status: str
    semester_id: str
    student_count: int = 0


class DashboardCatalogOut(BaseModel):
    current_semester_id: str
    semesters: list[SemesterOut]
    exams: list[DashboardExamOut]


class CurrentExamOut(BaseModel):
    exam: Optional[DashboardExamOut] = None


class CourseOut(BaseModel):
    id: str
    code: str
    name: str
    semester_id: str
    instructor_ids: list[str] = Field(default_factory=list)
    ta_ids: list[str] = Field(default_factory=list)
    student_ids: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str


class CourseUpsertIn(BaseModel):
    code: str = Field(min_length=1)
    name: str = Field(min_length=1)
    semester_id: str = Field(min_length=1)


class CourseMembersUpdateIn(BaseModel):
    instructor_ids: list[str] = Field(default_factory=list)
    ta_ids: list[str] = Field(default_factory=list)
    student_ids: list[str] = Field(default_factory=list)


class UserRoleUpdateIn(BaseModel):
    role: str = Field(min_length=1)


class AdminCatalogOut(BaseModel):
    current_semester_id: str
    semesters: list[SemesterOut]
    courses: list[CourseOut]
    users: list[AuthUserOut]
