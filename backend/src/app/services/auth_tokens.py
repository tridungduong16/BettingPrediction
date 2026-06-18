from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from jwt import InvalidTokenError

from app.core.app_config import AppConfig
from app.models.auth import AuthUser


class AuthTokenError(Exception):
    pass


def _jwt_secret(config: AppConfig) -> str:
    if not config.jwt_secret_key:
        raise AuthTokenError("JWT_SECRET_KEY is required to issue auth tokens.")
    return config.jwt_secret_key


def create_access_token(user: AuthUser, config: AppConfig) -> str:
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=config.jwt_access_token_expire_minutes)
    payload: dict[str, Any] = {
        "iss": "futbolia",
        "sub": user.subject,
        "provider": user.provider,
        "email": user.email,
        "email_verified": user.email_verified,
        "name": user.name,
        "picture": user.picture,
        "iat": now,
        "exp": expires_at,
    }
    return jwt.encode(payload, _jwt_secret(config), algorithm=config.jwt_algorithm)


def decode_access_token(token: str, config: AppConfig) -> AuthUser:
    try:
        payload = jwt.decode(
            token,
            _jwt_secret(config),
            algorithms=[config.jwt_algorithm],
            issuer="futbolia",
        )
    except InvalidTokenError as exc:
        raise AuthTokenError("Invalid auth token.") from exc

    subject = payload.get("sub")
    provider = payload.get("provider")

    if provider != "google" or not isinstance(subject, str) or not subject:
        raise AuthTokenError("Invalid auth token payload.")

    return AuthUser(
        provider="google",
        subject=subject,
        email=payload.get("email") if isinstance(payload.get("email"), str) else None,
        email_verified=payload.get("email_verified") is True,
        name=payload.get("name") if isinstance(payload.get("name"), str) else None,
        picture=payload.get("picture") if isinstance(payload.get("picture"), str) else None,
    )
