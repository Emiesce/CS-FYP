"""
HKUST CSE Exam Platform – FastAPI Application Entry Point
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.exam_api import router as exam_router

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
app.include_router(exam_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "exam-backend"}
