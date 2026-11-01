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
        "theaters:create",
        "theaters:update",
        "theaters:delete",
        "theaters:read",
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

- **Default**: 15 minutes from issue time
- **Cookie**: the `access_token` cookie `maxAge` is derived from the same value, so the cookie never outlives the JWT
- **Configuration**: Set via `JWT_EXPIRES_IN` environment variable
- **Format**: Any valid `jsonwebtoken` duration string (e.g., `1h`, `7d`, `30m`)
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Silent renewal**: on a 401 the client calls `POST /api/auth/refresh` (refresh-token cookie) and retries, so expiry is invisible to the user

**Example Configuration:**
```env
JWT_EXPIRES_IN=15m  # Default: 15 minutes
JWT_EXPIRES_IN=30m  # Alternative: 30 minutes
JWT_EXPIRES_IN=1h   # Alternative: 1 hour
```

### Client-Side Behavior

The React client renews the access token silently (`client/src/api/core.ts`):

1. **On a 401**: the client calls `POST /api/auth/refresh` with the refresh-token cookie, then retries the original request once.
2. **Across tabs**: refreshes are serialized with the Web Locks API (lock `auth-refresh`), so tabs sharing one cookie jar never present the same refresh token twice.
3. **Lost race**: a `401` with `code: "REFRESH_RACE"` means a concurrent request already rotated the token; the server leaves the cookies alone and the client just retries.
4. **Session end**: only when the refresh itself fails (refresh token expired or revoked) is the user sent to the login page, which shows "Votre session a expiré. Veuillez vous reconnecter."

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
