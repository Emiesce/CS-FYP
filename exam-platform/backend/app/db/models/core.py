from datetime import datetime
import uuid

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.db.base import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # student | instructor | teaching_assistant | administrator
    student_number = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    taught_courses = relationship("CourseStaff", back_populates="user", cascade="all, delete-orphan")
    enrollments = relationship("CourseEnrollment", back_populates="user", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"

    id = Column(String, primary_key=True, default=generate_uuid)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    semester_id = Column(String, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    staff_assignments = relationship("CourseStaff", back_populates="course", cascade="all, delete-orphan")
    enrollments = relationship("CourseEnrollment", back_populates="course", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="course")


class CourseStaff(Base):
    __tablename__ = "course_staff"

    id = Column(String, primary_key=True, default=generate_uuid)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)  # instructor | teaching_assistant
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="staff_assignments")
    user = relationship("User", back_populates="taught_courses")


class CourseEnrollment(Base):
    __tablename__ = "course_enrollments"

    id = Column(String, primary_key=True, default=generate_uuid)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="enrollments")
    user = relationship("User", back_populates="enrollments")


class Exam(Base):
    __tablename__ = "exams"

    id = Column(String, primary_key=True, default=generate_uuid)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    course_code = Column(String, nullable=False)
    course_name = Column(String, nullable=False)
    semester_id = Column(String, nullable=False, default="")
    status = Column(String, nullable=False, default="upcoming")  # current | upcoming | past
    title = Column(String, nullable=False)
    date = Column(String, nullable=False)
    start_time = Column(String, nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    location = Column(String, nullable=False)
    instructions = Column(Text, default="")
    total_points = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course = relationship("Course", back_populates="exams")
    questions = relationship(
        "ExamQuestion",
        back_populates="exam",
        order_by="ExamQuestion.order",
        cascade="all, delete-orphan",
    )
    attempts = relationship("ExamAttempt", back_populates="exam")


class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    id = Column(String, primary_key=True, default=generate_uuid)
    exam_id = Column(String, ForeignKey("exams.id"), nullable=False)
    order = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    prompt = Column(Text, nullable=False)
    points = Column(Float, nullable=False)
    required = Column(Boolean, default=True)
    rubric_json = Column(JSONB, nullable=True)
    type = Column(String, nullable=False)
    type_data_json = Column(JSONB, nullable=False)
    topic_ids_json = Column(JSONB, nullable=True, default=list)

    exam = relationship("Exam", back_populates="questions")


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id = Column(String, primary_key=True, default=generate_uuid)
    exam_id = Column(String, ForeignKey("exams.id"), nullable=False)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(String, nullable=False)  # in_progress, submitted, timed_out
    started_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    current_question_index = Column(Integer, default=0)
    flagged_question_ids_json = Column(JSONB, default=list)

    exam = relationship("Exam", back_populates="attempts")
    responses = relationship("QuestionResponse", back_populates="attempt", cascade="all, delete-orphan")


class QuestionResponse(Base):
    __tablename__ = "question_responses"

    id = Column(String, primary_key=True, default=generate_uuid)
    attempt_id = Column(String, ForeignKey("exam_attempts.id"), nullable=False)
    question_id = Column(String, ForeignKey("exam_questions.id"), nullable=False)
    question_type = Column(String, nullable=False)
    value_json = Column(JSONB, nullable=False)
    answered_at = Column(DateTime, default=datetime.utcnow)

    attempt = relationship("ExamAttempt", back_populates="responses")