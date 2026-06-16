from __future__ import annotations

import json

import httpx
import pytest

from app.connectors.news.perplexity import PerplexityNewsSearchConnector
from app.core.app_config import AppConfig
from app.services.news_search_service import NewsSearchService, build_match_news_query


def test_build_match_news_query_uses_two_team_names():
    assert (
        build_match_news_query(home_team=" Pháp ", away_team="  Senegal ")
        == "thông tin trận Pháp và Senegal"
    )


@pytest.mark.asyncio
async def test_news_search_service_returns_not_configured_without_perplexity_key():
    config = AppConfig(perplexity_api_key=None)
    connector = PerplexityNewsSearchConnector(config=config)
    service = NewsSearchService(config=config, perplexity_connector=connector)

    response = await service.search_match_news(home_team="Pháp", away_team="Senegal")

    assert response.provider_status == "not_configured"
    assert response.query == "thông tin trận Pháp và Senegal"
    assert response.results == []
    assert response.error == "Set PERPLEXITY_API_KEY to fetch match news."


@pytest.mark.asyncio
async def test_perplexity_news_search_connector_posts_structured_search_request():
    captured: dict[str, object] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["authorization"] = request.headers.get("authorization")
        captured["body"] = json.loads(request.content.decode())
        return httpx.Response(
            200,
            json={
                "id": "search-123",
                "server_time": "2026-06-16T00:00:00Z",
                "results": [
                    {
                        "title": "France vs Senegal team news",
                        "url": "https://example.com/france-senegal",
                        "snippet": "Latest team news and tactical notes.",
                        "date": "2026-06-15",
                        "last_updated": "2026-06-16",
                    }
                ],
            },
        )

    config = AppConfig(
        perplexity_api_key="pplx-test-key",
        perplexity_search_url="https://api.perplexity.ai/search",
    )
    connector = PerplexityNewsSearchConnector(
        config=config,
        transport=httpx.MockTransport(handler),
    )

    results, source_id, server_time = await connector.search(
        query="thông tin trận Pháp và Senegal",
        max_results=3,
        country="vn",
        language_filter=["vi"],
        recency="week",
    )

    assert captured["url"] == "https://api.perplexity.ai/search"
    assert captured["authorization"] == "Bearer pplx-test-key"
    assert captured["body"] == {
        "query": "thông tin trận Pháp và Senegal",
        "max_results": 3,
        "search_context_size": "medium",
        "country": "VN",
        "search_language_filter": ["vi"],
        "search_recency_filter": "week",
    }
    assert source_id == "search-123"
    assert server_time == "2026-06-16T00:00:00Z"
    assert results[0].title == "France vs Senegal team news"
    assert results[0].url == "https://example.com/france-senegal"
