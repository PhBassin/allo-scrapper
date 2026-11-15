# User Management API

🔒 **Authentication and permissions required.** Every endpoint needs an authenticated session and a specific permission (`users:list`, `users:create`, `users:update` or `users:delete`). The built-in `admin` role has all of them. All endpoints use the protected rate limiter (see [Rate Limiting](./rate-limiting.md)).

Source: `server/src/routes/users.ts`, `server/src/services/user-service.ts`.

---

## Table of Contents

- [Authenticating requests](#authenticating-requests)
- [The user object](#the-user-object)
- [List All Users](#list-all-users)
- [Get User by ID](#get-user-by-id)
- [Create New User](#create-new-user)
- [Update User Role](#update-user-role)
- [Reset User Password](#reset-user-password)
- [Delete User](#delete-user)
- [Password Requirements](#password-requirements)
- [Error Responses](#error-responses)

---

## Authenticating requests

Authentication is cookie-based. `POST /api/auth/login` sets an `access_token` cookie (a `Authorization: Bearer <token>` header is also accepted) and a `csrf_token` cookie. Every non-GET request must echo that CSRF token in an `X-CSRF-Token` header (double-submit cookie pattern), otherwise it is rejected with `403`.

```bash
# Log in and keep the session cookies
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your-password>"}'

# Read the CSRF token for write requests
CSRF=$(awk '$6 == "csrf_token" {print $7}' cookies.txt)
```

The examples below reuse `cookies.txt` and `$CSRF`. Roles are referenced by numeric `role_id`; list them with `GET /api/roles` (see [Roles API](./roles.md)).

---

## The user object

```json
{
  "id": 3,
  "username": "newuser",
  "role_id": 2,
  "role_name": "operator",
  "created_at": "2026-03-04T16:00:00.000Z"
}
```

Password hashes are never returned.

---

## List All Users

```http
GET /api/users
```

**Permission:** `users:list`

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 100 | Number of users to return (1–100; larger values are clamped to 100) |
| `offset` | integer | 0 | Number of users to skip |

### Response

**Success (200 OK):** `{ "success": true, "data": [ <user>, … ] }`

**Errors:** `400` invalid `limit` or `offset` · `401` · `403` · `429`

### Example

```bash
curl -b cookies.txt "http://localhost:3000/api/users?limit=50&offset=0"
```

---

## Get User by ID

```http
GET /api/users/:id
```

**Permission:** `users:list`

**Success (200 OK):** `{ "success": true, "data": <user> }`

**Errors:** `400` invalid user ID · `401` · `403` · `404` user not found · `429`

```bash
curl -b cookies.txt http://localhost:3000/api/users/3
```

---

## Create New User

```http
POST /api/users
```

**Permission:** `users:create`

### Request Body

```json
{
  "username": "newuser",
  "password": "SecurePass123!",
  "role_id": 2
}
```

| Field | Requirements |
|-------|-------------|
| `username` | Required. 3–15 characters, letters and digits only (`a-z`, `A-Z`, `0-9`), unique |
| `password` | Required. See [Password Requirements](#password-requirements) |
| `role_id` | Required. Integer ID of an existing role |

**Success (201 Created):** `{ "success": true, "data": <user> }`

**Errors:** `400` missing fields, invalid username, weak password, invalid or unknown `role_id`, or username already taken · `401` · `403` · `429`

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"username":"newuser","password":"SecurePass123!","role_id":2}'
```

---

## Update User Role

```http
PUT /api/users/:id/role
```

**Permission:** `users:update`

**Request body:** `{ "role_id": 1 }`

Demoting the **last** user with the `admin` role is refused, so at least one admin always remains.

The change applies at once: the user's current access token is rejected (token version bumped), and the web client refreshes it silently into the new role. Their sessions are kept. Re-assigning the current role is a no-op.

**Success (200 OK):** `{ "success": true, "data": <updated user> }`

**Errors:** `400` invalid user ID or unknown `role_id` · `401` · `403` missing permission, or last admin demotion · `404` · `429`

```bash
curl -b cookies.txt -X PUT http://localhost:3000/api/users/3/role \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"role_id":1}'
```

---

## Reset User Password

```http
POST /api/users/:id/reset-password
```

**Permission:** `users:update`

The administrator chooses the new password and submits it; the server validates its strength and stores a fresh hash. All of the user's sessions end at once: their current access token is rejected and every refresh token is revoked, so they must log in again.

**Request body:** `{ "newPassword": "NewSecurePass456!" }`

**Success (200 OK):** `{ "success": true, "data": { "user": <user> } }`

**Errors:** `400` invalid user ID, missing or weak password · `401` · `403` · `404` · `429`

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/users/3/reset-password \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"newPassword":"NewSecurePass456!"}'
```

---

## Delete User

```http
DELETE /api/users/:id
```

**Permission:** `users:delete`

Two safety guards apply: you cannot delete your own account, and you cannot delete the last user with the `admin` role.

**Success (204 No Content):** empty body.

**Errors:** `400` invalid user ID · `401` · `403` missing permission, self-deletion or last admin · `404` · `429`

```bash
curl -b cookies.txt -X DELETE http://localhost:3000/api/users/3 \
  -H "X-CSRF-Token: $CSRF"
```

---

## Password Requirements

Enforced by `validatePasswordStrength` (`server/src/utils/security.ts`) on every password entry point:

- at least **8 characters**
- at least one **uppercase** letter
- at least one **lowercase** letter
- at least one **digit**
- at least one **special character** (anything other than a letter or digit)

**Valid:** `SecurePass123!`, `MyP@ssw0rd`

**Invalid:** `password` (no uppercase, digit or special character), `PASSWORD123` (no lowercase or special character), `Pass123` (too short, no special character)

---

## Error Responses

All errors share this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

| Status | Error message | Cause |
|--------|---------------|-------|
| 400 | `Username and password are required` | Missing fields |
| 400 | `Username must be alphanumeric and 3-15 characters long` | Invalid username |
| 400 | `Password must …` | Password fails a strength rule |
| 400 | `role_id is required and must be a valid integer` | Missing or non-integer `role_id` |
| 400 | `Invalid role_id: role does not exist` | Unknown role |
| 400 | `Username already exists` | Duplicate username |
| 400 | `New password is required` | Missing `newPassword` |
| 400 | `Invalid user ID` | Non-numeric ID |
| 400 | `Invalid limit parameter` / `Invalid offset parameter` | Bad pagination |
| 401 | — | Missing or invalid session |
| 403 | `Permission denied` | Missing permission |
| 403 | `CSRF token missing or invalid.` | Write request without a valid `X-CSRF-Token` |
| 403 | `Cannot demote the last admin user` | Last-admin guard |
| 403 | `Cannot delete the last admin user` | Last-admin guard |
| 403 | `Cannot delete your own account` | Self-deletion |
| 404 | `User not found` | Unknown user ID |
| 429 | — | Rate limit exceeded |

---

**See also:**
- [Authentication API](./auth.md)
- [Roles API](./roles.md)
- [Rate Limiting](./rate-limiting.md)
- [User Management Guide](../../guides/administration/user-management.md)
