from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator

WorldCupSourceName = Literal["auto", "upbound", "openfootball"]
CookieSameSite = Literal["lax", "strict", "none"]


def _backend_dir() -> Path:
    return Path(__file__).resolve().parents[3]


def _load_backend_dotenv() -> None:
    load_dotenv(_backend_dir() / ".env", override=False)


def _split_csv(value: str | None, default: list[str]) -> list[str]:
    if value is None or value.strip() == "":
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def normalize_openai_base_url(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip().rstrip("/")
    if not normalized:
        return None

    chat_completions_suffix = "/chat/completions"
    if normalized.endswith(chat_completions_suffix):
        normalized = normalized[: -len(chat_completions_suffix)].rstrip("/")

    return normalized or None


class AppConfig(BaseModel):
    app_env: str = Field(default="local")
    frontend_url: str = "http://localhost:5173"
    cors_allowed_origins: list[str] = Field(default_factory=list)
    worldcup_default_year: int = 2026
    worldcup_cache_ttl_seconds: int = 900
    worldcup_data_dir: Path = Field(default_factory=lambda: _backend_dir() / "data")
    worldcup_http_timeout_seconds: float = 20.0
    worldcup_upbound_json_url: str = (
        "https://raw.githubusercontent.com/upbound-web/worldcup-live.json/master/"
        "{year}/worldcup.json"
    )
    worldcup_openfootball_json_url: str = (
        "https://raw.githubusercontent.com/openfootball/worldcup.json/master/{year}/worldcup.json"
    )
    worldcup_source_text_url: str = (
        "https://raw.githubusercontent.com/openfootball/worldcup/master/{year}--usa/cup.txt"
    )
    live_events_cache_ttl_seconds: int = 5
    live_events_http_timeout_seconds: float = 10.0
    live_events_fixture_map_file: Path = Field(
        default_factory=lambda: _backend_dir() / "data" / "live_fixture_map.json"
    )
    api_football_base_url: str = "https://v3.football.api-sports.io"
    api_football_api_key: str | None = None
    bifrost_endpoint_url: str | None = "https://bifrost.azaps.net/v1"
    bifrost_api_key: str | None = None
    openai_api_key: str | None = None
    openai_model: str = "openainexira/gpt-5.4-mini"
    model_name: str = "openainexira/gpt-5.4-mini"
    dashscope_api_key: str | None = None
    dashscope_base_url: str | None = None
    dashscope_embedding_base_url: str | None = None
    perplexity_api_key: str | None = None
    perplexity_search_url: str = "https://api.perplexity.ai/search"
    perplexity_search_timeout_seconds: float = 15.0
    perplexity_search_cache_ttl_seconds: int = 600
    perplexity_search_max_results: int = 8
    perplexity_search_country: str | None = "VN"
    perplexity_search_language_filter: list[str] = Field(default_factory=lambda: ["vi", "en"])
    prediction_cache_ttl_seconds: int = 21600
    prediction_cache_key_prefix: str = "futbolia"
    prediction_cache_version: str = "v1"
    redis_url: str | None = None
    redis_host: str | None = None
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str | None = None
    redis_timeout_seconds: float = 1.0
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str | None = None
    google_oauth_scope: str = "openid email profile"
    jwt_secret_key: str | None = None
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    session_secret_key: str = "local-dev-session-secret-change-me"
    session_cookie_name: str = "futbolia_oauth_session"
    session_cookie_secure: bool = False
    session_cookie_samesite: CookieSameSite = "lax"
    auth_cookie_name: str = "futbolia_access_token"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: CookieSameSite = "lax"

    @property
    def BIFROST_ENDPOINT_URL(self) -> str | None:
        return normalize_openai_base_url(self.bifrost_endpoint_url)

    @property
    def BIFROST_API_KEY(self) -> str | None:
        return self.bifrost_api_key

    @property
    def OPENAI_API_KEY(self) -> str | None:
        return self.openai_api_key or self.bifrost_api_key

    @property
    def OPENAI_MODEL(self) -> str:
        return self.openai_model

    @property
    def MODEL_NAME(self) -> str:
        return self.model_name

    @property
    def DASHSCOPE_API_KEY(self) -> str | None:
        return self.dashscope_api_key

    @property
    def DASHSCOPE_BASE_URL(self) -> str | None:
        return self.dashscope_base_url

    @property
    def DASHSCOPE_EMBEDDING_BASE_URL(self) -> str | None:
        return self.dashscope_embedding_base_url

    @field_validator("worldcup_data_dir", "live_events_fixture_map_file", mode="before")
    @classmethod
    def resolve_backend_path(cls, value: str | Path) -> Path:
        path = Path(value)
        if not path.is_absolute():
            path = _backend_dir() / path
        return path

    def source_urls(self, source: WorldCupSourceName, year: int) -> list[tuple[str, str]]:
        urls = {
            "upbound": self.worldcup_upbound_json_url.format(year=year),
            "openfootball": self.worldcup_openfootball_json_url.format(year=year),
        }
        if source == "auto":
            return [("upbound", urls["upbound"]), ("openfootball", urls["openfootball"])]
        return [(source, urls[source])]

    def source_text_url(self, year: int) -> str:
        return self.worldcup_source_text_url.format(year=year)


@lru_cache
def get_app_config() -> AppConfig:
    _load_backend_dotenv()

    default_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    return AppConfig(
        app_env=os.getenv("APP_ENV", "local"),
        frontend_url=os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/"),
        cors_allowed_origins=_split_csv(os.getenv("CORS_ALLOWED_ORIGINS"), default_origins),
        worldcup_default_year=int(os.getenv("WORLDCUP_DEFAULT_YEAR", "2026")),
        worldcup_cache_ttl_seconds=int(os.getenv("WORLDCUP_CACHE_TTL_SECONDS", "900")),
        worldcup_data_dir=os.getenv("WORLDCUP_DATA_DIR", str(_backend_dir() / "data")),
        worldcup_http_timeout_seconds=float(os.getenv("WORLDCUP_HTTP_TIMEOUT_SECONDS", "20")),
        worldcup_upbound_json_url=os.getenv(
            "WORLDCUP_UPBOUND_JSON_URL",
            AppConfig.model_fields["worldcup_upbound_json_url"].default,
        ),
        worldcup_openfootball_json_url=os.getenv(
            "WORLDCUP_OPENFOOTBALL_JSON_URL",
            AppConfig.model_fields["worldcup_openfootball_json_url"].default,
        ),
        worldcup_source_text_url=os.getenv(
            "WORLDCUP_SOURCE_TEXT_URL",
            AppConfig.model_fields["worldcup_source_text_url"].default,
        ),
        live_events_cache_ttl_seconds=int(os.getenv("LIVE_EVENTS_CACHE_TTL_SECONDS", "5")),
        live_events_http_timeout_seconds=float(os.getenv("LIVE_EVENTS_HTTP_TIMEOUT_SECONDS", "10")),
        live_events_fixture_map_file=os.getenv(
            "LIVE_EVENTS_FIXTURE_MAP_FILE",
            str(_backend_dir() / "data" / "live_fixture_map.json"),
        ),
        api_football_base_url=os.getenv(
            "API_FOOTBALL_BASE_URL",
            AppConfig.model_fields["api_football_base_url"].default,
        ),
        api_football_api_key=os.getenv("API_FOOTBALL_API_KEY") or None,
        bifrost_endpoint_url=normalize_openai_base_url(
            os.getenv(
                "BIFROST_ENDPOINT_URL",
                AppConfig.model_fields["bifrost_endpoint_url"].default,
            )
        ),
        bifrost_api_key=os.getenv("BIFROST_API_KEY") or None,
        openai_api_key=os.getenv("OPENAI_API_KEY") or os.getenv("BIFROST_API_KEY") or None,
        openai_model=os.getenv("OPENAI_MODEL", "openainexira/gpt-5.4-mini"),
        model_name=os.getenv("MODEL_NAME", os.getenv("OPENAI_MODEL", "openainexira/gpt-5.4-mini")),
        dashscope_api_key=os.getenv("DASHSCOPE_API_KEY") or None,
        dashscope_base_url=os.getenv("DASHSCOPE_BASE_URL") or None,
        dashscope_embedding_base_url=os.getenv("DASHSCOPE_EMBEDDING_BASE_URL") or None,
        perplexity_api_key=os.getenv("PERPLEXITY_API_KEY") or None,
        perplexity_search_url=os.getenv(
            "PERPLEXITY_SEARCH_URL",
            AppConfig.model_fields["perplexity_search_url"].default,
        ),
        perplexity_search_timeout_seconds=float(
            os.getenv("PERPLEXITY_SEARCH_TIMEOUT_SECONDS", "15")
        ),
        perplexity_search_cache_ttl_seconds=int(
            os.getenv("PERPLEXITY_SEARCH_CACHE_TTL_SECONDS", "600")
        ),
        perplexity_search_max_results=int(os.getenv("PERPLEXITY_SEARCH_MAX_RESULTS", "8")),
        perplexity_search_country=os.getenv("PERPLEXITY_SEARCH_COUNTRY", "VN") or None,
        perplexity_search_language_filter=_split_csv(
            os.getenv("PERPLEXITY_SEARCH_LANGUAGE_FILTER"),
            ["vi", "en"],
        ),
        prediction_cache_ttl_seconds=int(os.getenv("PREDICTION_CACHE_TTL_SECONDS", "21600")),
        prediction_cache_key_prefix=os.getenv("PREDICTION_CACHE_KEY_PREFIX", "futbolia"),
        prediction_cache_version=os.getenv("PREDICTION_CACHE_VERSION", "v1"),
        redis_url=os.getenv("REDIS_URL") or None,
        redis_host=os.getenv("REDIS_HOST") or None,
        redis_port=int(os.getenv("REDIS_PORT", "6379")),
        redis_db=int(os.getenv("REDIS_DB", "0")),
        redis_password=os.getenv("REDIS_PASSWORD") or None,
        redis_timeout_seconds=float(os.getenv("REDIS_TIMEOUT_SECONDS", "1")),
        google_client_id=os.getenv("GOOGLE_CLIENT_ID") or None,
        google_client_secret=os.getenv("GOOGLE_CLIENT_SECRET") or None,
        google_redirect_uri=os.getenv("GOOGLE_REDIRECT_URI") or None,
        google_oauth_scope=os.getenv("GOOGLE_OAUTH_SCOPE", "openid email profile"),
        jwt_secret_key=os.getenv("JWT_SECRET_KEY") or None,
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        jwt_access_token_expire_minutes=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60")),
        session_secret_key=os.getenv("SESSION_SECRET_KEY")
        or os.getenv("JWT_SECRET_KEY")
        or "local-dev-session-secret-change-me",
        session_cookie_name=os.getenv("SESSION_COOKIE_NAME", "futbolia_oauth_session"),
        session_cookie_secure=_parse_bool(os.getenv("SESSION_COOKIE_SECURE"), False),
        session_cookie_samesite=os.getenv("SESSION_COOKIE_SAMESITE", "lax").lower(),
        auth_cookie_name=os.getenv("AUTH_COOKIE_NAME", "futbolia_access_token"),
        auth_cookie_secure=_parse_bool(os.getenv("AUTH_COOKIE_SECURE"), False),
        auth_cookie_samesite=os.getenv("AUTH_COOKIE_SAMESITE", "lax").lower(),
    )


app_config = get_app_config()
