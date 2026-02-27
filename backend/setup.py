"""
Setup script to run database migrations.
Run this after setting up your .env file.
The migration will create tables and seed the super admin user.
"""
import subprocess
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.config import settings


def setup():
    """Run database migrations (creates tables and seeds super admin)."""
    print("=" * 60)
    print(f"Setting up {settings.APP_NAME}")
    print("=" * 60)
    print("\nRunning database migrations...")
    print("This will create tables and seed the super admin user.")
    print("=" * 60)
    
    try:
        # Run Alembic migration
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=Path(__file__).parent,
            check=True,
            capture_output=True,
            text=True
        )
        
        print(result.stdout)
        
        print("\n" + "=" * 60)
        print("Setup completed successfully!")
        print("=" * 60)
        print(f"\nSuper Admin Credentials:")
        print(f"  Username: {settings.SUPER_ADMIN_USERNAME}")
        print(f"  Email: {settings.SUPER_ADMIN_EMAIL}")
        print(f"  Password: [Check your .env file]")
        print("\nYou can now start the server with:")
        print("  uvicorn app.main:app --reload")
        print("=" * 60)
        
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error during migration: {str(e)}")
        if e.stdout:
            print("STDOUT:", e.stdout)
        if e.stderr:
            print("STDERR:", e.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print("\n❌ Error: 'alembic' command not found.")
        print("Make sure you have installed dependencies: pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error during setup: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    setup()

