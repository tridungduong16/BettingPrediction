from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx
from authlib.integrations.base_client import OAuthError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, HTTPException, Request, Response, status
from starlette.responses import RedirectResponse

from app.core.app_config import AppConfig, get_app_config
from app.models.auth import AuthMeResponse, AuthUser
from app.services.auth_tokens import AuthTokenError, create_access_token, decode_access_token

GOOGLE_METADATA_URL = "https://accounts.google.com/.well-known/openid-configuration"

router = APIRouter()


def _safe_return_to(value: str | None) -> str:
    if not value:
        return "/"

    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or not value.startswith("/"):
        return "/"

    return value


def _frontend_redirect_url(
    config: AppConfig,
    return_to: str | None,
    query: Mapping[str, str] | None = None,
) -> str:
    path = _safe_return_to(return_to)
    url = f"{config.frontend_url.rstrip('/')}{path}"

    if not query:
        return url

    parsed = urlsplit(url)
    query_params = parse_qsl(parsed.query, keep_blank_values=True)
    query_params.extend(query.items())
    return urlunsplit(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            urlencode(query_params),
            parsed.fragment,
        )
    )


def _pop_return_to(request: Request) -> str:
    return_to = request.session.pop("auth_return_to", "/")
    if not isinstance(return_to, str):
        return "/"
    return _safe_return_to(return_to)


def _google_oauth_client(config: AppConfig):
    oauth = OAuth()
    oauth.register(
        name="google",
        client_id=config.google_client_id,
        client_secret=config.google_client_secret,
        server_metadata_url=GOOGLE_METADATA_URL,
        client_kwargs={"scope": config.google_oauth_scope},
    )
    return oauth.google


def _ensure_google_oauth_config(config: AppConfig) -> None:
    missing = [
        name
        for name, value in {
            "GOOGLE_CLIENT_ID": config.google_client_id,
            "GOOGLE_CLIENT_SECRET": config.google_client_secret,
        }.items()
        if not value
    ]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Google OAuth is not configured. Set {', '.join(missing)}.",
        )


def _optional_str(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def _auth_user_from_google_userinfo(userinfo: Mapping[str, Any]) -> AuthUser:
    subject = _optional_str(userinfo.get("sub"))
    if not subject:
        raise ValueError("Google userinfo did not include a subject.")

    return AuthUser(
        provider="google",
        subject=subject,
        email=_optional_str(userinfo.get("email")),
        email_verified=userinfo.get("email_verified") is True,
        name=_optional_str(userinfo.get("name")),
        picture=_optional_str(userinfo.get("picture")),
    )


async def _fetch_google_userinfo(client, token: Mapping[str, Any]) -> Mapping[str, Any]:
    userinfo = token.get("userinfo")
    if isinstance(userinfo, Mapping):
        return userinfo

    response = await client.get("userinfo", token=token)
    response.raise_for_status()
    return response.json()


def _set_auth_cookie(response: Response, token: str, config: AppConfig) -> None:
    response.set_cookie(
        key=config.auth_cookie_name,
        value=token,
        max_age=config.jwt_access_token_expire_minutes * 60,
        path="/",
        httponly=True,
        secure=config.auth_cookie_secure,
        samesite=config.auth_cookie_samesite,
    )


def _delete_auth_cookie(response: Response, config: AppConfig) -> None:
    response.delete_cookie(
        key=config.auth_cookie_name,
        path="/",
        secure=config.auth_cookie_secure,
        samesite=config.auth_cookie_samesite,
    )


def _extract_auth_token(request: Request, config: AppConfig) -> str | None:
    authorization = request.headers.get("authorization")
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        if token:
            return token

    return request.cookies.get(config.auth_cookie_name)


@router.get("/google/login")
async def google_login(request: Request, return_to: str | None = None):
    config = get_app_config()
    _ensure_google_oauth_config(config)

    request.session["auth_return_to"] = _safe_return_to(return_to)
    redirect_uri = config.google_redirect_uri or str(request.url_for("google_callback"))
    return await _google_oauth_client(config).authorize_redirect(request, redirect_uri)


@router.get("/google/callback", name="google_callback")
async def google_callback(request: Request):
    config = get_app_config()
    return_to = _pop_return_to(request)

    try:
        _ensure_google_oauth_config(config)
        google = _google_oauth_client(config)
        token = await google.authorize_access_token(request)
        userinfo = await _fetch_google_userinfo(google, token)
        user = _auth_user_from_google_userinfo(userinfo)
        access_token = create_access_token(user, config)
    except HTTPException:
        error_url = _frontend_redirect_url(config, return_to, {"auth_error": "google_config"})
        return RedirectResponse(error_url, status_code=status.HTTP_303_SEE_OTHER)
    except (AuthTokenError, OAuthError, ValueError, httpx.HTTPError):
        error_url = _frontend_redirect_url(config, return_to, {"auth_error": "google_login"})
        return RedirectResponse(error_url, status_code=status.HTTP_303_SEE_OTHER)

    redirect = RedirectResponse(
        _frontend_redirect_url(config, return_to),
        status_code=status.HTTP_303_SEE_OTHER,
    )
    _set_auth_cookie(redirect, access_token, config)
    return redirect


@router.get("/me", response_model=AuthMeResponse)
async def get_current_auth(request: Request, response: Response) -> AuthMeResponse:
    config = get_app_config()
    token = _extract_auth_token(request, config)

    if not token:
        return AuthMeResponse(authenticated=False)

    try:
        user = decode_access_token(token, config)
    except AuthTokenError:
        _delete_auth_cookie(response, config)
        return AuthMeResponse(authenticated=False)

    return AuthMeResponse(authenticated=True, user=user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout() -> Response:
    config = get_app_config()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _delete_auth_cookie(response, config)
    return response
