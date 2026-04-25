## 2026-04-10 - Express 5 path-to-regexp v8 wildcard routes issue
**Vulnerability:** Unsafe string-based catch-all routes (`{*splat}`) in Express 5 cause `TypeError: Missing parameter name` rendering the API 404 handler broken.
**Learning:** This exposes the application to potentially leaking SPA fallback logic (sending HTML) for API endpoints instead of properly formatted JSON 404 responses.
**Prevention:** Always use safe native regular expressions (like `/^\/api(?:\/(.*))?$/`) for wildcard/catch-all routes in Express 5 apps utilizing `path-to-regexp` v8.
## 2026-04-12 - Insecure JWT Decoding in Rate Limiter Key Generation
**Vulnerability:** The rate limiting middleware (`server/src/middleware/rate-limit.ts`) used `jwt.decode` instead of `jwt.verify` to extract user IDs for bucketing requests. This allowed attackers to craft malicious, unverified JWTs with arbitrary user IDs, enabling them to bypass rate limits or exhaust quotas for legitimate users (Denial of Service).
**Learning:** Even for non-authentication purposes (like rate limiting bucketing), never trust the payload of an unverified JWT. It creates spoofing vulnerabilities that can be leveraged for resource exhaustion.
**Prevention:** Always use `jwt.verify(token, SECRET)` to securely extract claims from a JWT, regardless of where in the application stack it is used, and ensure `JWT_SECRET` is correctly validated at startup.
