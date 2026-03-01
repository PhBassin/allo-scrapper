# User Management API

**Admin Only:** All endpoints require admin authentication

The User Management API enables administrators to manage user accounts and roles. All endpoints require admin authentication.

## User Management

### List All Users

```http
GET /api/users
```

**Authentication:** Required (Admin role only)

**Query Parameters:**
- `page` (optional, integer): Page number (default: `1`)
- `pageSize` (optional, integer): Users per page (default: `20`, max: `100`)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "username": "admin",
        "role": "admin",
        "created_at": "2026-01-15T10:00:00.000Z"
      },
      {
        "id": 2,
        "username": "viewer",
        "role": "user",
        "created_at": "2026-02-01T14:30:00.000Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

**Response (403 — not admin):**
```json
{
  "success": false,
  "error": "Forbidden: Admin access required"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# List users
curl "http://localhost:3000/api/users?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Get User by ID

```http
GET /api/users/:id
```

**Authentication:** Required (Admin role only)

**Parameters:**
- `id` (integer): User ID

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "username": "viewer",
    "role": "user",
    "created_at": "2026-02-01T14:30:00.000Z"
  }
}
```

**Response (404 — user not found):**
```json
{
  "success": false,
  "error": "User not found"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Get user by ID
curl http://localhost:3000/api/users/2 \
  -H "Authorization: Bearer $TOKEN"
```

---

### Create New User

```http
POST /api/users
```

**Authentication:** Required (Admin role only)

**Description:** Create a new user account with specified role.

**Request Body:**
```json
{
  "username": "newuser",
  "password": "SecurePass123!",
  "role": "user"
}
```

**Validation Rules:**
- **Username**: 3-50 characters, alphanumeric + underscore/hyphen, unique
- **Password**: Minimum 8 characters (hashed with bcrypt)
- **Role**: Must be either `"admin"` or `"user"`

**Response (201 — created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 3,
      "username": "newuser",
      "role": "user",
      "created_at": "2026-03-01T16:00:00.000Z"
    },
    "message": "User created successfully"
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

**Response (400 — validation error):**
```json
{
  "success": false,
  "error": "Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Create user
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "password": "SecurePass123!",
    "role": "user"
  }'
```

---

### Update User Role

```http
PUT /api/users/:id/role
```

**Authentication:** Required (Admin role only)

**Description:** Change a user's role between `admin` and `user`. Safety guards prevent demoting the last admin.

**Parameters:**
- `id` (integer): User ID

**Request Body:**
```json
{
  "role": "admin"
}
```

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 2,
      "username": "viewer",
      "role": "admin"
    },
    "message": "User role updated successfully"
  }
}
```

**Response (400 — cannot demote last admin):**
```json
{
  "success": false,
  "error": "Cannot change role: at least one admin user must remain"
}
```

**Response (404 — user not found):**
```json
{
  "success": false,
  "error": "User not found"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Promote user to admin
curl -X PUT http://localhost:3000/api/users/2/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

---

### Reset User Password

```http
POST /api/users/:id/reset-password
```

**Authentication:** Required (Admin role only)

**Description:** Generate a new secure random password for a user. Returns the plaintext password (only shown once).

**Parameters:**
- `id` (integer): User ID

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully",
    "new_password": "Xy9mK2pQr4sT"
  }
}
```

**Response (404 — user not found):**
```json
{
  "success": false,
  "error": "User not found"
}
```

**Security Note:** The new password is only returned in this response and is not stored in plaintext. Communicate it securely to the user.

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Reset password
curl -X POST http://localhost:3000/api/users/2/reset-password \
  -H "Authorization: Bearer $TOKEN"

# Response includes new password:
# {"success":true,"data":{"message":"Password reset successfully","new_password":"Xy9mK2pQr4sT"}}
```

---

### Delete User

```http
DELETE /api/users/:id
```

**Authentication:** Required (Admin role only)

**Description:** Delete a user account. Safety guards prevent:
- Deleting the last admin user
- Deleting your own account (self-deletion)

**Parameters:**
- `id` (integer): User ID

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "message": "User deleted successfully"
  }
}
```

**Response (400 — cannot delete last admin):**
```json
{
  "success": false,
  "error": "Cannot delete the last admin user"
}
```

**Response (400 — cannot self-delete):**
```json
{
  "success": false,
  "error": "Cannot delete your own account"
}
```

**Response (404 — user not found):**
```json
{
  "success": false,
  "error": "User not found"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Delete user
curl -X DELETE http://localhost:3000/api/users/3 \
  -H "Authorization: Bearer $TOKEN"
```

---

[← Back to API Reference](./README.md)
