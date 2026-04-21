"""
Database and auth configuration.
"""
import os
from pathlib import Path

from dotenv import load_dotenv


_backend_env_path = Path(__file__).resolve().parents[2] / ".env"
_app_env_path = Path(__file__).resolve().parents[3] / ".env"

load_dotenv(_backend_env_path)
load_dotenv(_app_env_path)

DATABASE_URL: str = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://examuser:examsecret@localhost:5433/exam_platform",
)

AUTH_SECRET_KEY: str = os.environ.get(
    "AUTH_SECRET_KEY",
    "hkust-exam-platform-dev-secret",
)
AUTH_ALGORITHM: str = os.environ.get("AUTH_ALGORITHM", "HS256")
AUTH_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
    os.environ.get("AUTH_ACCESS_TOKEN_EXPIRE_MINUTES", "480")
)
