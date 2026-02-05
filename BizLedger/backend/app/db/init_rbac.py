"""
Initialize RBAC system - run seed data after migrations.
"""
import asyncio
from app.db.session import AsyncSessionLocal
from app.db.seed_rbac import seed_rbac_data


async def init_rbac():
    """Initialize RBAC system with seed data."""
    async with AsyncSessionLocal() as db:
        try:
            await seed_rbac_data(db)
            print("✓ RBAC system initialized successfully.")
        except Exception as e:
            print(f"✗ Error initializing RBAC system: {str(e)}")
            raise


if __name__ == "__main__":
    asyncio.run(init_rbac())
