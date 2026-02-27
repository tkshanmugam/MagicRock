"""
Server startup script with proper signal handling for graceful shutdown.
Use this instead of running uvicorn directly for better Ctrl+C handling.
"""
import uvicorn
import signal
import sys
import os
from app.core.config import settings
from app.core.logging import setup_logging, get_logger

# Initialize logging
setup_logging()
logger = get_logger(__name__)

# Global flag for shutdown
shutdown_requested = False


def signal_handler(sig, frame):
    """Handle Ctrl+C and SIGTERM gracefully."""
    global shutdown_requested
    if not shutdown_requested:
        shutdown_requested = True
        logger.info("\n⚠️  Received interrupt signal (Ctrl+C), shutting down gracefully...")
        logger.info("Please wait for active requests to complete...")
        # Give uvicorn a chance to shutdown gracefully
        sys.exit(0)


def main():
    """Start the server with proper signal handling."""
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # On Windows, also handle CTRL_BREAK_EVENT (optional)
    if sys.platform == "win32":
        try:
            import win32api
            win32api.SetConsoleCtrlHandler(signal_handler, True)
        except (ImportError, AttributeError):
            pass  # win32api not available, continue without it
    
    try:
        logger.info("=" * 60)
        logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
        logger.info("=" * 60)
        logger.info("Press Ctrl+C to stop the server")
        logger.info("=" * 60)
        
        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=8000,
            reload=settings.DEBUG,
            log_config=None,  # Use our custom logging
            timeout_keep_alive=5,
            timeout_graceful_shutdown=10,
            access_log=False  # We have our own logging
        )
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {str(e)}", exc_info=True)
        sys.exit(1)
    finally:
        logger.info("Server shutdown complete")


if __name__ == "__main__":
    main()

