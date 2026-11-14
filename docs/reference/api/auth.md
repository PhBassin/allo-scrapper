# Authentication API

Login, logout, session refresh and password change. Users are created by an administrator with `POST /api/users` (see [User Management API](./users.md)).

Source: `server/src/routes/auth.ts`, `server/src/services/session-service.ts`, `server/src/services/auth-service.ts`. Domain term: see *Session* in [CONTEXT.md](../../../CONTEXT.md).

---

## Table of Contents

- [How authentication works](#how-authentication-works)
- [User Login](#user-login)
- [Refresh Session](#refresh-session)
- [Logout](#logout)
- [Current User](#current-user)
- [Change Password](#change-password)
- [Session lifetime](#session-lifetime)
- [Error Responses](#error-responses)

---

## How authentication works

A successful login sets three cookies:

| Cookie | Content | Flags | Lifetime |
|--------|---------|-------|----------|
| `access_token` | HS256 JWT carrying the user's id, role, permissions and token version | httpOnly, `SameSite=Lax`, path `/` | `JWT_EXPIRES_IN` (default `15m`) |
| `refresh_token` | Opaque token stored in the `refresh_tokens` table | httpOnly, `SameSite=Strict`, path `/api/auth` | `REFRESH_TOKEN_EXPIRY` (default `7d`) |
| `csrf_token` | Random value, readable by JavaScript | `SameSite=Strict`, path `/` | Browser session |

All cookies are `Secure` unless `COOKIE_SECURE=false` (needed for plain-HTTP local setups).

- **Access token.** Sent automatically as the `access_token` cookie. An `Authorization: Bearer <token>` header is also accepted, but the cookie wins when both are present.
- **CSRF.** Every non-GET request under `/api/` must echo the `csrf_token` cookie in an `X-CSRF-Token` header (double-submit cookie pattern), or it is rejected with `403 CSRF token missing or invalid.` This applies to Bearer requests too. Only `login`, `refresh` and `logout` are exempt.

### curl setup

```bash
# Log in and keep the session cookies
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your-password>"}'

# Read the CSRF token for write requests
CSRF=$(awk '$6 == "csrf_token" {print $7}' cookies.txt)
```

Use `-b cookies.txt` on later requests, and add `-H "X-CSRF-Token: $CSRF"` to every write request. If you run over plain HTTP, set `COOKIE_SECURE=false`, otherwise curl will not send the `Secure` cookies back.

**First admin password.** On a fresh database the server creates the `admin` user with a **random password** and prints it once in the server logs. There is no `admin`/`admin` default. Change it after the first login.

---

## User Login

```http
POST /api/auth/login
```

**Rate limit:** `authLimiter` (failed attempts only, see [Rate Limiting](./rate-limiting.md)). No CSRF header needed.

**Request body:** `{ "username": "admin", "password": "<your-password>" }`

**Success (200 OK):** sets the three cookies and returns the token and the user.

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
      "permissions": ["users:list", "users:create", "…"]
    }
  }
}
```

`permissions` lists every permission of the user's role (see [Roles API](./roles.md)).

**Errors:** `400 Username and password are required` · `401 Invalid credentials` · `429`

---

## Refresh Session

```http
POST /api/auth/refresh
```

Uses the `refresh_token` cookie to issue a new access token. The refresh token is **rotated**: the old one is revoked and a new one is set. A new `csrf_token` is set too. Permissions are re-read from the database, so a role change takes effect here. No CSRF header needed.

The web client calls this automatically when a request returns `401`, then retries the request once.

**Success (200 OK):** same body as login (`{ token, user }`) and the same three cookies.

**Errors (401):** `No refresh token provided.` · `Invalid or expired refresh token.` · `User not found.` On these errors the `access_token` and `refresh_token` cookies are cleared.

**Lost race (401, `code: "REFRESH_RACE"`):** a concurrent request rotated the same refresh token less than 30 s ago. The cookies are **not** cleared: the winner's response carries the fresh ones, and the client retries with them. Presenting a rotated token later is treated as a replay: its unused successor is revoked, or every refresh token of the user if that successor was already used. The web client serializes refreshes across tabs with the Web Locks API (lock `auth-refresh`).

```bash
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/refresh
```

---

## Logout

```http
POST /api/auth/logout
```

Revokes the refresh token (if present) and clears all three cookies. Always succeeds; no authentication or CSRF header needed.

**Success (200 OK):** `{ "success": true, "data": { "message": "Logged out successfully" } }`

```bash
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/logout
```

---

## Current User

```http
GET /api/auth/me
```

**Authentication:** required. Used by the client to check that the session is still valid.

**Success (200 OK):** `{ "success": true, "data": { "user": { "id": 1, "username": "admin" } } }`

**Errors:** `401`

```bash
curl -b cookies.txt http://localhost:3000/api/auth/me
```

---

## Change Password

```http
POST /api/auth/change-password
```

**Authentication:** required. **Rate limit:** `authLimiter`.

Changes the current user's password. On success the server **revokes every refresh token of the user** (all devices are logged out) and clears the `access_token` and `refresh_token` cookies, so you must log in again.

**Request body:** `{ "currentPassword": "<current>", "newPassword": "NewSecurePass123!" }`

The new password must meet the [password requirements](./users.md#password-requirements).

**Success (200 OK):** `{ "success": true, "data": { "message": "Password changed successfully" } }`

**Errors:** `400` missing fields or weak password · `401 Current password is incorrect` or no session · `403` missing CSRF token · `429`

```bash
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"currentPassword":"<your-password>","newPassword":"NewSecurePass123!"}'
```

---

## Session lifetime

- **Access token:** `JWT_EXPIRES_IN` (default `15m`; `15m`, `1h`, `3600s` or plain seconds, max `365d`). The JWT `exp` and the `access_token` cookie share this value. The server refuses to start on an invalid value and logs a warning above `1h`.
- **Refresh token:** `REFRESH_TOKEN_EXPIRY` (default `7d`; accepts `<n>d`, `<n>h` or a number of milliseconds). Each refresh replaces it with a new one.
- **Token version.** Each access token carries the user's token version (`ver` claim), checked on every authenticated request. A password change or reset, a role change, or an edit to the user's role (name or permissions) bumps it, and the token is rejected at once with `401 Invalid or expired token.` The web client then refreshes silently, so a role change applies immediately without a new login. A Bearer-only client must log in again.
- **Each device** has its own refresh token. Logout revokes only the current one; a password change or an admin password reset revokes them all. A role change keeps them.

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
| 400 | `Username and password are required` | Missing fields on login |
| 400 | `Current password and new password are required` | Missing fields on change-password |
| 400 | `Password must …` / `This password is too common, choose another one` | Password fails a rule of the [password policy](./users.md#password-requirements) |
| 401 | `Invalid credentials` | Wrong username or password |
| 401 | `Current password is incorrect` | Wrong current password |
| 401 | `Authentication required. No token provided.` | No access token |
| 401 | `Invalid or expired token.` | Bad or expired access token |
| 403 | `CSRF token missing or invalid.` | Write request without a valid `X-CSRF-Token` |
| 403 | `Permission denied` | Missing permission |
| 429 | — | Rate limit exceeded |

---

**See also:**
- [User Management API](./users.md)
- [Roles API](./roles.md)
- [Rate Limiting](./rate-limiting.md)

[← Back to API Reference](./README.md)
