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
      "role": "admin"
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

**Last updated:** March 4, 2026

[← Back to API Reference](./README.md)
