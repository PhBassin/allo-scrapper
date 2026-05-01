## 2026-04-10 - Express 5 path-to-regexp v8 wildcard routes issue
**Vulnerability:** Unsafe string-based catch-all routes (`{*splat}`) in Express 5 cause `TypeError: Missing parameter name` rendering the API 404 handler broken.
**Learning:** This exposes the application to potentially leaking SPA fallback logic (sending HTML) for API endpoints instead of properly formatted JSON 404 responses.
**Prevention:** Always use safe native regular expressions (like `/^\/api(?:\/(.*))?$/`) for wildcard/catch-all routes in Express 5 apps utilizing `path-to-regexp` v8.
## 2026-05-01 - Fix Unhandled jwt.verify Rejections in Rate Limiter
**Vulnerability:** In `server/src/middleware/rate-limit.ts`, `jwt.verify` was used without a `try/catch` block for bucketing authenticated users. Unverified or expired tokens caused synchronous errors (`TokenExpiredError`, `JsonWebTokenError`) that bypassed the application's intended token rejection logic and triggered a 500 Internal Server Error.
**Learning:** `jwt.verify` strictly validates token integrity and throws synchronous exceptions on failure, whereas `jwt.decode` fails silently. When replacing `decode` with `verify` in middlewares or non-terminal route steps, always handle rejection explicitly to prevent DoS via generic unhandled exceptions.
**Prevention:** Always wrap `jwt.verify` in a `try...catch` block. Ensure the catch block continues the request flow predictably, like falling back to an IP-based key generator, rather than crashing the request entirely.
