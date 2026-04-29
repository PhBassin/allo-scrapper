## 2026-04-10 - Express 5 path-to-regexp v8 wildcard routes issue
**Vulnerability:** Unsafe string-based catch-all routes (`{*splat}`) in Express 5 cause `TypeError: Missing parameter name` rendering the API 404 handler broken.
**Learning:** This exposes the application to potentially leaking SPA fallback logic (sending HTML) for API endpoints instead of properly formatted JSON 404 responses.
**Prevention:** Always use safe native regular expressions (like `/^\/api(?:\/(.*))?$/`) for wildcard/catch-all routes in Express 5 apps utilizing `path-to-regexp` v8.
## 2026-04-29 - Unverified JWT Decoding in Rate Limiter
**Vulnerability:** The rate limiter middleware (`authenticatedKeyGenerator`) used `jwt.decode(token)` to extract the user's ID for bucketing. Because `jwt.decode` does not verify the signature, an attacker could spoof the JWT payload to create a DoS condition or bypass rate limits by attributing their requests to other users.
**Learning:** `jwt.decode()` should almost never be used when security or identity verification is required. If bucketing depends on a user identifier from a token, that token must be verified first.
**Prevention:** Always use `jwt.verify(token, JWT_SECRET)` and ensure that the application fails closed (or falls back securely, like to an IP address bucket) if verification fails.
## 2026-04-29 - Attestation digest formatting issue in Github Actions
**Vulnerability:** The artifact provenance generation in CI was failing because the `subject-digest` provided to `actions/attest-build-provenance` was missing the `sha256:` prefix, which is strictly validated. The value came from the output of `docker buildx imagetools inspect` formatting.
**Learning:** `docker buildx imagetools inspect --format '{{json .Manifest.Digest}}'` outputs the digest prefixed with `sha256:`. However, earlier CI steps or file processing might omit it or expect it in a certain format. `actions/attest-build-provenance` requires the `sha256:` prefix on digests.
**Prevention:** Ensure digests passed to `actions/attest-build-provenance@v4` always include the `sha256:` prefix. We can guarantee this by explicitly stripping any existing prefix with `sed 's/sha256://'` and then manually prepending `sha256:` during output assignment.
