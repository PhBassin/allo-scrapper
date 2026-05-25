# Deferred Work

## Deferred from: code review of 9-1-protect-exposed-endpoints (2026-05-25)

- ~~Missing rate limiter on `/metrics` endpoint~~ **FIXED** — `generalLimiter` added before `requireAuth` to resolve CodeQL High severity alert.

