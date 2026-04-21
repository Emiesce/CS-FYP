from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.core.tokens import create_access_token
from app.db.models.core import User
from app.db.repositories.user_repository import UserRepository
from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.auth_models import (
    AuthLoginRequest,
    AuthLoginResponse,
    AuthUserOut,
    DemoAccountOut,
)
from app.seed_data import DEMO_USERS


router = APIRouter(prefix="/api/auth", tags=["auth"])


ROLE_LABELS = {
    "student": "Student",
    "instructor": "Instructor",
    "teaching_assistant": "Teaching Assistant",
    "administrator": "Administrator",
}


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


@router.post("/login", response_model=AuthLoginResponse)
async def api_login(body: AuthLoginRequest, db: Session = Depends(get_db)) -> AuthLoginResponse:
    user = UserRepository(db).get_by_email(body.email)
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please check your credentials and try again.",
        )

    token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    return AuthLoginResponse(access_token=token, user=_to_user_out(user))


@router.get("/me", response_model=AuthUserOut)
async def api_me(current_user: User = Depends(get_current_user)) -> AuthUserOut:
    return _to_user_out(current_user)


@router.get("/demo-accounts", response_model=list[DemoAccountOut])
async def api_demo_accounts() -> list[DemoAccountOut]:
    return [
        DemoAccountOut(
            role=account["role"],
            label=ROLE_LABELS[account["role"]],
            email=account["email"],
            password=account["password"],
        )
        for account in DEMO_USERS
    ]
