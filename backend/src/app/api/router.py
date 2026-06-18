from fastapi import APIRouter

from app.api.routes import auth, health, live_events, news, predictions, worldcup

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/api/auth", tags=["auth"])
api_router.include_router(worldcup.router, prefix="/api/worldcup", tags=["worldcup"])
api_router.include_router(live_events.router, prefix="/api/live", tags=["live-events"])
api_router.include_router(news.router, prefix="/api/news", tags=["news"])
api_router.include_router(predictions.router, prefix="/api/predictions", tags=["predictions"])
