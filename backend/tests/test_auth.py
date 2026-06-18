from __future__ import annotations

from fastapi.testclient import TestClient

from app import server as app_server
from app.api.routes import auth as auth_routes
from app.core.app_config import AppConfig
from app.models.auth import AuthUser
from app.services.auth_tokens import create_access_token, decode_access_token


def _client(config: AppConfig, monkeypatch) -> TestClient:
    monkeypatch.setattr(app_server, "get_app_config", lambda: config)
    monkeypatch.setattr(auth_routes, "get_app_config", lambda: config)
    return TestClient(app_server.create_app())


def test_auth_token_round_trip():
    config = AppConfig(jwt_secret_key="test-secret-with-at-least-thirty-two-bytes")
    user = AuthUser(
        subject="google-subject",
        email="user@example.test",
        email_verified=True,
        name="Test User",
        picture="https://example.test/avatar.png",
    )

    token = create_access_token(user, config)
    decoded = decode_access_token(token, config)

    assert decoded == user


def test_me_returns_authenticated_user_from_cookie(monkeypatch):
    config = AppConfig(jwt_secret_key="test-secret-with-at-least-thirty-two-bytes")
    client = _client(config, monkeypatch)
    user = AuthUser(subject="google-subject", email="user@example.test", name="Test User")
    token = create_access_token(user, config)

    client.cookies.set(config.auth_cookie_name, token)
    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json() == {
        "authenticated": True,
        "user": {
            "provider": "google",
            "subject": "google-subject",
            "email": "user@example.test",
            "email_verified": False,
            "name": "Test User",
            "picture": None,
        },
    }


def test_me_returns_anonymous_without_cookie(monkeypatch):
    config = AppConfig(jwt_secret_key="test-secret-with-at-least-thirty-two-bytes")
    client = _client(config, monkeypatch)

    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json() == {"authenticated": False, "user": None}


def test_logout_clears_auth_cookie(monkeypatch):
    config = AppConfig(jwt_secret_key="test-secret-with-at-least-thirty-two-bytes")
    client = _client(config, monkeypatch)

    response = client.post("/api/auth/logout")

    assert response.status_code == 204
    assert f"{config.auth_cookie_name}=" in response.headers["set-cookie"]


def test_google_login_requires_oauth_config(monkeypatch):
    config = AppConfig(jwt_secret_key="test-secret-with-at-least-thirty-two-bytes")
    client = _client(config, monkeypatch)

    response = client.get("/api/auth/google/login")

    assert response.status_code == 503
    assert "GOOGLE_CLIENT_ID" in response.json()["detail"]
    assert "GOOGLE_CLIENT_SECRET" in response.json()["detail"]
