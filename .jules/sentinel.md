## 2026-04-10 - Express 5 path-to-regexp v8 wildcard routes issue
**Vulnerability:** Unsafe string-based catch-all routes (`{*splat}`) in Express 5 cause `TypeError: Missing parameter name` rendering the API 404 handler broken.
**Learning:** This exposes the application to potentially leaking SPA fallback logic (sending HTML) for API endpoints instead of properly formatted JSON 404 responses.
**Prevention:** Always use safe native regular expressions (like `/^\/api(?:\/(.*))?$/`) for wildcard/catch-all routes in Express 5 apps utilizing `path-to-regexp` v8.
