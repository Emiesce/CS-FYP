from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class AuthLoginRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class AuthUserOut(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: str
    student_number: Optional[str] = None
    avatar_url: Optional[str] = None


class AuthLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserOut


class DemoAccountOut(BaseModel):
    role: str
    label: str
    email: str
    password: str
