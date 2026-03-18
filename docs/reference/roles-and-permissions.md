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
- 26 granular permissions across 7 categories
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

The system defines **26 canonical permissions** across **7 categories**:

#### Users (5 permissions)
| Permission | Description |
|------------|-------------|
| `users:list` | List all users |
| `users:create` | Create new users |
| `users:update` | Modify existing users |
| `users:delete` | Delete users |
| `users:read` | View user details |

#### Scraper (2 permissions)
| Permission | Description |
|------------|-------------|
| `scraper:trigger` | Trigger global scraping job |
| `scraper:trigger_single` | Trigger scraping for a single cinema |

#### Cinemas (4 permissions)
| Permission | Description |
|------------|-------------|
| `cinemas:create` | Add new cinemas |
| `cinemas:update` | Modify cinema information |
| `cinemas:delete` | Remove cinemas |
| `cinemas:read` | View cinemas list and details |

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
- **Permissions**: 9 explicit permissions:
  - `scraper:trigger`
  - `scraper:trigger_single`
  - `cinemas:create`
  - `cinemas:update`
  - `cinemas:delete`
  - `cinemas:read`
  - `users:read`
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

1. **JWT contains all permissions**: During login, admin users get ALL 26 permissions in their JWT payload
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
  permissions: PermissionName[]; // Array of valid permission names
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
    "users:list", "users:create", "users:update", "users:delete", "users:read",
    "scraper:trigger", "scraper:trigger_single",
    "cinemas:create", "cinemas:update", "cinemas:delete", "cinemas:read",
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
    "cinemas:read",
    "users:read",
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

### Client-Side Token Expiry Handling

The React client (`AuthContext`) implements **proactive token expiry detection** to automatically log users out when their JWT expires, providing a seamless user experience.

#### Implementation

**Timer-Based Auto-Logout:**
```typescript
// In AuthContext.tsx
const login = (token: string, user: User) => {
  setToken(token);
  setUser(user);
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));

  // Decode JWT to get expiry time
  const decoded = jwtDecode<{ exp: number }>(token);
  const expiresAt = decoded.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  const timeUntilExpiry = expiresAt - now;

  // Schedule auto-logout exactly when token expires
  if (timeUntilExpiry > 0) {
    const timerId = setTimeout(() => {
      logout();
      window.dispatchEvent(new CustomEvent('auth:unauthorized', { 
        detail: { reason: 'session_expired' } 
      }));
    }, timeUntilExpiry);

    // Store timer ID to clear on manual logout
    setExpiryTimerId(timerId);
  }
};

const logout = () => {
  // Clear the expiry timer
  if (expiryTimerId) {
    clearTimeout(expiryTimerId);
    setExpiryTimerId(null);
  }
  
  setToken(null);
  setUser(null);
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};
```

#### Behavior

1. **At Login**: Timer is set to fire exactly when JWT expires
2. **On Expiry**: User is automatically logged out and redirected to `/login`
3. **User Feedback**: Login page displays "Votre session a expiré. Veuillez vous reconnecter." message
4. **Manual Logout**: Timer is cleared to prevent double-logout

#### Benefits

- **No Surprise 401 Errors**: Users never encounter failed API requests due to expired tokens
- **Graceful UX**: Users see a clear "session expired" message instead of generic errors
- **Consistent Behavior**: Expiry happens at the same moment for all tabs (via localStorage events)

#### Configuration

Token expiry duration is controlled by the `JWT_EXPIRES_IN` environment variable on the server (default: `24h`). The client automatically adapts to whatever expiry time is encoded in the JWT.

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
export function requirePermission(...requiredPermissions: PermissionName[]) {
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
  permissions: PermissionName[];
}

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
  isAdmin: boolean;
  hasPermission: (permission: PermissionName) => boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}
```

#### hasPermission() Function

Client-side permission checking with admin bypass:

```typescript
const hasPermission = (permission: PermissionName): boolean => {
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
  permission?: PermissionName;  // Single permission required
  anyOf?: PermissionName[];     // At least one of these permissions
  allOf?: PermissionName[];     // All of these permissions required
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

### Admin Access Control

#### ADMIN_PERMISSIONS Constant

The system defines which permissions grant access to the `/admin` panel via the `ADMIN_PERMISSIONS` constant in `client/src/utils/adminPermissions.ts`.

**Definition**:
```typescript
export const ADMIN_PERMISSIONS: PermissionName[] = [
  // Users (5)
  'users:list', 'users:create', 'users:update', 'users:delete', 'users:read',
  
  // Scraper (2)
  'scraper:trigger', 'scraper:trigger_single',
  
  // Cinemas (4)
  'cinemas:create', 'cinemas:update', 'cinemas:delete', 'cinemas:read',
  
  // Settings (5)
  'settings:read', 'settings:update', 'settings:reset', 'settings:export', 'settings:import',
  
  // Reports (2)
  'reports:list', 'reports:view',
  
  // System (3)
  'system:info', 'system:health', 'system:migrations',
  
  // Roles (5)
  'roles:list', 'roles:read', 'roles:create', 'roles:update', 'roles:delete'
];
```

**Total**: All 26 permissions are included

#### Usage in Routing

The admin panel route uses this constant to determine access:

```typescript
// In App.tsx or routing configuration
<Route
  path="/admin/*"
  element={
    <RequirePermission anyOf={ADMIN_PERMISSIONS}>
      <AdminLayout />
    </RequirePermission>
  }
/>
```

**Access Logic**:
- User needs **at least one** of the 26 permissions to access `/admin`
- Admin users (via admin bypass) automatically have access
- Users with no admin permissions are redirected to home page

#### Why This Matters

This ensures that **any** administrative permission grants access to the admin panel UI, while specific pages within the panel still require their respective permissions. For example:
- User with `cinemas:update` can access `/admin` (can see the panel)
- But they cannot access `/admin/users` (requires user management permissions)
- Individual admin pages use their own `<RequirePermission>` checks

---

## User Flows

### Example User Scenarios

#### Admin User Flow
1. **Login**: Admin logs in with credentials
2. **JWT issued**: Contains all 26 permissions
3. **Access anything**: Admin bypass allows access to all features
4. **No restrictions**: Can manage users, settings, roles, etc.

#### Operator User Flow
1. **Login**: Operator logs in with credentials
2. **JWT issued**: Contains 9 specific permissions
3. **Limited access**: Can trigger scraping and manage cinemas
4. **Blocked features**: Cannot access user management or settings

#### Custom Role User Flow
1. **Role created**: Admin creates "Cinema Manager" role
2. **Permissions assigned**: Admin assigns cinema and reports permissions
3. **User assigned**: Admin assigns user to the new role
4. **User login**: User gets JWT with custom permission set
5. **Scoped access**: User can only access assigned features

### Creating a Custom Role Does NOT Assign It to Users
**Important**: Creating a custom role and assigning permissions to it does NOT automatically assign users to that role. The role must be explicitly assigned to users.

**Common Misunderstanding**:
```
❌ WRONG: Create role → Assign permissions → User has those permissions
✅ CORRECT: Create role → Assign permissions → Assign role to user → User has those permissions
```

**Example Scenario**:
1. Admin creates "Schedule Operator" role with only `scraper:schedules:list` and `scraper:schedules:create`
2. Admin assigns these permissions to the role
3. Admin creates a new user, thinking they'll have schedule-only access
4. **Problem**: The user still has their old role (e.g., "admin") because only the *role* was created/modified
5. **Solution**: Admin must explicitly change the user's role in the Users page

**How to Assign a Role to a User**:
1. Go to **Admin → Users** tab
2. Find the user you want to modify
3. Change their role from the dropdown
4. User must **logout and log back in** to get the new permissions in their JWT

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

#### Token Expiry
**Default**: Tokens expire after 24 hours (configurable via `JWT_EXPIRES_IN`)  
**Client Behavior**: Proactive auto-logout at exact expiry time (see [Client-Side Token Expiry Handling](#client-side-token-expiry-handling))  
**Impact**: Users see "session expired" message and must re-authenticate  
**No refresh tokens**: Must enter credentials again

**Configuration**:
```env
JWT_EXPIRES_IN=24h  # Default: 24 hours
JWT_EXPIRES_IN=7d   # Alternative: 7 days
JWT_EXPIRES_IN=30m  # Alternative: 30 minutes
```

### Role Management Gotchas

#### Role Creation Does Not Assign Users
**Issue**: Creating a custom role and assigning permissions does NOT automatically assign it to existing users  
**Impact**: Users keep their old role until explicitly reassigned  
**Symptoms**: User sees all tabs despite having a "limited" role - this means the user still has their old role (like "admin") assigned  

**Diagnosis**:
1. Check user's JWT payload in browser localStorage (`user` key)
2. Look at `role_name` and `is_system_role` fields
3. If `role_name` is "admin" and `is_system_role` is `true`, the user has admin privileges via the admin bypass

**Solution**:
1. Go to **Admin → Users** tab
2. Find the user
3. Change their role from "admin" to your custom role
4. Have the user logout and log back in

**Prevention**: Always verify user role assignment after creating or modifying roles

### Client-Side Permission Checking

#### scraper:trigger vs scraper:trigger_single
**Behavior**: Split permission check for granular scraping control  
**Implementation**: Server-side permission enforcement in `/api/scraper/trigger`  
**Permission Logic**:
- `scraper:trigger_single` required for single-cinema scraping (when `cinemaId` is present)
- `scraper:trigger` required for all-cinema scraping (when no `cinemaId`)
- `scraper:trigger` is a superset that allows both operations

**Details**:
- UI shows "Trigger Single" button based on `scraper:trigger_single` permission
- UI shows "Trigger All" button based on `scraper:trigger` permission
- API endpoint `/api/scraper/trigger` enforces permissions inline before processing
- Users with only `scraper:trigger_single` cannot trigger all-cinema scrapes (403 error)

### Historical Issues (Now Fixed)

#### Phantom Permissions (Fixed in #442)
**Reference**: GitHub Issue #442  
**Status**: ✅ **FIXED** (Migration 012)  
**Issue**: `cinemas:read` and `users:read` were used in client code but didn't exist in database  
**Solution**: 
- Migration 012 added both permissions to the database
- Added to operator role for workflow consistency
- PermissionName TypeScript type updated to include all 26 permissions

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