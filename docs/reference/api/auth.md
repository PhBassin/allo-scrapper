# Authentication API

## Authentication Endpoints

### User Login

```http
POST /api/auth/login
```

**Description:** Authenticate a user and receive a JWT token for accessing protected endpoints.

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin"
}
```

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "role_id": 1,
      "role_name": "admin",
      "is_system_role": true,
      "permissions": [
        "users:list",
        "users:create",
        "users:update",
        "users:delete",
        "users:read",
        "scraper:trigger",
        "scraper:trigger_single",
        "cinemas:create",
        "cinemas:update",
        "cinemas:delete",
        "cinemas:read",
        "settings:read",
        "settings:update",
        "settings:reset",
        "settings:export",
        "settings:import",
        "reports:list",
        "reports:view",
        "system:info",
        "system:health",
        "system:migrations",
        "roles:list",
        "roles:read",
        "roles:create",
        "roles:update",
        "roles:delete"
      ]
    }
  }
}
```

**Response (401 — invalid credentials):**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**Response (400 — missing fields):**
```json
{
  "success": false,
  "error": "Username and password are required"
}
```

**Example:**
```bash
# Login and save token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Use token for protected endpoints
curl http://localhost:3000/api/reports \
  -H "Authorization: Bearer $TOKEN"
```

**Note:** The default admin account is created automatically on first database initialization with username `admin` and password `admin`. **Change this password in production.**

---

### Register New User

```http
POST /api/auth/register
```

**Authentication:** Required (Bearer token)  
**Role:** Admin only

**Description:** Create a new user account. Only administrators can register new users.

**Request Body:**
```json
{
  "username": "newuser",
  "password": "securepassword"
}
```

**Response (201 — created):**
```json
{
  "success": true,
  "data": {
    "message": "User registered successfully",
    "user": {
      "id": 2,
      "username": "newuser",
      "role": "user"
    }
  }
}
```

**Response (409 — username exists):**
```json
{
  "success": false,
  "error": "Username already exists"
}
```

**Response (401 — unauthorized):**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**Response (403 — not admin):**
```json
{
  "success": false,
  "error": "Admin access required"
}
```

**Example:**
```bash
# Get admin token first
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Register new user (admin only)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","password":"securepass123"}'
```

---

### Change Password

```http
POST /api/auth/change-password
```

**Authentication:** Required (Bearer token)

**Description:** Change the password for the currently authenticated user. Requires the current password for verification.

**Request Body:**
```json
{
  "currentPassword": "current_password",
  "newPassword": "new_secure_password"
}
```

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  }
}
```

**Response (401 — invalid current password):**
```json
{
  "success": false,
  "error": "Current password is incorrect"
}
```

**Response (400 — missing fields):**
```json
{
  "success": false,
  "error": "Current password and new password are required"
}
```

**Response (401 — unauthorized, no token):**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**Example:**
```bash
# Get auth token first
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Change password
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"admin","newPassword":"NewSecurePass123!"}'

# Verify new password works (should succeed)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"NewSecurePass123!"}'
```

**Security Notes:**
- Requires valid JWT token (must be logged in)
- Current password must be provided (prevents unauthorized password changes if session is hijacked)
- Failed password change attempts count toward rate limiting
- Password is hashed with bcrypt before storage (never stored in plaintext)

---

## Session Expiry Behavior

### JWT Token Expiry

All JWT tokens issued by the `/api/auth/login` endpoint have a configurable expiration time:

- **Default**: 24 hours from issue time
- **Configuration**: Set via `JWT_EXPIRES_IN` environment variable
- **Format**: Any valid `jsonwebtoken` duration string (e.g., `24h`, `7d`, `30m`)
- **Algorithm**: HS256 (HMAC with SHA-256)
- **No Refresh Tokens**: Users must re-login after expiry

**Example Configuration:**
```env
JWT_EXPIRES_IN=24h  # Default: 24 hours
JWT_EXPIRES_IN=7d   # Alternative: 7 days
JWT_EXPIRES_IN=30m  # Alternative: 30 minutes
```

### Client-Side Behavior

The React client implements **proactive token expiry handling**:

1. **At Login**: Client decodes JWT to extract `exp` (expiry timestamp)
2. **Timer Set**: `setTimeout` scheduled to fire exactly when token expires
3. **Auto-Logout**: When timer fires, user is automatically logged out
4. **User Feedback**: Login page shows "Votre session a expiré. Veuillez vous reconnecter."
5. **No Surprise Errors**: Users never encounter 401 errors from expired tokens

**Benefits:**
- Seamless UX with clear session expiry messaging
- No failed API requests due to expired tokens
- Consistent behavior across all browser tabs (via localStorage events)

### Server-Side Validation

All protected endpoints validate JWT tokens:

**401 Response on Expired Token:**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**Note**: In practice, users rarely see this error because the client proactively logs them out before tokens expire. This 401 response typically only occurs if:
- User manually manipulates localStorage
- System clock skew between client and server
- User has multiple tabs with different token states

### Permission Updates Require Re-login

**Important**: Permissions are baked into the JWT at login time. If a user's role or permissions change:
- Changes do NOT take effect until user re-logs in
- Old token remains valid with old permissions until expiry
- User must logout and login again to receive updated permissions in new JWT

**Example Scenario:**
```
1. User logs in as 'operator' → JWT contains 9 operator permissions
2. Admin promotes user to 'admin' role (26 permissions)
3. User still has 9 permissions until they re-login
4. User must logout and login to receive new JWT with 26 admin permissions
```

See [Roles and Permissions Reference](./roles-and-permissions.md) for complete RBAC documentation.

---

**Last updated:** March 15, 2026

[← Back to API Reference](./README.md)
