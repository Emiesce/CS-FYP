"""
HKUST CSE Exam Platform – FastAPI Application Entry Point
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend directory before anything else reads env vars
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth_api import router as auth_router
from app.api.catalog_api import router as catalog_router
from app.api.exam_api import router as exam_router
from app.api.grading_api import router as grading_router
from app.api.test_grading_api import router as test_grading_router
from app.api.analytics_api import router as analytics_router
from app.api.proctoring_api import router as proctoring_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title="HKUST CSE Exam Platform – Exam API",
    version="0.1.0",
    description="Exam authoring and attempt backend for the HKUST CSE exam platform.",
)

# CORS – allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(auth_router)
app.include_router(catalog_router)
app.include_router(exam_router)
app.include_router(grading_router)
app.include_router(test_grading_router)
app.include_router(analytics_router)
app.include_router(proctoring_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "exam-backend"}
