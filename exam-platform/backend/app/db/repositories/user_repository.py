from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.db.models.core import User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: str) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_email(self, email: str) -> Optional[User]:
        normalized = email.strip().lower()
        return self.db.query(User).filter(User.email == normalized).first()

    def list_all(self) -> list[User]:
        return self.db.query(User).order_by(User.created_at.asc()).all()
