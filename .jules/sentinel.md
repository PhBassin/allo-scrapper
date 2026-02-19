# Sentinel's Journal

## 2026-02-18 - API Error Leakage
**Vulnerability:** Consistent pattern of manually catching errors in route handlers and sending `res.status(500).json({ error: error.message })`. This exposed internal error details (e.g., database errors) to clients.
**Learning:** Developers likely copied this pattern from one route to another without considering `NODE_ENV` or leveraging the global error handler.
**Prevention:** Enforce use of `next(error)` for unexpected errors in route handlers. Ensure global error handler is configured to sanitize errors in production.
