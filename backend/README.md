# BizLeader Backend API

Production-ready REST API built with FastAPI, PostgreSQL, and SQLAlchemy 2.0 (async).

## Features

- ✅ FastAPI with async/await support
- ✅ PostgreSQL with SQLAlchemy 2.0 async
- ✅ JWT Authentication
- ✅ Role-Based Access Control (RBAC)
- ✅ Audit logging (database + file-based)
- ✅ Request/Response logging middleware
- ✅ Rolling file logs (5-day retention)
- ✅ Idempotent database seeding
- ✅ Alembic migrations
- ✅ Health check endpoint
- ✅ Production-ready security

## Quick Start

### 1. Prerequisites

- Python 3.11+
- PostgreSQL 12+
- pip

### 2. Installation

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Configuration

```bash
# Copy example .env file
cp .env.example .env

# Edit .env with your settings
# Important: Change SECRET_KEY and SUPER_ADMIN credentials!
```

### 4. Database Setup

```bash
# Create PostgreSQL database
createdb bizledger

# Run migrations (creates tables AND seeds super admin)
alembic upgrade head
```

**Note:** The initial migration (`001_initial_migration.py`) will:
- ✅ Create all database tables (users, audit_logs)
- ✅ Create required enum types
- ✅ Seed the super admin user from your `.env` file
- ✅ Idempotent (safe to run multiple times)

### 5. Run the Application

```bash
# Recommended: Use the startup script (better Ctrl+C handling)
python run_server.py

# Or use uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or use Python module
python -m app.main
```

## API Documentation

Once running, access:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: JWT secret key (generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
- `SUPER_ADMIN_USERNAME`: Super admin username
- `SUPER_ADMIN_PASSWORD`: Super admin password
- `SUPER_ADMIN_EMAIL`: Super admin email

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

### Users (Admin only)
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `GET /api/v1/users/{id}` - Get user
- `PUT /api/v1/users/{id}` - Update user
- `DELETE /api/v1/users/{id}` - Delete user (Super Admin only)

### Audit Logs (Admin only)
- `GET /api/v1/audit` - List audit logs
- `GET /api/v1/audit/{id}` - Get audit log

### Health
- `GET /api/v1/health` - Health check

## User Roles

- **SUPER_ADMIN**: Full system access
- **ADMIN**: User management access
- **USER**: Basic user access

## Logging

Logs are stored in `logs/` directory:
- `access.log`: HTTP request/response logs
- `error.log`: Application errors

Logs rotate daily at midnight and retain last 5 days.

## Database Migrations

The initial migration automatically:
- Creates all database tables
- Seeds the super admin user from `.env` settings
- Is idempotent (safe to re-run)

```bash
# Apply all migrations (including initial setup)
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "Description"

# Rollback one migration
alembic downgrade -1

# Check current migration version
alembic current
```

## API Key Security

The API requires API key authentication for all endpoints (except public endpoints).

### Generate API Keys

```bash
# Generate a single API key
python generate_api_keys.py

# Generate multiple API keys
python generate_api_keys.py 3
```

### Configure API Keys

Add to your `.env` file:
```env
API_KEYS=your-api-key-1,your-api-key-2,your-api-key-3
API_KEY_HEADER=X-API-KEY
API_KEY_REQUIRED=true
```

### Using API Keys

Include the API key in the request header:
```bash
curl -H "X-API-KEY: your-api-key" \
     -H "X-TIMESTAMP: $(date +%s)" \
     http://localhost:8000/api/v1/users
```

### Security Features

- **API Key Authentication**: All requests require valid API key
- **Rate Limiting**: Configurable per API key (default: 100 requests/minute)
- **Replay Protection**: Timestamp validation prevents replay attacks
- **IP Allowlist**: Optional IP-based access control
- **Constant-Time Comparison**: Prevents timing attacks

### Public Endpoints

These endpoints don't require API keys:
- `/api/v1/health` (configurable)

## Security Notes

- Never commit `.env` file
- Use strong `SECRET_KEY` in production
- Generate secure API keys (32+ characters)
- Change default super admin credentials
- Enable HTTPS in production
- Configure CORS origins properly
- Rotate API keys periodically
- Never log API keys

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app entry point
│   ├── core/                # Core configuration
│   │   ├── config.py        # Settings
│   │   ├── security.py      # JWT & hashing
│   │   └── logging.py       # Logging config
│   ├── db/                  # Database
│   │   ├── session.py       # DB session
│   │   └── seed.py          # Seeding
│   ├── models/              # SQLAlchemy models
│   ├── services/            # Business logic
│   ├── api/                 # API routes
│   ├── middlewares/         # Middleware
│   └── logs/                # Log files
├── alembic/                 # Migrations
├── requirements.txt
└── .env
```

## License

Proprietary - BizLeader Project

## Initial User Role
UPDATE users
SET role = 'SUPER_ADMIN'
WHERE username = 'admin' AND (role IS NULL OR role != 'SUPER_ADMIN');
