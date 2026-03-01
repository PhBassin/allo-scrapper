# Security Enhancements & Issues

## Issue 1: Missing Session Invalidation on Password Change

**Severity:** Medium
**Vulnerability:** JWT tokens are stateless and rely solely on the signature and expiration time. When a user changes their password via `POST /api/auth/change-password` or an admin resets it via `POST /api/users/:id/reset-password`, existing active JWTs for that user remain valid until they expire (up to 24 hours).
**Impact:** If an attacker compromises an active session token, the legitimate user changing their password will not revoke the attacker's access immediately.
**Fix Recommendation:** Implement a `token_version` or `last_password_change` timestamp on the `users` table. Include the `token_version` in the JWT payload. Upon verifying the JWT in the `requireAuth` middleware, check that the token was issued *after* the `last_password_change` or that the versions match.

## Issue 2: Unsafe URLs in App Settings Footer Links (Stored XSS)

**Severity:** High (requires Admin access)
**Vulnerability:** The `PUT /api/settings` endpoint does not validate the protocol of the URLs provided in `footer_links`.
**Impact:** A malicious or compromised admin could insert a `javascript:...` URI into a footer link. When regular users click these links in the public-facing application, the payload will execute in the context of their browser, leading to Stored XSS.
**Fix Recommendation:** Add server-side validation in `server/src/routes/settings.ts` to ensure that all `url` properties in `footer_links` begin with safe protocols (`http://` or `https://`) or are valid relative paths.

## Issue 3: Code Duplication in Password Validation Rules

**Severity:** Enhancement / Low
**Vulnerability:** The rules governing password strength (8+ chars, uppercase, lowercase, digit, special character) are duplicated in `server/src/routes/auth.ts` (using Regex) and `server/src/routes/users.ts` (using manual checks).
**Impact:** Inconsistent enforcement of password rules. If password policies need to be updated in the future, developers might only update one location, leaving the other weaker.
**Fix Recommendation:** Extract password validation into a centralized utility function (e.g., `validatePasswordStrength`) in `server/src/utils/security.ts` and use it uniformly across all authentication and user management endpoints.
