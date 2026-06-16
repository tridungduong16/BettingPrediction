from datetime import UTC, datetime

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "checked_at": datetime.now(UTC).isoformat()}

