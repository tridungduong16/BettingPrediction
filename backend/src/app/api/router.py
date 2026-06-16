from fastapi import APIRouter

from app.api.routes import health, live_events, predictions, worldcup

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(worldcup.router, prefix="/api/worldcup", tags=["worldcup"])
api_router.include_router(live_events.router, prefix="/api/live", tags=["live-events"])
api_router.include_router(predictions.router, prefix="/api/predictions", tags=["predictions"])
