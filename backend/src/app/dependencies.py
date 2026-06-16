from functools import lru_cache

from app.connectors.live_events.api_football import APIFootballLiveEventsConnector
from app.connectors.worldcup.openfootball import OpenFootballWorldCupConnector
from app.core.app_config import get_app_config
from app.services.live_event_service import FileLiveFixtureMapRepository, LiveEventService
from app.services.market_prediction_service import MarketPredictionService
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
def get_market_prediction_service() -> MarketPredictionService:
    return MarketPredictionService(
        worldcup_service=get_worldcup_service(),
        live_event_service=get_live_event_service(),
    )
