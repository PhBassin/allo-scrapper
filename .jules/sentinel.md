## 2026-04-10 - Express 5 path-to-regexp v8 wildcard routes issue
**Vulnerability:** Unsafe string-based catch-all routes (`{*splat}`) in Express 5 cause `TypeError: Missing parameter name` rendering the API 404 handler broken.
**Learning:** This exposes the application to potentially leaking SPA fallback logic (sending HTML) for API endpoints instead of properly formatted JSON 404 responses.
**Prevention:** Always use safe native regular expressions (like `/^\/api(?:\/(.*))?$/`) for wildcard/catch-all routes in Express 5 apps utilizing `path-to-regexp` v8.

## 2026-04-26 - Critical Security Fix in Rate Limiter using jwt.decode
**Vulnerability:** The rate limit middleware used `jwt.decode()` instead of `jwt.verify()` when extracting user details to build rate limiting keys. `jwt.decode()` does not cryptographically verify the JWT signature.
**Learning:** This implementation allowed attackers to craft unverified tokens with spoofed `id` and `username` payloads. The system trusted these spoofed values, allowing targeted Denial of Service (DoS) attacks via rate-limit exhaustion against specific users/organizations. It also allowed an attacker to completely bypass rate limits by generating unique `id` values on every request.
**Prevention:** Always use `jwt.verify()` when reading JWTs for security decisions (like identity tracking and rate limiting). Additionally, when fixing this, the validation must be wrapped in a `try...catch` block. Failing to catch validation errors (e.g., `TokenExpiredError`, `JsonWebTokenError`) leads to unhandled exceptions and 500 status codes, creating a new application-level DoS risk. Finally, ensure secrets are lazily evaluated in middleware to support mocking in tests.
