from __future__ import annotations

from typing import Any

from app.models.news import SearchRecency


def build_latest_information_search_tool(news_search_service: Any | None):
    async def search_latest_information(
        query: str,
        recency: SearchRecency | None = None,
        max_results: int | None = None,
    ) -> dict[str, Any]:
        """Search current web information with Perplexity for this match when context is missing."""
        normalized_query = " ".join(query.strip().split())
        if not normalized_query:
            return {
                "provider": "perplexity",
                "provider_status": "provider_error",
                "query": normalized_query,
                "results": [],
                "error": "query must not be blank",
            }

        if news_search_service is None:
            return {
                "provider": "perplexity",
                "provider_status": "not_configured",
                "query": normalized_query,
                "results": [],
                "error": "Latest information search service is not configured.",
            }

        response = await news_search_service.search_latest_information(
            query=normalized_query,
            max_results=max_results,
            force_refresh=False,
            recency=recency,
        )
        if hasattr(response, "model_dump"):
            return response.model_dump(mode="json", exclude_none=True)
        return dict(response)

    return search_latest_information
