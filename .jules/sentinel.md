## 2026-04-10 - Express 5 path-to-regexp v8 wildcard routes issue
**Vulnerability:** Unsafe string-based catch-all routes (`{*splat}`) in Express 5 cause `TypeError: Missing parameter name` rendering the API 404 handler broken.
**Learning:** This exposes the application to potentially leaking SPA fallback logic (sending HTML) for API endpoints instead of properly formatted JSON 404 responses.
**Prevention:** Always use safe native regular expressions (like `/^\/api(?:\/(.*))?$/`) for wildcard/catch-all routes in Express 5 apps utilizing `path-to-regexp` v8.
## 2026-04-29 - Unverified JWT Decoding in Rate Limiter
**Vulnerability:** The rate limiter middleware (`authenticatedKeyGenerator`) used `jwt.decode(token)` to extract the user's ID for bucketing. Because `jwt.decode` does not verify the signature, an attacker could spoof the JWT payload to create a DoS condition or bypass rate limits by attributing their requests to other users.
**Learning:** `jwt.decode()` should almost never be used when security or identity verification is required. If bucketing depends on a user identifier from a token, that token must be verified first.
**Prevention:** Always use `jwt.verify(token, JWT_SECRET)` and ensure that the application fails closed (or falls back securely, like to an IP address bucket) if verification fails.
