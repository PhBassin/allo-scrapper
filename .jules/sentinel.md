## 2026-04-18 - Prevent Rate Limit Exhaustion via JWT Spoofing
**Vulnerability:** The rate limiter's `authenticatedKeyGenerator` used `jwt.decode` instead of `jwt.verify` to extract user IDs for bucketing. This allowed an attacker to spoof arbitrary user IDs with unverified tokens, consuming their rate limit quotas and causing a targeted Denial of Service (DoS).
**Learning:** Rate-limiting middleware often executes before authentication middleware. Relying on downstream validation for properties extracted upstream creates security gaps.
**Prevention:** Always use `jwt.verify` with the correct cryptographic secret when extracting identity claims for any security or resource allocation mechanism, even if full authentication happens later.
