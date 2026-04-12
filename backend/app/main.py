"""
FastAPI application entry point with proper startup lifecycle.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException as FastAPIHTTPException
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.db.session import close_db
from app.middlewares.request_logger import RequestLoggerMiddleware
from app.middlewares.api_key_auth import APIKeyAuthMiddleware
from app.middlewares.rate_limit import RateLimitMiddleware
from app.middlewares.timestamp_validation import TimestampValidationMiddleware
from app.middlewares.ip_allowlist import IPAllowlistMiddleware
from app.api import auth, users, audit, health, organisations, organizations_rbac, reports, dashboard, debug_auth, debug_api_key, test_auth, verify_token, test_secret_key, roles, modules, purchase_vouchers, sales_invoices, tax_configurations, customers

# Initialize logging first
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown."""
    # Startup
    logger.info("=" * 60)
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info("=" * 60)
    
    try:
        # Note: Database tables and super admin seeding are handled by Alembic migrations
        # Run migrations with: alembic upgrade head
        logger.info("Application startup completed successfully.")
        logger.info("Note: Ensure database migrations are applied (alembic upgrade head)")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}", exc_info=True)
        raise
    
    yield
    
    # Shutdown - with timeout to prevent hanging
    logger.info("Shutting down application...")
    try:
        import asyncio
        # Add timeout to prevent hanging on shutdown
        await asyncio.wait_for(close_db(), timeout=5.0)
        logger.info("Database connections closed.")
    except asyncio.TimeoutError:
        logger.warning("Database disposal timed out, forcing shutdown...")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}", exc_info=True)
    
    logger.info("Application shutdown completed.")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Production-ready REST API for BizLeader",
    lifespan=lifespan,
    docs_url="/docs",  # Explicitly set docs URL
    redoc_url="/redoc",  # Explicitly set redoc URL
    openapi_url="/openapi.json"  # Explicitly set OpenAPI URL
)

# Serve uploaded files
uploads_root = Path(settings.UPLOADS_DIR)
uploads_root.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_root)), name="uploads")

# Add CORS middleware - MUST be first to handle all requests including OPTIONS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)


# Helper function to add CORS headers to any response
def add_cors_headers(response: JSONResponse, request: Request) -> JSONResponse:
    """Add CORS headers to a response."""
    origin = request.headers.get("origin")
    if origin:
        # Check if origin is in allowed list
        if origin in settings.cors_origins_list:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        # If no specific origins configured, allow all (for development)
        elif not settings.cors_origins_list:
            response.headers["Access-Control-Allow-Origin"] = "*"
    # Always include these headers for CORS
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-API-KEY, X-TIMESTAMP"
    response.headers["Access-Control-Expose-Headers"] = "*"
    return response


# Global exception handler for all unhandled exceptions (500 errors)
# Register this FIRST so HTTPException handlers (registered after) take precedence
# FastAPI processes exception handlers in reverse order of registration
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions and ensure CORS headers are included."""
    # HTTPExceptions should be handled by specific handlers (registered after this one)
    # But if they somehow reach here, handle them properly with CORS
    if isinstance(exc, (FastAPIHTTPException, StarletteHTTPException)):
        # Create proper HTTPException response with CORS
        status_code = exc.status_code if hasattr(exc, 'status_code') else 500
        detail = exc.detail if hasattr(exc, 'detail') else "An error occurred"
        headers = exc.headers if hasattr(exc, 'headers') and exc.headers else {}
        response = JSONResponse(
            status_code=status_code,
            content={"detail": detail},
            headers=headers
        )
        return add_cors_headers(response, request)
    
    # Log the error for non-HTTP exceptions
    logger.error(
        f"Unhandled exception: {type(exc).__name__}: {str(exc)} | path={request.url.path} | method={request.method}",
        exc_info=True
    )
    
    # Create error response
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error. Please try again later." if not settings.DEBUG else f"{type(exc).__name__}: {str(exc)}"
        },
    )
    
    # Add CORS headers
    return add_cors_headers(response, request)


# Global exception handler to ensure CORS headers are always included in error responses
# Register these AFTER the general handler so they're checked first (FastAPI checks in reverse order)
@app.exception_handler(FastAPIHTTPException)
async def http_exception_handler(request: Request, exc: FastAPIHTTPException):
    """Handle HTTP exceptions and ensure CORS headers are included."""
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers if exc.headers else {}
    )
    return add_cors_headers(response, request)


@app.exception_handler(StarletteHTTPException)
async def starlette_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle Starlette HTTP exceptions and ensure CORS headers are included."""
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )
    return add_cors_headers(response, request)

# Add security middlewares (order matters!)
# 1. Request logging (first to capture all requests)
app.add_middleware(RequestLoggerMiddleware)

# 2. IP allowlist (check IP before other validations, but skip for docs)
# Only add if enabled
if settings.IP_ALLOWLIST_ENABLED:
    app.add_middleware(IPAllowlistMiddleware)

# 3. Timestamp validation (replay protection, but skip for docs)
# Only add if enabled
if settings.TIMESTAMP_VALIDATION_ENABLED:
    app.add_middleware(TimestampValidationMiddleware)

# 4. API key authentication (skip for docs)
# Only add if required
if settings.API_KEY_REQUIRED:
    app.add_middleware(APIKeyAuthMiddleware)

# 5. Rate limiting (after API key validation, skip for docs)
# Only add if enabled
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware)

# Include routers
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(users.router, prefix=settings.API_V1_PREFIX)
app.include_router(organisations.router, prefix=settings.API_V1_PREFIX)
app.include_router(organizations_rbac.router, prefix=settings.API_V1_PREFIX)
app.include_router(reports.router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)
app.include_router(audit.router, prefix=settings.API_V1_PREFIX)
app.include_router(health.router, prefix=settings.API_V1_PREFIX)
app.include_router(debug_auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(debug_api_key.router, prefix=settings.API_V1_PREFIX)
app.include_router(test_auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(verify_token.router, prefix=settings.API_V1_PREFIX)
app.include_router(test_secret_key.router, prefix=settings.API_V1_PREFIX)
app.include_router(roles.router, prefix=settings.API_V1_PREFIX)
app.include_router(modules.router, prefix=settings.API_V1_PREFIX)
app.include_router(purchase_vouchers.router, prefix=settings.API_V1_PREFIX)
app.include_router(sales_invoices.router, prefix=settings.API_V1_PREFIX)
app.include_router(tax_configurations.router, prefix=settings.API_V1_PREFIX)
app.include_router(customers.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    import signal
    import sys
    
    def signal_handler(sig, frame):
        """Handle Ctrl+C gracefully."""
        logger.info("\nReceived interrupt signal, shutting down gracefully...")
        sys.exit(0)
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=8000,
            reload=settings.DEBUG,
            log_config=None,  # Use our custom logging
            timeout_keep_alive=5,  # Reduce keep-alive timeout
            timeout_graceful_shutdown=10  # Graceful shutdown timeout
        )
    except KeyboardInterrupt:
        logger.info("Server interrupted by user")
        sys.exit(0)

