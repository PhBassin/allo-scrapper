# Roles and Permissions Reference

Complete reference for the Role-Based Access Control (RBAC) system in Allo-Scrapper.

**Last updated:** March 13, 2026

---

## Table of Contents

- [Overview](#overview)
- [Database Schema](#database-schema)
- [Permissions](#permissions)
- [Roles](#roles)
- [Admin Bypass System](#admin-bypass-system)
- [JWT Payload](#jwt-payload)
- [API Endpoints](#api-endpoints)
- [Middleware](#middleware)
- [Client-Side Integration](#client-side-integration)
- [User Flows](#user-flows)
- [Limitations & Gotchas](#limitations--gotchas)

---

## Overview

Allo-Scrapper uses a comprehensive Role-Based Access Control (RBAC) system that replaced the previous binary admin/user role system. This system provides fine-grained permissions across all application features.

### What RBAC Replaced

**Before (Legacy System):**
- Binary roles: `admin` (full access) or `user` (read-only)
- Hard-coded permission checks in middleware
- No flexibility for custom access levels

**After (RBAC System):**
- 24 granular permissions across 6 categories
- Database-driven role and permission management
- Custom roles with specific permission sets
- Admin bypass for backwards compatibility
- Full API for role management

### Why RBAC Matters

- **Principle of Least Privilege**: Users get only the permissions they need
- **Operational Flexibility**: Create custom roles for specific job functions
- **Security**: Granular control over sensitive operations
- **Scalability**: Easy to add new permissions and roles as the system grows

---

## Database Schema

### Tables

The RBAC system uses four main tables:

#### `roles`
Stores role definitions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing role ID |
| `name` | TEXT | NOT NULL, UNIQUE | Role name (e.g., 'admin', 'operator') |
| `description` | TEXT | | Human-readable description |
| `is_system` | BOOLEAN | NOT NULL, DEFAULT false | True for built-in system roles |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

#### `permissions`
Stores permission definitions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing permission ID |
| `name` | TEXT | NOT NULL, UNIQUE | Permission name (e.g., 'users:create') |
| `description` | TEXT | | Human-readable description |
| `category` | TEXT | NOT NULL | Permission category (e.g., 'users', 'scraper') |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

#### `role_permissions`
Junction table linking roles to permissions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `role_id` | INTEGER | NOT NULL, FK → `roles(id)` ON DELETE CASCADE | Role ID |
| `permission_id` | INTEGER | NOT NULL, FK → `permissions(id)` ON DELETE CASCADE | Permission ID |
| **PRIMARY KEY** | | `(role_id, permission_id)` | Composite primary key |

#### `users` (Modified)
User table updated to reference roles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `role_id` | INTEGER | NOT NULL, FK → `roles(id)` | User's assigned role |

**Index:** `idx_users_role_id` on `role_id`

### Relationships

```
roles (1) ──< role_permissions (N) ──> permissions (N)
  │
  └──< users (N)
```

**Cascade Behavior:**
- Deleting a role → Deletes all role_permissions entries for that role
- Deleting a permission → Deletes all role_permissions entries for that permission
- Cannot delete roles with assigned users (enforced by application logic)
- Cannot delete system roles (`is_system = true`)

---

## Permissions

### Complete Permission List

The system defines **24 canonical permissions** across **6 categories**:

#### Users (4 permissions)
| Permission | Description |
|------------|-------------|
| `users:list` | List all users |
| `users:create` | Create new users |
| `users:update` | Modify existing users |
| `users:delete` | Delete users |

#### Scraper (2 permissions)
| Permission | Description |
|------------|-------------|
| `scraper:trigger` | Trigger global scraping job |
| `scraper:trigger_single` | Trigger scraping for a single cinema |

#### Cinemas (3 permissions)
| Permission | Description |
|------------|-------------|
| `cinemas:create` | Add new cinemas |
| `cinemas:update` | Modify cinema information |
| `cinemas:delete` | Remove cinemas |

#### Settings (5 permissions)
| Permission | Description |
|------------|-------------|
| `settings:read` | View admin settings |
| `settings:update` | Modify application settings |
| `settings:reset` | Reset settings to defaults |
| `settings:export` | Export settings configuration |
| `settings:import` | Import settings configuration |

#### Reports (2 permissions)
| Permission | Description |
|------------|-------------|
| `reports:list` | List scraping reports |
| `reports:view` | View detailed scraping reports |

#### System (3 permissions)
| Permission | Description |
|------------|-------------|
| `system:info` | View system information |
| `system:health` | View system health status |
| `system:migrations` | View database migration status |

#### Roles (5 permissions)
| Permission | Description |
|------------|-------------|
| `roles:list` | List all roles and permissions |
| `roles:read` | View specific role details |
| `roles:create` | Create new roles |
| `roles:update` | Modify roles and assign permissions |
| `roles:delete` | Delete custom roles |

### Permission Categories

Permissions are organized into logical categories for easier management:

- **users** - User account management
- **scraper** - Scraping operations
- **cinemas** - Cinema data management
- **settings** - Application configuration
- **reports** - Scraping reports and analytics
- **system** - System monitoring and diagnostics
- **roles** - Role and permission management

---

## Roles

### Seed Data

The system comes with two predefined system roles:

#### Admin Role
- **Name**: `admin`
- **Description**: "Administrateur — accès total"
- **Type**: System role (`is_system = true`)
- **Permissions**: **ALL** (via admin bypass mechanism)
- **Cannot be**: Modified or deleted

#### Operator Role
- **Name**: `operator`
- **Description**: "Opérateur — scraping et gestion des cinémas"
- **Type**: System role (`is_system = true`)
- **Permissions**: 7 explicit permissions:
  - `scraper:trigger`
  - `scraper:trigger_single`
  - `cinemas:create`
  - `cinemas:update`
  - `cinemas:delete`
  - `reports:list`
  - `reports:view`
- **Cannot be**: Modified or deleted

### System vs Custom Roles

#### System Roles (`is_system = true`)
- **Built-in**: Created during database initialization
- **Protected**: Cannot be modified or deleted
- **Special behavior**: Admin role has bypass mechanism
- **Examples**: `admin`, `operator`

#### Custom Roles (`is_system = false`)
- **User-created**: Created via admin panel or API
- **Modifiable**: Can be edited, renamed, or deleted
- **Flexible**: Any combination of permissions
- **Restrictions**: Cannot be deleted if users are assigned to them

---

## Admin Bypass System

The admin role has special bypass behavior for backwards compatibility and security.

### Dual Mechanism

1. **JWT contains all permissions**: During login, admin users get ALL 24 permissions in their JWT payload
2. **Middleware short-circuits**: `requirePermission()` middleware bypasses permission checks for admin

### Bypass Logic

```typescript
// In requirePermission() middleware
if (req.user.role_name === 'admin' && req.user.is_system_role) {
  return next(); // Skip permission check
}
```

### Security Note

**CRITICAL**: Only the system role named "admin" with `is_system = true` gets bypass privileges.

- ✅ System admin role: `{ name: 'admin', is_system: true }` → **HAS BYPASS**
- ❌ Custom admin role: `{ name: 'admin', is_system: false }` → **NO BYPASS**

This prevents privilege escalation by creating custom roles named "admin".

---

## JWT Payload

### Structure

JWTs contain the following user information:

```typescript
interface JWTPayload {
  id: number;                    // User database ID
  username: string;              // Username
  role_name: string;             // Role name (e.g., 'admin', 'operator')
  is_system_role: boolean;       // True for built-in system roles
  permissions: string[];         // Array of permission names
}
```

### Example Payloads

**Admin user:**
```json
{
  "id": 1,
  "username": "admin",
  "role_name": "admin",
  "is_system_role": true,
  "permissions": [
    "users:list", "users:create", "users:update", "users:delete",
    "scraper:trigger", "scraper:trigger_single",
    "cinemas:create", "cinemas:update", "cinemas:delete",
    "settings:read", "settings:update", "settings:reset", "settings:export", "settings:import",
    "reports:list", "reports:view",
    "system:info", "system:health", "system:migrations",
    "roles:list", "roles:read", "roles:create", "roles:update", "roles:delete"
  ]
}
```

**Operator user:**
```json
{
  "id": 2,
  "username": "operator1",
  "role_name": "operator",
  "is_system_role": true,
  "permissions": [
    "scraper:trigger",
    "scraper:trigger_single",
    "cinemas:create",
    "cinemas:update",
    "cinemas:delete",
    "reports:list",
    "reports:view"
  ]
}
```

### Token Properties

- **Expiry**: 24 hours from issue time
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Secret**: Configured via `JWT_SECRET` environment variable
- **Refresh**: No refresh tokens; users must re-login after expiry

### Re-login Requirement

**Important**: Permissions are baked into the JWT at login time. If a user's role or permissions change, they must log out and log back in to receive an updated token with new permissions.

---

## API Endpoints

### Roles and Permissions Management

The system provides 7 API endpoints for managing roles and permissions:

#### 1. List All Permissions
```
GET /api/roles/permissions
```
**Permission Required**: `roles:list`  
**Description**: Get all available permissions grouped by category

**Response Example**:
```json
{
  "success": true,
  "data": {
    "users": [
      { "id": 1, "name": "users:list", "description": "List all users" },
      { "id": 2, "name": "users:create", "description": "Create new users" }
    ],
    "scraper": [
      { "id": 5, "name": "scraper:trigger", "description": "Trigger global scraping job" }
    ]
  }
}
```

#### 2. List All Roles
```
GET /api/roles
```
**Permission Required**: `roles:list`  
**Description**: Get all roles with their assigned permissions

**Response Example**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "admin",
      "description": "Administrateur — accès total",
      "is_system": true,
      "permissions": ["users:list", "users:create", "..."]
    },
    {
      "id": 2,
      "name": "operator",
      "description": "Opérateur — scraping et gestion des cinémas",
      "is_system": true,
      "permissions": ["scraper:trigger", "cinemas:create", "..."]
    }
  ]
}
```

#### 3. Get Specific Role
```
GET /api/roles/:id
```
**Permission Required**: `roles:read`  
**Description**: Get detailed information about a specific role

**Response Example**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "operator",
    "description": "Opérateur — scraping et gestion des cinémas",
    "is_system": true,
    "permissions": [
      { "id": 5, "name": "scraper:trigger", "category": "scraper" },
      { "id": 6, "name": "scraper:trigger_single", "category": "scraper" }
    ]
  }
}
```

#### 4. Create New Role
```
POST /api/roles
```
**Permission Required**: `roles:create`  
**Description**: Create a new custom role

**Request Body**:
```json
{
  "name": "cinema_manager",
  "description": "Manages cinema data only"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "cinema_manager",
    "description": "Manages cinema data only",
    "is_system": false,
    "permissions": []
  }
}
```

#### 5. Update Role Details
```
PUT /api/roles/:id
```
**Permission Required**: `roles:update`  
**Description**: Update role name and description (custom roles only)

**Request Body**:
```json
{
  "name": "cinema_admin",
  "description": "Cinema administrator with full cinema access"
}
```

#### 6. Delete Role
```
DELETE /api/roles/:id
```
**Permission Required**: `roles:delete`  
**Description**: Delete a custom role

**Restrictions**:
- Cannot delete system roles (`is_system = true`)
- Cannot delete roles with assigned users
- Returns 400 error if restrictions violated

#### 7. Update Role Permissions
```
PUT /api/roles/:id/permissions
```
**Permission Required**: `roles:update`  
**Description**: Replace all permissions for a role

**Request Body**:
```json
{
  "permission_ids": [7, 8, 9, 19, 20]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "role_id": 3,
    "permissions_updated": 5,
    "permissions": [
      "cinemas:create",
      "cinemas:update", 
      "cinemas:delete",
      "reports:list",
      "reports:view"
    ]
  }
}
```

---

## Middleware

### requirePermission() Function

The core middleware function for permission checking.

#### Usage

```typescript
import { requirePermission } from '@/middleware/permission';

// Single permission
router.post('/users', requireAuth, requirePermission('users:create'), createUser);

// Multiple permissions (all required)
router.put('/settings', requireAuth, requirePermission('settings:update', 'settings:read'), updateSettings);
```

#### Parameters

- **Variadic parameters**: Accepts one or more permission strings
- **All required**: User must have ALL specified permissions
- **Order matters**: Must be used AFTER `requireAuth` middleware

#### Response Codes

- **401 Unauthorized**: User not authenticated (no valid JWT)
- **403 Forbidden**: User authenticated but lacks required permissions

#### Response Examples

**401 Unauthorized**:
```json
{
  "success": false,
  "error": "Authentication required"
}
```

**403 Forbidden**:
```json
{
  "success": false,
  "error": "Permission denied"
}
```

#### Implementation Details

```typescript
export function requirePermission(...requiredPermissions: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Admin bypass
    if (req.user.role_name === 'admin' && req.user.is_system_role) {
      return next();
    }

    // Check permissions
    const userPermissions = new Set(req.user.permissions);
    const hasAll = requiredPermissions.every(p => userPermissions.has(p));

    if (!hasAll) {
      const missing = requiredPermissions.filter(p => !userPermissions.has(p));
      logger.warn('Permission denied', {
        user_id: req.user.id,
        username: req.user.username,
        required: requiredPermissions,
        missing: missing,
        endpoint: req.path
      });
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }

    return next();
  };
}
```

---

## Client-Side Integration

### AuthContext

The React context provides authentication state and permission checking.

#### Interface

```typescript
interface User {
  id: number;
  username: string;
  role_id: number;
  role_name: string;
  is_system_role: boolean;
  permissions: string[];
}

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
  isAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}
```

#### hasPermission() Function

Client-side permission checking with admin bypass:

```typescript
const hasPermission = (permission: string): boolean => {
  if (!user) return false;
  
  // Admin bypass
  if (user.role_name === 'admin' && user.is_system_role) {
    return true;
  }
  
  return user.permissions.includes(permission);
};
```

#### Usage Example

```typescript
import { useAuth } from '@/contexts/AuthContext';

function UserManagementButton() {
  const { hasPermission } = useAuth();
  
  if (!hasPermission('users:create')) {
    return null; // Hide button if no permission
  }
  
  return <button onClick={createUser}>Create User</button>;
}
```

### RequirePermission Component

Route-level permission protection component.

#### Props

```typescript
interface RequirePermissionProps {
  children: React.ReactNode;
  permission?: string;      // Single permission required
  anyOf?: string[];         // At least one of these permissions
  allOf?: string[];         // All of these permissions required
}
```

#### Usage Examples

**Single permission:**
```tsx
<RequirePermission permission="users:create">
  <CreateUserForm />
</RequirePermission>
```

**Any of multiple permissions:**
```tsx
<RequirePermission anyOf={["reports:list", "reports:view"]}>
  <ReportsPage />
</RequirePermission>
```

**All of multiple permissions:**
```tsx
<RequirePermission allOf={["settings:read", "settings:update"]}>
  <AdvancedSettingsPanel />
</RequirePermission>
```

#### Behavior

- **Unauthenticated users**: Redirected to `/login`
- **Insufficient permissions**: Redirected to `/` with error message
- **Admin users**: Always pass (admin bypass)
- **Valid permissions**: Renders children normally

---

## User Flows

### Example User Scenarios

#### Admin User Flow
1. **Login**: Admin logs in with credentials
2. **JWT issued**: Contains all 24 permissions
3. **Access anything**: Admin bypass allows access to all features
4. **No restrictions**: Can manage users, settings, roles, etc.

#### Operator User Flow
1. **Login**: Operator logs in with credentials
2. **JWT issued**: Contains 7 specific permissions
3. **Limited access**: Can trigger scraping and manage cinemas
4. **Blocked features**: Cannot access user management or settings

#### Custom Role User Flow
1. **Role created**: Admin creates "Cinema Manager" role
2. **Permissions assigned**: Admin assigns cinema and reports permissions
3. **User assigned**: Admin assigns user to the new role
4. **User login**: User gets JWT with custom permission set
5. **Scoped access**: User can only access assigned features

### Permission Checking Flow

```
1. User makes request to protected endpoint
2. requireAuth middleware validates JWT
3. requirePermission middleware checks permissions:
   a. If admin + system role → Allow (bypass)
   b. If has required permissions → Allow
   c. Otherwise → Deny (403)
4. Endpoint handler executes (if allowed)
```

---

## Limitations & Gotchas

### JWT Token Limitations

#### No Automatic Permission Updates
**Issue**: Permissions are baked into JWT at login time  
**Impact**: Role/permission changes don't take effect until re-login  
**Workaround**: Users must logout and login again after role changes

**Example**:
```
1. User logs in as 'operator' → JWT contains operator permissions
2. Admin promotes user to 'admin' role
3. User still has operator permissions until they re-login
4. User must logout and login to get admin permissions
```

#### 24-Hour Token Expiry
**Issue**: Tokens expire after 24 hours  
**Impact**: Users must re-authenticate daily  
**No refresh tokens**: Must enter credentials again

### Client-Side Permission Checking

#### scraper:trigger_single Only Client-Side
**Issue**: `scraper:trigger_single` permission only enforced in React UI  
**Impact**: API endpoint doesn't check this specific permission  
**Security**: Not a security issue (API has other protections)

**Details**:
- UI hides "Trigger Single" button without permission
- API endpoint `/api/scraper/trigger` accepts cinema_id parameter
- Backend doesn't distinguish between global and single-cinema triggers

### Phantom Permissions Issue

**Reference**: GitHub Issue #442  
**Issue**: Non-canonical permissions may exist in database  
**Cause**: Historical data or manual database modifications  
**Solution**: Migration 010 cleans up phantom permissions

**Canonical permissions**: Only the 24 permissions listed in this document are officially supported. Any other permissions in the database should be considered invalid.

### System Role Protection

#### Cannot Modify System Roles
**Protection**: System roles (`is_system = true`) cannot be modified or deleted  
**Reason**: Prevents breaking core functionality  
**Affected roles**: `admin`, `operator`

#### Admin Bypass Security
**Critical**: Only system admin role gets bypass privileges  
**Risk**: Creating custom role named "admin" does NOT grant bypass  
**Protection**: Bypass check includes `is_system_role = true` requirement

### Database Constraints

#### Role Deletion Restrictions
- Cannot delete system roles
- Cannot delete roles with assigned users
- Must reassign users before deleting custom roles

#### Permission Deletion Impact
- Deleting permissions removes them from all roles
- May break existing functionality
- Should only be done during planned migrations

---

## Related Documentation

- [User Management Guide](../guides/administration/user-management.md) - Managing users and role assignments
- [Admin Panel Guide](../guides/administration/admin-panel.md) - Admin interface usage
- [Database Schema](./database/schema.md) - Complete database structure
- [Database Migrations](./database/migrations.md) - RBAC migration details
- [API Reference](./api/README.md) - Complete API documentation
- [Authentication API](./api/auth.md) - Login and JWT handling

---

[← Back to Reference Documentation](./README.md)