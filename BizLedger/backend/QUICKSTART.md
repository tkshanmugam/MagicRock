# Quick Start Guide

## 1. Install Dependencies

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

## 2. Configure Environment

```bash
# Copy example env file
copy env.example .env  # Windows
# cp env.example .env  # Linux/Mac

# Edit .env and set:
# - DATABASE_URL (your PostgreSQL connection string)
# - SECRET_KEY (generate with: python -c "import secrets; print(secrets.token_urlsafe(32))")
# - SUPER_ADMIN credentials
```

## 3. Create Database

```bash
# Using psql
createdb bizledger

# Or using SQL
psql -U postgres
CREATE DATABASE bizledger;
```

## 4. Initialize Database

```bash
# Option 1: Use setup script (creates tables + seeds)
python setup.py

# Option 2: Use Alembic (recommended for production)
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
python setup.py  # Just for seeding
```

## 5. Start Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 6. Test API

- **Swagger UI**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/api/v1/health
- **Login**: POST http://localhost:8000/api/v1/auth/login

### Example Login Request

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'
```

### Example Authenticated Request

```bash
curl -X GET "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Troubleshooting

### Database Connection Error
- Verify PostgreSQL is running
- Check DATABASE_URL in .env
- Ensure database exists

### Import Errors
- Make sure you're in the backend directory
- Activate virtual environment
- Verify all dependencies installed

### Migration Errors
- Run `alembic upgrade head` to apply migrations
- Check database connection
- Verify models are imported in alembic/env.py

