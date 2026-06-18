from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.router import api_router
from app.core.app_config import get_app_config


def create_app() -> FastAPI:
    config = get_app_config()

    app = FastAPI(
        title="Futbolia Backend",
        version="0.1.0",
        description="Scrapes and serves World Cup fixture/result data.",
    )

    app.add_middleware(
        SessionMiddleware,
        secret_key=config.session_secret_key,
        session_cookie=config.session_cookie_name,
        same_site=config.session_cookie_samesite,
        https_only=config.session_cookie_secure,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"service": "futbolia-backend", "status": "ok"}

    app.include_router(api_router)
    return app
