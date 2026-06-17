from functools import lru_cache

from app.connectors.live_events.api_football import APIFootballLiveEventsConnector
from app.connectors.news.perplexity import PerplexityNewsSearchConnector
from app.connectors.worldcup.openfootball import OpenFootballWorldCupConnector
from app.core.app_config import get_app_config
from app.services.live_event_service import FileLiveFixtureMapRepository, LiveEventService
from app.services.market_prediction_service import MarketPredictionService
from app.services.news_search_service import NewsSearchService
from app.services.prediction_cache import PredictionCacheBackend, RedisPredictionCache
from app.services.worldcup_service import FileWorldCupCacheRepository, WorldCupService


@lru_cache
def get_worldcup_service() -> WorldCupService:
    config = get_app_config()
    connector = OpenFootballWorldCupConnector(config=config)
    cache = FileWorldCupCacheRepository(data_dir=config.worldcup_data_dir)
    return WorldCupService(config=config, connector=connector, cache=cache)


@lru_cache
def get_live_event_service() -> LiveEventService:
    config = get_app_config()
    connector = APIFootballLiveEventsConnector(config=config)
    fixture_map = FileLiveFixtureMapRepository(mapping_file=config.live_events_fixture_map_file)
    return LiveEventService(
        config=config,
        api_football_connector=connector,
        fixture_map=fixture_map,
    )


@lru_cache
def get_news_search_service() -> NewsSearchService:
    config = get_app_config()
    connector = PerplexityNewsSearchConnector(config=config)
    return NewsSearchService(config=config, perplexity_connector=connector)


@lru_cache
def get_prediction_cache() -> PredictionCacheBackend | None:
    config = get_app_config()
    if config.redis_url:
        return RedisPredictionCache(
            url=config.redis_url,
            key_prefix=config.prediction_cache_key_prefix,
            timeout_seconds=config.redis_timeout_seconds,
        )

    if config.redis_host:
        return RedisPredictionCache(
            host=config.redis_host,
            port=config.redis_port,
            db=config.redis_db,
            password=config.redis_password,
            key_prefix=config.prediction_cache_key_prefix,
            timeout_seconds=config.redis_timeout_seconds,
        )

    return None


@lru_cache
def get_market_prediction_service() -> MarketPredictionService:
    config = get_app_config()
    return MarketPredictionService(
        worldcup_service=get_worldcup_service(),
        live_event_service=get_live_event_service(),
        news_search_service=get_news_search_service(),
        prediction_cache=get_prediction_cache(),
        prediction_cache_ttl_seconds=config.prediction_cache_ttl_seconds,
        prediction_cache_version=config.prediction_cache_version,
    )
