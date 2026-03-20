# Sentinel's Journal

## 2026-02-18 - API Error Leakage
**Vulnerability:** Consistent pattern of manually catching errors in route handlers and sending `res.status(500).json({ error: error.message })`. This exposed internal error details (e.g., database errors) to clients.
**Learning:** Developers likely copied this pattern from one route to another without considering `NODE_ENV` or leveraging the global error handler.
**Prevention:** Enforce use of `next(error)` for unexpected errors in route handlers. Ensure global error handler is configured to sanitize errors in production.

## 2026-03-05 - Safe Error Response Handlers
**Vulnerability:** Uncaught application errors in `/api/reports` and `/api/scraper` endpoints were exposing `error.message` directly in JSON responses, which could leak internal path structures, stack traces, or DB error semantics depending on the thrown error.
**Learning:** While Express has a generic error handler, some routes explicitly managed the response payload and naively embedded `error.message`. Refactoring them to delegate to `next(error)` caused an API contract breakage by returning HTML default responses instead of expected JSON.
**Prevention:** Avoid embedding `error.message` inside manually constructed JSON HTTP 500 responses unless the error strictly originates from known safe validation constraints. For unknown exceptions, manually log the context using `logger.error` and emit a static, sanitized error string like `'Failed to fetch reports'` to satisfy the `ApiResponse` schema safely.
## 2025-02-17 - Biased Password Shuffling using Array.prototype.sort
**Vulnerability:** Weak shuffling of generated passwords using `Array.prototype.sort(() => crypto.randomInt(0, 2) - 0.5)`. This introduces bias, leading to an uneven distribution of characters where the first 4 specific characters (Uppercase, Lowercase, Digit, Special) might remain in predictable positions, reducing the password's entropy and strength.
**Learning:** `Array.prototype.sort()` is designed for sorting, not shuffling. Its implementation (often TimSort or QuickSort) makes it non-uniform for shuffling, even with a cryptographically secure random number generator in the comparison function.
**Prevention:** Use a cryptographically secure algorithm like Fisher-Yates shuffle combined with a secure random number generator (e.g., `crypto.randomInt`) for security-sensitive shuffling tasks such as password generation.
## 2026-03-11 - [Add input length limits for users pagination]
**Vulnerability:** The `limit` query parameter on `GET /api/users` lacked an upper bound.
**Learning:** This exposes the application to Denial of Service (DoS) attacks if a malicious user requests millions of records, causing high memory and DB strain.
**Prevention:** Always validate and safely clamp all unbounded inputs related to database pagination arrays/limits (e.g., max 100 limits).

## 2024-03-18 - Missing Password Strength Validation on Registration
**Vulnerability:** The registration endpoint (`POST /api/auth/register`) accepted any password (even a single character), bypassing the application's intended password strength requirements.
**Learning:** The password strength validation logic was centralized in `server/src/utils/security.ts` (`validatePasswordStrength`), but it was only being called during password changes and user creation by admins, not during self-registration. This left a significant gap in the application's defense in depth strategy for user authentication.
**Prevention:** Ensure that all endpoints that accept new passwords (registration, password reset, password change, admin user creation) consistently utilize the centralized `validatePasswordStrength` utility before processing the request.
## 2024-03-20 - [Fix API 404 Endpoint Handler Security]
**Vulnerability:** API 404 endpoints were using an invalid wildcard format (`app.use('/api/{*splat}', ...)`), bypassing the API 404 handler and exposing the fallback SPA index.html to unhandled API routes. This leak could bypass intended REST JSON contracts, potentially exposing SPA layout logic to malicious API scanners, or breaking clients relying strictly on structured JSON errors for undocumented endpoints.
**Learning:** `express` 5 handles wildcards differently depending on `path-to-regexp` v8. The `{...}` syntax and `*` alone failed, preventing correct route mapping.
**Prevention:** Always use prefix matching (`app.use('/api', ...)` instead of `app.use('/api/*', ...)` or `app.use('/api/{*splat}')`) for generic catch-all subpath handlers to cleanly trap unhandled requests under an API prefix without risking regex parsing mismatches.
