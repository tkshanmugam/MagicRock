# RBAC System Implementation

## Overview

A production-ready Role-Based Access Control (RBAC) system has been implemented for the multi-organization FastAPI backend. The system provides fine-grained permission control at the module and action level.

## Architecture

### Database Models

All models are located in `app/models/`:

1. **Organization** (`organization.py`)
   - `id`, `name`, `status`, `created_at`
   - Represents an organization/tenant

2. **Role** (`role.py`)
   - `id`, `name` (unique)
   - Default roles: Admin, Manager, Viewer

3. **Module** (`module.py`)
   - `id`, `code` (unique), `name`
   - Default modules: DASHBOARD, REPORTS, BILLING

4. **UserOrganization** (`user_organization.py`)
   - Links users to organizations with roles
   - Unique constraint on (user_id, organization_id)
   - Uses `users.id` as foreign key (NOT modified)

5. **RoleModulePermission** (`role_module_permission.py`)
   - Defines permissions (can_view, can_create, can_update, can_delete)
   - Unique constraint on (role_id, module_id)

### Permission Service

**Location**: `app/services/permissions.py`

The `check_permission()` function validates:
1. User belongs to organization
2. User's role in organization
3. Module exists
4. Role has required permission for action

### FastAPI Dependency

**Location**: `app/api/dependencies_rbac.py`

`RequirePermission` class provides reusable dependency:

```python
@router.get("/reports")
async def get_reports(
    organization_id: int,
    _=Depends(RequirePermission("REPORTS", "view"))
):
    ...
```

## API Endpoints

### Organizations

- `POST /api/v1/organizations` - Create organization (Admin only)
- `GET /api/v1/organizations/me` - Get user's organizations

### User ↔ Organization Management

- `POST /api/v1/organizations/{org_id}/users` - Assign user to organization with role (Admin only)
- `PUT /api/v1/organizations/{org_id}/users/{user_id}/role` - Update user role (Admin only)

### Permissions

- `GET /api/v1/organizations/{org_id}/permissions/me` - Get current user's permissions

Response format:
```json
{
  "organizationId": 1,
  "modules": [
    {
      "code": "REPORTS",
      "canView": true,
      "canCreate": false,
      "canUpdate": false,
      "canDelete": false
    }
  ]
}
```

## Setup Instructions

### 1. Run Migrations

```bash
alembic upgrade head
```

This creates all RBAC tables.

### 2. Seed Default Data

```bash
python -m app.db.init_rbac
```

This seeds:
- Default roles (Admin, Manager, Viewer)
- Default modules (DASHBOARD, REPORTS, BILLING)
- Default permissions:
  - **Admin**: Full permissions (view, create, update, delete) on all modules
  - **Manager**: Limited permissions (view, create, update, no delete) on all modules
  - **Viewer**: Read-only permissions (view only) on all modules

### 3. Usage Example

See `app/api/reports_example.py` for example protected routes.

## Key Features

✅ **No modification to users table** - Uses existing `users.id` as foreign key only  
✅ **Backend is source of truth** - All permission logic in backend  
✅ **Clean separation** - Permission logic in service layer, not route handlers  
✅ **Reusable dependency** - `RequirePermission` for easy route protection  
✅ **Multi-organization support** - Users can belong to multiple organizations with different roles  
✅ **Module-level permissions** - Fine-grained control per module  
✅ **Action-level permissions** - Separate permissions for view, create, update, delete  

## File Structure

```
app/
├── models/
│   ├── organization.py
│   ├── role.py
│   ├── module.py
│   ├── user_organization.py
│   └── role_module_permission.py
├── services/
│   └── permissions.py
├── api/
│   ├── dependencies_rbac.py
│   ├── organizations_rbac.py
│   └── reports_example.py
├── db/
│   ├── seed_rbac.py
│   └── init_rbac.py
alembic/versions/
└── 004_add_rbac_system.py
```

## Testing the System

1. Create an organization
2. Assign a user to the organization with a role
3. Access protected endpoints with proper permissions
4. Verify 403 errors when permissions are insufficient
