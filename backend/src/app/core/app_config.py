from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator

WorldCupSourceName = Literal["auto", "upbound", "openfootball"]


def _backend_dir() -> Path:
    return Path(__file__).resolve().parents[3]


def _load_backend_dotenv() -> None:
    load_dotenv(_backend_dir() / ".env", override=False)


def _split_csv(value: str | None, default: list[str]) -> list[str]:
    if value is None or value.strip() == "":
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


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
    )


app_config = get_app_config()
