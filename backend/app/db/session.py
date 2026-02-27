"""
Database session management with SQLAlchemy 2.0 async.
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# Create async engine with connection pool settings for faster shutdown
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    future=True,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,  # Recycle connections after 1 hour
    pool_timeout=30,  # Timeout for getting connection from pool
    connect_args={
        # Disable asyncpg prepared statement cache to avoid invalid cached plans
        # after schema changes (asyncpg InvalidCachedStatementError).
        "statement_cache_size": 0,
        "server_settings": {
            "application_name": "bizledger_api"
        }
    }
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Base class for models
Base = declarative_base()


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database (create tables)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Close database connections."""
    try:
        # Dispose of the engine with a timeout
        await engine.dispose()
    except Exception as e:
        # Log but don't raise - we want to shutdown even if DB cleanup fails
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Error during database disposal: {str(e)}")

