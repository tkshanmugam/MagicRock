# Migration Fix Instructions

## Issue
The migration was failing due to bcrypt 5.0.0+ requiring passwords to be <= 72 bytes.

## Solution Applied

1. **Pinned bcrypt version** to 3.2.2 in `requirements.txt`
   - bcrypt 4.x removed `__about__`, which breaks passlib 1.7.4
   - bcrypt 5.0.0+ raises ValueError for passwords > 72 bytes
   - bcrypt 3.2.2 is compatible with passlib and allows truncation

2. **Added password truncation** in migration
   - Ensures passwords are always <= 72 bytes before hashing
   - Handles UTF-8 encoding safely

## Steps to Fix

1. **Reinstall dependencies:**
   ```bash
   cd backend
   pip install --upgrade -r requirements.txt
   ```

2. **Run migration:**
   ```bash
   alembic upgrade head
   ```

## Alternative Solution (if pinning doesn't work)

If you prefer to use bcrypt 5.0.0+, you can pre-hash passwords with SHA-256:

```python
import hashlib
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    # Pre-hash with SHA-256 to ensure fixed length
    sha256_hash = hashlib.sha256(password.encode()).hexdigest()
    return pwd_context.hash(sha256_hash)
```

However, the current solution (pinning bcrypt 3.2.2 + truncation) is simpler and works well.

