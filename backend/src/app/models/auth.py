from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class AuthUser(BaseModel):
    provider: Literal["google"] = "google"
    subject: str
    email: str | None = None
    email_verified: bool = False
    name: str | None = None
    picture: str | None = None


class AuthMeResponse(BaseModel):
    authenticated: bool
    user: AuthUser | None = None
