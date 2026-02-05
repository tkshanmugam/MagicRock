"""
Database seeding with idempotent super admin creation.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


async def seed_super_admin(db: AsyncSession):
    """Create super admin user if it doesn't exist (idempotent)."""
    # Check if super admin already exists
    result = await db.execute(
        select(User).where(User.username == settings.SUPER_ADMIN_USERNAME)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        logger.info(f"Super admin user '{settings.SUPER_ADMIN_USERNAME}' already exists. Skipping creation.")
        return existing_user
    
    # Create super admin
    super_admin = User(
        username=settings.SUPER_ADMIN_USERNAME,
        email=settings.SUPER_ADMIN_EMAIL,
        hashed_password=get_password_hash(settings.SUPER_ADMIN_PASSWORD),
        role=UserRole.SUPER_ADMIN,
        is_active=True,
        full_name="Super Administrator"
    )
    
    db.add(super_admin)
    await db.commit()
    await db.refresh(super_admin)
    
    logger.info(f"Super admin user '{settings.SUPER_ADMIN_USERNAME}' created successfully.")
    return super_admin


async def run_seeds(db: AsyncSession):
    """Run all seed functions."""
    logger.info("Starting database seeding...")
    
    try:
        await seed_super_admin(db)
        logger.info("Database seeding completed successfully.")
    except Exception as e:
        logger.error(f"Error during database seeding: {str(e)}", exc_info=True)
        raise

