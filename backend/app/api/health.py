"""
Health check endpoint.
Public endpoint (exempt from API key requirement).
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.api.schemas import HealthResponse
from app.core.config import settings
from datetime import datetime
import time

router = APIRouter(prefix="/health", tags=["Health"])

# Track startup time
start_time = time.time()


@router.get("", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check endpoint.
    
    This endpoint is public and does not require API key authentication.
    It may still be subject to rate limiting depending on configuration.
    """
    # Check database connectivity
    db_status = "connected"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"
    
    uptime = time.time() - start_time
    
    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        version=settings.APP_VERSION,
        uptime_seconds=uptime,
        database=db_status,
        timestamp=datetime.utcnow()
    )

