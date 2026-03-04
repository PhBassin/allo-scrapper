# User Management API

🔒 **Admin Only:** All endpoints require admin authentication

The User Management API enables administrators to manage user accounts and roles. All endpoints require admin authentication and are rate-limited.

**Last updated:** March 4, 2026

---

## Table of Contents

- [List All Users](#list-all-users)
- [Get User by ID](#get-user-by-id)
- [Create New User](#create-new-user)
- [Update User Role](#update-user-role)
- [Reset User Password](#reset-user-password)
- [Delete User](#delete-user)
- [Password Requirements](#password-requirements)
- [Error Responses](#error-responses)

---

## List All Users

```http
GET /api/users
```

🔒 **Authentication:** Required (Admin role only)  
**Rate Limit:** 100 requests/15 minutes

Retrieve all users with pagination support.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | No | `100` | Maximum number of users to return |
| `offset` | integer | No | `0` | Number of users to skip |

### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
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
  ]
}
```

**Errors:**
- `400 Bad Request`: Invalid limit or offset parameter
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Admin access required
- `429 Too Many Requests`: Rate limit exceeded

### Example

```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# List first 50 users
curl "http://localhost:3000/api/users?limit=50&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Get User by ID

```http
GET /api/users/:id
```

🔒 **Authentication:** Required (Admin role only)  
**Rate Limit:** 100 requests/15 minutes

Retrieve a specific user by their ID.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | User ID |

### Response

**Success (200 OK):**
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

**Errors:**
- `400 Bad Request`: Invalid user ID
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Admin access required
- `404 Not Found`: User not found
- `429 Too Many Requests`: Rate limit exceeded

### Example

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

## Create New User

```http
POST /api/users
```

🔒 **Authentication:** Required (Admin role only)  
**Rate Limit:** 100 requests/15 minutes

Create a new user account with specified role.

### Request Body

```json
{
  "username": "newuser",
  "password": "SecurePass123!",
  "role": "user"
}
```

### Validation Rules

| Field | Requirements |
|-------|-------------|
| **username** | 3-15 characters, alphanumeric only (a-z, A-Z, 0-9), unique |
| **password** | See [Password Requirements](#password-requirements) |
| **role** | Must be either `"admin"` or `"user"` (defaults to `"user"`) |

### Response

**Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "username": "newuser",
    "role": "user",
    "created_at": "2026-03-04T16:00:00.000Z"
  }
}
```

**Errors:**
- `400 Bad Request`: Missing required fields, invalid username format, weak password, or invalid role
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Admin access required
- `409 Conflict`: Username already exists
- `429 Too Many Requests`: Rate limit exceeded

### Example

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

## Update User Role

```http
PUT /api/users/:id/role
```

🔒 **Authentication:** Required (Admin role only)  
**Rate Limit:** 100 requests/15 minutes

Change a user's role between `admin` and `user`. Safety guards prevent demoting the last admin.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | User ID |

### Request Body

```json
{
  "role": "admin"
}
```

### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "username": "viewer",
    "role": "admin",
    "created_at": "2026-02-01T14:30:00.000Z"
  }
}
```

**Errors:**
- `400 Bad Request`: Invalid user ID or role
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Admin access required, or cannot demote the last admin user
- `404 Not Found`: User not found
- `429 Too Many Requests`: Rate limit exceeded

### Example

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

## Reset User Password

```http
POST /api/users/:id/reset-password
```

🔒 **Authentication:** Required (Admin role only)  
**Rate Limit:** 100 requests/15 minutes

Generate a new secure random password for a user. Returns the plaintext password (only shown once).

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | User ID |

### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 2,
      "username": "viewer",
      "role": "user",
      "created_at": "2026-02-01T14:30:00.000Z"
    },
    "newPassword": "Xy9mK2pQr4sT"
  }
}
```

**Errors:**
- `400 Bad Request`: Invalid user ID
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Admin access required
- `404 Not Found`: User not found
- `429 Too Many Requests`: Rate limit exceeded

**Security Note:** The new password is only returned in this response and is not stored in plaintext. Communicate it securely to the user.

### Example

```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Reset password
curl -X POST http://localhost:3000/api/users/2/reset-password \
  -H "Authorization: Bearer $TOKEN"

# Response includes new password:
# {"success":true,"data":{"user":{...},"newPassword":"Xy9mK2pQr4sT"}}
```

---

## Delete User

```http
DELETE /api/users/:id
```

🔒 **Authentication:** Required (Admin role only)  
**Rate Limit:** 100 requests/15 minutes

Delete a user account. Safety guards prevent:
- Deleting the last admin user
- Deleting your own account (self-deletion)

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | User ID |

### Response

**Success (204 No Content):**
Empty response body.

**Errors:**
- `400 Bad Request`: Invalid user ID
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Admin access required, cannot delete the last admin user, or cannot delete your own account
- `404 Not Found`: User not found
- `429 Too Many Requests`: Rate limit exceeded

### Example

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

## Password Requirements

All passwords must meet these security requirements:

- **Minimum length:** 8 characters
- **Uppercase letter:** At least one (A-Z)
- **Lowercase letter:** At least one (a-z)
- **Digit:** At least one (0-9)
- **Special character:** At least one (any non-alphanumeric character)

**Valid examples:**
- `SecurePass123!`
- `MyP@ssw0rd`
- `Admin2024#`

**Invalid examples:**
- `password` (no uppercase, digit, or special character)
- `PASSWORD123` (no lowercase or special character)
- `Pass123` (too short, no special character)

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common Error Messages

| Status | Error Message | Cause |
|--------|---------------|-------|
| 400 | `"Username and password are required"` | Missing required fields |
| 400 | `"Username must be alphanumeric and 3-15 characters long"` | Invalid username format |
| 400 | `"Password must be at least 8 characters"` | Password too short |
| 400 | `"Password must contain at least one uppercase letter"` | Missing uppercase |
| 400 | `"Password must contain at least one lowercase letter"` | Missing lowercase |
| 400 | `"Password must contain at least one digit"` | Missing number |
| 400 | `"Password must contain at least one special character"` | Missing special character |
| 400 | `"Invalid role. Must be \"admin\" or \"user\""` | Invalid role value |
| 400 | `"Invalid user ID"` | Non-numeric user ID |
| 400 | `"Invalid limit parameter"` | Invalid limit value |
| 400 | `"Invalid offset parameter"` | Invalid offset value |
| 401 | `"Unauthorized"` | Missing or invalid JWT token |
| 403 | `"Forbidden: Admin access required"` | Non-admin user |
| 403 | `"Cannot demote the last admin user"` | Safety guard violation |
| 403 | `"Cannot delete the last admin user"` | Safety guard violation |
| 403 | `"Cannot delete your own account"` | Self-deletion attempt |
| 404 | `"User not found"` | User ID doesn't exist |
| 409 | `"Username already exists"` | Duplicate username |
| 429 | `"Too Many Requests"` | Rate limit exceeded |

---

**See also:**
- [Authentication API](./auth.md)
- [Rate Limiting](../architecture/rate-limiting.md)
- [Admin Panel Guide](../../guides/administration/user-management.md)

[← Back to API Reference](./README.md)