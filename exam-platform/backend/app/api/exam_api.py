"""
HKUST CSE Exam Platform – Exam Definition & Attempt API

Endpoints:
  POST   /api/exams                    – create an exam definition
  GET    /api/exams                    – list all exam definitions
  GET    /api/exams/{exam_id}          – get a single exam definition
  PUT    /api/exams/{exam_id}          – update an exam definition
  POST   /api/exams/{exam_id}/attempt  – start or resume an attempt
  PUT    /api/exams/{exam_id}/attempt  – save draft progress
  POST   /api/exams/{exam_id}/submit   – submit a completed attempt
  GET    /api/exams/{exam_id}/attempt  – get current attempt state
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.exam_models import (
    ExamAttemptIn,
    ExamAttemptOut,
    ExamDefinitionIn,
    ExamDefinitionOut,
)
from app.storage.exam_storage import get_exam_store

router = APIRouter(prefix="/api/exams", tags=["exams"])


# -----------------------------------------------------------------------
# Exam definitions (staff authoring)
# -----------------------------------------------------------------------

@router.post("", response_model=ExamDefinitionOut)
async def create_exam(body: ExamDefinitionIn) -> ExamDefinitionOut:
    """Create a new exam definition."""
    return get_exam_store().create_definition(body)


@router.get("", response_model=list[ExamDefinitionOut])
async def list_exams() -> list[ExamDefinitionOut]:
    """List all exam definitions."""
    return get_exam_store().list_definitions()


@router.get("/{exam_id}", response_model=ExamDefinitionOut)
async def get_exam(exam_id: str) -> ExamDefinitionOut:
    """Get a single exam definition by ID."""
    definition = get_exam_store().get_definition(exam_id)
    if not definition:
        raise HTTPException(status_code=404, detail="Exam not found.")
    return definition


@router.put("/{exam_id}", response_model=ExamDefinitionOut)
async def update_exam(exam_id: str, body: ExamDefinitionIn) -> ExamDefinitionOut:
    """Update an existing exam definition."""
    updated = get_exam_store().update_definition(exam_id, body)
    if not updated:
        raise HTTPException(status_code=404, detail="Exam not found.")
    return updated


# -----------------------------------------------------------------------
# Student attempts
# -----------------------------------------------------------------------

@router.post("/{exam_id}/attempt", response_model=ExamAttemptOut)
async def start_attempt(exam_id: str, body: ExamAttemptIn) -> ExamAttemptOut:
    """Start or resume a student attempt."""
    body.exam_id = exam_id
    return get_exam_store().start_attempt(body)


@router.put("/{exam_id}/attempt", response_model=ExamAttemptOut)
async def save_draft(exam_id: str, body: ExamAttemptIn) -> ExamAttemptOut:
    """Save draft progress for a student attempt."""
    body.exam_id = exam_id
    result = get_exam_store().save_draft(body)
    if not result:
        raise HTTPException(status_code=404, detail="No active attempt found.")
    return result


@router.post("/{exam_id}/submit", response_model=ExamAttemptOut)
async def submit_attempt(exam_id: str, student_id: str) -> ExamAttemptOut:
    """Submit a completed attempt."""
    result = get_exam_store().submit_attempt(exam_id, student_id)
    if not result:
        raise HTTPException(status_code=404, detail="No active attempt found.")
    return result


@router.get("/{exam_id}/attempt", response_model=ExamAttemptOut)
async def get_attempt(exam_id: str, student_id: str) -> ExamAttemptOut:
    """Get the current attempt state for a student."""
    result = get_exam_store().get_attempt(exam_id, student_id)
    if not result:
        raise HTTPException(status_code=404, detail="No attempt found.")
    return result
