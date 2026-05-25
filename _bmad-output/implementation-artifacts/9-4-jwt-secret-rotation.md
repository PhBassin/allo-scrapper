---
story_key: 9-4-jwt-secret-rotation
epic: 9-security-audit-remediation
status: ready-for-dev
created: 2026-05-25
---

# Story 9.4: JWT Secret Rotation Mechanism

**As a** security operator,
**I want** to rotate the JWT signing secret without service interruption,
**So that** compromised or aging secrets can be replaced safely.

---

## Acceptance Criteria

### AC1: Multiple secrets supported for verification
**Given** the env var `JWT_SECRET` contains the current primary secret
**And** the env var `JWT_PREVIOUS_SECRETS` contains a comma-separated list of previous secrets
**When** a request arrives with a token signed by ANY of the configured secrets
**Then** the server accepts the token (backward compatibility)
**And** the server logs which secret was used (index, not value)

### AC2: New tokens always use the current secret
**Given** multiple secrets are configured for verification
**When** a new token is generated (login, refresh, etc.)
**Then** the token is ALWAYS signed with the current `JWT_SECRET`
**And** never signed with a previous secret

### AC3: Clean rotation workflow
**Given** `JWT_SECRET=secret_old`
**When** the operator wants to rotate:
  1. Set `JWT_PREVIOUS_SECRETS=secret_old` and `JWT_SECRET=secret_new`
  2. Deploy (rolling restart or hot-reload)
  3. Wait for all old tokens to expire (max 1h with PR #1075)
  4. Remove `JWT_PREVIOUS_SECRETS`
**Then** no user is logged out during the transition
**And** old tokens are rejected after the grace period

### AC4: No performance regression
**Given** up to 3 previous secrets are configured
**When** a token is verified
**Then** the average verification time increases by < 5ms
**And** tokens signed with the current secret (most common case) are verified on the first attempt

### AC5: Existing auth tests pass
**Given** the multi-secret verification is implemented
**When** the full auth test suite is run
**Then** all existing tests pass
**And** new tests cover multi-secret scenarios

---

## Tasks / Subtasks

### T1: Create JWT secret manager
- **File:** `server/src/utils/jwt-secrets.ts` (NEW)
- **Action:** Create a module that:
  - Reads `JWT_SECRET` (required, validated) and `JWT_PREVIOUS_SECRETS` (optional, comma-separated)
  - Exports `getSecrets(): string[]` — ordered list, current first
  - Exports `getCurrentSecret(): string` — primary signing key
  - Validates all secrets (min 32 chars, no defaults) at startup
- **AC:** AC1

### T2: Update auth middleware to try multiple secrets
- **File:** `server/src/middleware/auth.ts` (line ~33)
- **Current:**
  ```typescript
  const decoded = jwt.verify(token, JWT_SECRET) as { id: number; ... };
  ```
- **Target:**
  ```typescript
  const decoded = verifyWithMultipleSecrets(token, getSecrets()) as { id: number; ... };
  ```
  Where `verifyWithMultipleSecrets` tries each secret and returns the first successful decode, or throws on all failures.
- **AC:** AC1, AC4

### T3: Update JWT generation to always use current secret
- **Files:**
  - `server/src/services/auth-service.ts` — `generateToken()` function
  - `server/src/routes/auth.ts` — refresh endpoint
- **Action:** Ensure all `jwt.sign()` calls use `getCurrentSecret()` (not the old static const)
- **AC:** AC2

### T4: Update rate-limit.ts JWT verification
- **File:** `server/src/middleware/rate-limit.ts` (line 46)
- **Action:** The `authenticatedKeyGenerator` also calls `jwt.verify` — update to use multi-secret verification
- **AC:** AC1

### T5: Add tests
- **File:** `server/src/utils/jwt-secrets.test.ts` (NEW)
  - Parse `JWT_PREVIOUS_SECRETS` correctly (1, 2, 3 secrets)
  - Empty/missing fallback
  - Secret validation (min length, no defaults)
- **File:** `server/src/middleware/auth.test.ts` — add multi-secret verification tests
  - Token signed with current secret → verified
  - Token signed with previous secret → verified
  - Token signed with unknown secret → rejected
  - Performance: first secret hit is fast (try in order)
- **File:** `server/src/services/auth-service.test.ts` — verify new tokens use current secret
- **AC:** AC5

### T6: Update .env.example and documentation
- **File:** `server/.env.example`
- **Action:** Add `JWT_PREVIOUS_SECRETS=` with comment explaining rotation workflow
- **File:** `README.md` or auth docs — document the rotation procedure
- **AC:** AC3

---

## Dev Notes

### Multi-secret verification pattern
```typescript
function verifyWithMultipleSecrets(
  token: string,
  secrets: string[]
): JwtPayload {
  const errors: Error[] = [];
  for (let i = 0; i < secrets.length; i++) {
    try {
      return jwt.verify(token, secrets[i]) as JwtPayload;
    } catch (err) {
      errors.push(err as Error);
      // Continue to next secret only for invalid-signature errors
      if ((err as any).name !== 'JsonWebTokenError') throw err;
    }
  }
  throw errors[0]; // Throw first error if all secrets fail
}
```

### Files currently importing JWT_SECRET directly
| File | Usage |
|------|-------|
| `server/src/middleware/auth.ts:7` | `const JWT_SECRET = validateJWTSecret()` |
| `server/src/middleware/rate-limit.ts:6` | `const JWT_SECRET = validateJWTSecret()` |
| `server/src/services/auth-service.ts:10` | `import { validateJWTSecret }` |
| `server/src/routes/auth.ts:235` | `const { validateJWTSecret } = await import(...)` |

All these need to switch from `validateJWTSecret()` (single) to `getSecrets()` (multi).

### Security considerations
- NEVER log secret values — log the index (1-based) or a hash prefix
- Previous secrets should be removed from `JWT_PREVIOUS_SECRETS` after all old tokens have expired
- With the 1h JWT expiry from PR #1075, the grace period is bounded
- Rate-limit middleware JWT verification is non-critical for security (it's just for key bucketing); failure falls back to IP

---

## Files to Modify

| File | Change |
|------|--------|
| `server/src/utils/jwt-secrets.ts` | **NEW** — multi-secret manager |
| `server/src/middleware/auth.ts` | Use `getSecrets()` + `verifyWithMultipleSecrets()` |
| `server/src/middleware/rate-limit.ts` | Use `getSecrets()` for key generator |
| `server/src/services/auth-service.ts` | Use `getCurrentSecret()` for `jwt.sign()` |
| `server/src/routes/auth.ts` | Use `getCurrentSecret()` for sign; `getSecrets()` for verify |
| `server/src/utils/jwt-secrets.test.ts` | **NEW** — unit tests |
| `server/src/middleware/auth.test.ts` | Multi-secret test cases |
| `server/.env.example` | Add `JWT_PREVIOUS_SECRETS` |
| `README.md` or auth docs | Rotation procedure |

---

## Rollback Strategy

Set `JWT_PREVIOUS_SECRETS=` (empty) and the module falls back to single-secret behavior, identical to current.

---

## References

- Epic: `_bmad-output/planning-artifacts/epics.md` — Epic 9, Story 9.4
- Current JWT secret validator: `server/src/utils/jwt-secret-validator.ts`
- Auth middleware: `server/src/middleware/auth.ts`
- PR #1075: JWT expiry 1h + refresh tokens (completed)
- Audit report in session `20260525_084726_887f109f`

---

## Dev Agent Record

<!-- Filled by dev agent during DS -->
- **Branch:** 
- **Commits:** 
- **PR:** 
- **Test results:** 
- **Deviations:** 
