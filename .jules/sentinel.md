# Sentinel's Journal

## 2026-02-18 - API Error Leakage
**Vulnerability:** Consistent pattern of manually catching errors in route handlers and sending `res.status(500).json({ error: error.message })`. This exposed internal error details (e.g., database errors) to clients.
**Learning:** Developers likely copied this pattern from one route to another without considering `NODE_ENV` or leveraging the global error handler.
**Prevention:** Enforce use of `next(error)` for unexpected errors in route handlers. Ensure global error handler is configured to sanitize errors in production.

## 2026-03-05 - Safe Error Response Handlers
**Vulnerability:** Uncaught application errors in `/api/reports` and `/api/scraper` endpoints were exposing `error.message` directly in JSON responses, which could leak internal path structures, stack traces, or DB error semantics depending on the thrown error.
**Learning:** While Express has a generic error handler, some routes explicitly managed the response payload and naively embedded `error.message`. Refactoring them to delegate to `next(error)` caused an API contract breakage by returning HTML default responses instead of expected JSON.
**Prevention:** Avoid embedding `error.message` inside manually constructed JSON HTTP 500 responses unless the error strictly originates from known safe validation constraints. For unknown exceptions, manually log the context using `logger.error` and emit a static, sanitized error string like `'Failed to fetch reports'` to satisfy the `ApiResponse` schema safely.

## 2026-03-07 - Insecure Array Shuffling (Password Generation)
**Vulnerability:** Weak, predictable array shuffling using `Array.prototype.sort()` and a random comparator `() => crypto.randomInt(0, 2) - 0.5`. This caused generated passwords to be less random and potentially more predictable, reducing their security.
**Learning:** `Array.prototype.sort()` is inappropriate for shuffling since JavaScript sorting algorithms are not designed for non-transitive random comparators. It introduces a high bias in the generated permutations.
**Prevention:** For any security-sensitive operation requiring random permutation (like password or token generation), use a cryptographically secure implementation of the Fisher-Yates shuffle algorithm.
