"""FastAPI application entry point with route registration, middleware, and lifecycle events."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.middleware.error_handler import register_error_handlers
from app.api.middleware.request_logger import RequestLoggerMiddleware
from app.api.routes import agents, health, search, workflows
from app.config import get_settings

logger = logging.getLogger(__name__)

# Global resource references for lifecycle management
_redis_pool: object | None = None
_db_engine: object | None = None
_vector_service: object | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle: startup and shutdown events."""
    global _redis_pool, _db_engine, _vector_service

    settings = get_settings()
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)

    # Startup: initialize connections and resources

    # Initialize Redis connection pool
    try:
        import redis.asyncio as aioredis

        _redis_pool = aioredis.from_url(
            str(settings.redis.url),
            max_connections=settings.redis.max_connections,
            decode_responses=True,
        )
        await _redis_pool.ping()
        logger.info("Redis connection pool initialized (%s)", settings.redis.url)
    except Exception as exc:
        logger.warning("Redis initialization failed: %s (continuing without cache)", exc)
        _redis_pool = None

    # Initialize database connection pool
    try:
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

        db_url = str(settings.database.url)
        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

        _db_engine = create_async_engine(
            db_url,
            pool_size=settings.database.pool_size,
            max_overflow=settings.database.max_overflow,
            echo=settings.database.echo,
        )
        # Verify connectivity
        async with _db_engine.begin() as conn:
            from sqlalchemy import text

            await conn.execute(text("SELECT 1"))
        logger.info("Database connection pool initialized (%s)", db_url.split("@")[-1])
    except Exception as exc:
        logger.warning("Database initialization failed: %s (continuing without persistence)", exc)
        _db_engine = None

    # Initialize vector engine client
    try:
        from app.services.vector_service import VectorService

        _vector_service = VectorService()
        logger.info(
            "Vector engine client initialized (mode=%s)",
            "native" if _vector_service._use_native else "http",
        )
    except Exception as exc:
        logger.warning("Vector engine initialization failed: %s (continuing without search)", exc)
        _vector_service = None

    # Store resources on app.state for dependency injection
    app.state.redis = _redis_pool
    app.state.db_engine = _db_engine
    app.state.vector_service = _vector_service

    logger.info("All services initialized successfully")

    yield

    # Shutdown: clean up resources
    if _vector_service is not None:
        logger.info("Vector engine client shut down")

    if _db_engine is not None:
        try:
            from sqlalchemy.ext.asyncio import AsyncEngine

            if isinstance(_db_engine, AsyncEngine):
                await _db_engine.dispose()
                logger.info("Database connection pool closed")
        except Exception as exc:
            logger.warning("Database shutdown error: %s", exc)

    if _redis_pool is not None:
        try:
            await _redis_pool.aclose()
            logger.info("Redis connection pool closed")
        except Exception as exc:
            logger.warning("Redis shutdown error: %s", exc)

    logger.info("Shutting down %s", settings.app_name)


def create_app() -> FastAPI:
    """Application factory that creates and configures the FastAPI instance."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="DeepAgent Multi-AI Agent Collaboration Runtime",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Register CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register custom middleware
    app.add_middleware(RequestLoggerMiddleware)

    # Register global error handlers
    register_error_handlers(app)

    # Register API routers
    app.include_router(health.router, prefix="/api/v1", tags=["Health"])
    app.include_router(agents.router, prefix="/api/v1/agents", tags=["Agents"])
    app.include_router(workflows.router, prefix="/api/v1/workflows", tags=["Workflows"])
    app.include_router(search.router, prefix="/api/v1/search", tags=["Search"])

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
