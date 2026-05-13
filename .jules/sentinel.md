## 2026-04-10 - Express 5 path-to-regexp v8 wildcard routes issue
**Vulnerability:** Unsafe string-based catch-all routes (`{*splat}`) in Express 5 cause `TypeError: Missing parameter name` rendering the API 404 handler broken.
**Learning:** This exposes the application to potentially leaking SPA fallback logic (sending HTML) for API endpoints instead of properly formatted JSON 404 responses.
**Prevention:** Always use safe native regular expressions (like `/^\/api(?:\/(.*))?$/`) for wildcard/catch-all routes in Express 5 apps utilizing `path-to-regexp` v8.

## 2026-05-13 - Prevent detail leakage in 5xx AppErrors
**Vulnerability:** The global Express error handler masked the `.message` property of 5xx `AppError` instances in production, but failed to mask the `.details` property, potentially leaking sensitive internal data to clients.
**Learning:** Even when the main error message is sanitized, auxiliary properties like `details` or `context` on custom error classes can inadvertently expose sensitive state or stack information if not explicitly stripped in production 5xx responses.
**Prevention:** Ensure that all properties (including optional detail arrays/objects) of application errors are scrubbed or omitted when returning 5xx responses in a production environment.
