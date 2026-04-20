## 2026-04-10 - Express 5 path-to-regexp v8 wildcard routes issue
**Vulnerability:** Unsafe string-based catch-all routes (`{*splat}`) in Express 5 cause `TypeError: Missing parameter name` rendering the API 404 handler broken.
**Learning:** This exposes the application to potentially leaking SPA fallback logic (sending HTML) for API endpoints instead of properly formatted JSON 404 responses.
**Prevention:** Always use safe native regular expressions (like `/^\/api(?:\/(.*))?$/`) for wildcard/catch-all routes in Express 5 apps utilizing `path-to-regexp` v8.

## 2026-04-20 - JWT Validation missing on user bucketing ID extract
**Vulnerability:** In `server/src/middleware/rate-limit.ts`, `jwt.decode` was used to extract the user `id` from the JWT without validating its signature to bucket authentication requests. Since `jwt.decode` doesn't enforce signatures, an attacker could spoof the user ID by creating an invalid JWT token. This allows an attacker to exhaust the rate limit quotas of specific targeted users, bypassing typical rate-limit security.
**Learning:** Even though full token verification occurs downstream in standard authentication middlewares, any operations that rely on the token content for logic—like determining the rate limit bucket—must verify the signature using `jwt.verify(token, JWT_SECRET)`.
**Prevention:** Whenever using JWT payload data to control server logic (like user ID extraction for rate limiting), always ensure the token is fully verified with the secret key using `jwt.verify()`, and not just read blindly with `jwt.decode()`.
