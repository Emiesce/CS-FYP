"""
Course Materials API

Endpoints:
  POST   /api/exams/{exam_id}/materials          – upload a course material file
  GET    /api/exams/{exam_id}/materials          – list materials for an exam
  DELETE /api/exams/{exam_id}/materials/{mat_id} – delete a material
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models.core import CourseMaterial, Exam
from app.dependencies.auth import get_current_user, require_roles
from app.db.session import get_db
from app.db.models.core import User

router = APIRouter(prefix="/api/exams", tags=["materials"])

# Store uploads relative to the backend directory
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "course_materials"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/markdown",
}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


class CourseMaterialOut(BaseModel):
    id: str
    exam_id: str
    file_name: str
    file_size: int
    mime_type: str
    uploaded_at: str


def _to_out(m: CourseMaterial) -> CourseMaterialOut:
    return CourseMaterialOut(
        id=m.id,
        exam_id=m.exam_id,
        file_name=m.file_name,
        file_size=m.file_size,
        mime_type=m.mime_type,
        uploaded_at=m.uploaded_at.isoformat(),
    )


@router.post("/{exam_id}/materials", response_model=CourseMaterialOut)
async def upload_material(
    exam_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "administrator")),
) -> CourseMaterialOut:
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit.")

    mime = file.content_type or "application/octet-stream"
    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {mime}")

    mat_id = str(uuid.uuid4())
    suffix = Path(file.filename or "file").suffix
    storage_name = f"{mat_id}{suffix}"
    exam_dir = UPLOAD_DIR / exam_id
    exam_dir.mkdir(parents=True, exist_ok=True)
    storage_path = exam_dir / storage_name
    storage_path.write_bytes(content)

    material = CourseMaterial(
        id=mat_id,
        exam_id=exam_id,
        file_name=file.filename or storage_name,
        file_size=len(content),
        mime_type=mime,
        storage_path=str(storage_path),
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return _to_out(material)


@router.get("/{exam_id}/materials", response_model=list[CourseMaterialOut])
async def list_materials(
    exam_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CourseMaterialOut]:
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    return [_to_out(m) for m in exam.materials]


@router.delete("/{exam_id}/materials/{material_id}", response_model=dict)
async def delete_material(
    exam_id: str,
    material_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "administrator")),
) -> dict:
    material = (
        db.query(CourseMaterial)
        .filter(CourseMaterial.id == material_id, CourseMaterial.exam_id == exam_id)
        .first()
    )
    if not material:
        raise HTTPException(status_code=404, detail="Material not found.")

    path = Path(material.storage_path)
    if path.exists():
        path.unlink()

    db.delete(material)
    db.commit()
    return {"deleted": material_id}
