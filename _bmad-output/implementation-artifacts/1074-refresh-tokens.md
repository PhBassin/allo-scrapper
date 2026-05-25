---
story_key: 1074-refresh-tokens
epic: security-hardening
status: ready-for-dev
created: 2026-05-25
---

# Story: Refresh Token + CSRF Protection

**As a** security-conscious operator,
**I want** refresh tokens with short-lived access tokens and CSRF protection,
**So that** stolen JWTs have a limited window of exploitation and sessions can be revoked server-side.

---

## Acceptance Criteria

### AC1: Refresh token issued on login
**Given** a user logs in successfully via `POST /api/auth/login`
**When** the server generates the JWT access token
**Then** the server also generates a refresh token, stores it in the DB, and sets it as an httpOnly cookie named `refresh_token`
**And** the response body still returns `{ token, user }` (unchanged contract)

### AC2: Token refresh endpoint
**Given** a user has a valid refresh token cookie
**When** they call `POST /api/auth/refresh`
**Then** the server validates the refresh token, revokes the old one, generates a new access token + new refresh token (rotation)
**And** returns `{ token, user }` in the response body
**And** sets a new `refresh_token` cookie

### AC3: Expired/invalid refresh token
**Given** a refresh token is expired, revoked, or invalid
**When** the user calls `POST /api/auth/refresh`
**Then** the server returns `401` with error message
**And** clears the refresh token cookie

### AC4: Logout revokes refresh token
**Given** a user is authenticated
**When** they call `POST /api/auth/logout`
**Then** the server revokes the refresh token in the DB
**And** clears the refresh token cookie
**And** returns `200 { success: true }`

### AC5: CSRF protection for mutation endpoints
**Given** cookie-based auth is in use
**When** any `POST/PUT/DELETE` request is made to `/api/*`
**Then** a CSRF token check is performed (double-submit cookie pattern)
**And** requests without a valid CSRF token receive `403`

### AC6: Client auto-refresh on 401
**Given** a user's access token has expired (1h)
**When** the API client receives a `401` response
**Then** it silently attempts `POST /api/auth/refresh`
**And** on success, retries the original request with the new access token
**And** on failure, dispatches `auth:unauthorized` → redirect to login

### AC7: Backward compatibility
**Given** existing clients that don't use cookies
**When** they send `Authorization: Bearer <token>` header
**Then** the `requireAuth` middleware still works (reads header first, falls back to cookie)

---

## Technical Design

### Database

```sql
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
```

### Backend

| File | Change | Concern |
|---|---|---|
| `server/src/db/migrations/025_add_refresh_tokens.sql` | NEW | Migration |
| `server/src/services/refresh-token-service.ts` | NEW | Generate/store/validate/revoke |
| `server/src/routes/auth.ts` | MODIFY | Add `/refresh`, `/logout`, set cookie on login |
| `server/src/middleware/auth.ts` | MODIFY | Read token from cookie fallback |
| `server/src/app.ts` | MODIFY | Add `cookieParser`, inline CSRF middleware |
| `server/package.json` | MODIFY | Add `cookie-parser`, `uuid` deps |
| `.env.example` | MODIFY | Add `REFRESH_TOKEN_EXPIRY=7d` |

### Frontend

| File | Change | Concern |
|---|---|---|
| `client/src/api/client.ts` | MODIFY | Add `credentials: 'include'`, 401 → refresh → retry interceptor |
| `client/src/contexts/AuthProvider.tsx` | MODIFY | `logout()` calls `/api/auth/logout` |
| `client/src/pages/LoginPage.tsx` | MODIFY | `credentials: 'include'` on login request |

---

## Tasks / Subtasks

### T1: Database migration (AC: table exists)
- [ ] Create `025_add_refresh_tokens.sql`
- [ ] Create `025_revert_add_refresh_tokens.sql` (rollback)
- [ ] Verify: migration runs, rollback works

### T2: Refresh token service (AC1, AC2, AC3, AC4)
- [ ] `RefreshTokenService` class with methods:
  - `generate(userId)` → creates token, returns token + hash
  - `validate(token)` → looks up hash, checks expiry/revocation
  - `revoke(token)` → sets revoked_at
  - `revokeAllForUser(userId)` → bulk revoke
- [ ] Unit tests for all paths

### T3: Auth routes update (AC1, AC2, AC3, AC4)
- [ ] `POST /api/auth/refresh` endpoint
- [ ] `POST /api/auth/logout` endpoint
- [ ] Modify login to set refresh token cookie
- [ ] Integration tests

### T4: CSRF protection (AC5)
- [ ] Install `cookie-parser`
- [ ] Add inline CSRF check in `app.ts`
- [ ] CSRF token set on login (as non-httpOnly cookie)
- [ ] Verify CodeQL doesn't flag `js/missing-csrf-protection`

### T5: Auth middleware update (AC7)
- [ ] `requireAuth` reads from cookie if no Bearer header
- [ ] Existing tests still pass

### T6: Client 401 refresh interceptor (AC6)
- [ ] `fetchClient` catches 401 → calls refresh → retries
- [ ] Dedup: only one refresh at a time
- [ ] On refresh failure → dispatch `auth:unauthorized`

### T7: Client logout (AC4)
- [ ] `AuthProvider.logout()` calls `POST /api/auth/logout` with CSRF header
- [ ] Clear local state

---

## Dev Notes

### Cookie configuration
```typescript
// Refresh token (httpOnly)
res.cookie('refresh_token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',  // Only sent to auth endpoints
});

// CSRF token (readable by JS)
res.cookie('csrf_token', csrfToken, {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
});
```

### Refresh token rotation
Every refresh call generates a NEW refresh token and revokes the old one. This prevents replay attacks.

### Token format
Refresh token = `crypto.randomBytes(48).toString('base64url')` — 64-char opaque string.
Stored as SHA-256 hash in DB (never store raw token).

### CSRF pattern
Double-submit cookie: server sets `csrf_token` cookie (httpOnly: false), client reads it and sends as `X-CSRF-Token` header. Server compares cookie value with header value.

### CORS
Already has `credentials: true`. Add `X-CSRF-Token` to `allowedHeaders`.

---

## Rollback Strategy
- Revert migration: `025_revert_add_refresh_tokens.sql`
- Remove `cookie-parser` from deps
- Existing Bearer token flow continues to work

---

## References
- `server/src/services/auth-service.ts` — current login logic
- `server/src/middleware/auth.ts` — current auth middleware  
- `server/src/routes/auth.ts` — current auth routes
- `client/src/api/client.ts` — current API client
- `client/src/contexts/AuthProvider.tsx` — current auth state
- `server/src/app.ts` — middleware chain
- Issue: [#1074](https://github.com/PhBassin/allo-scrapper/issues/1074)
- PR: [#1075](https://github.com/PhBassin/allo-scrapper/pull/1075)
