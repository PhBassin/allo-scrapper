## 2026-04-08 - Use Promise.all() to run concurrent independent queries
**Learning:** Found sequential independent database queries in `getScraperStatus` (`server/src/services/system-info.ts`) which unnecessarily block one another, thereby creating a response time bottleneck.
**Action:** When working on backend queries and system services, always verify that independent queries execute concurrently (using `Promise.all()`) instead of sequentially to optimize application latency.## 2026-05-11 - Use Promise.all() for concurrent async operations in API endpoints
**Learning:** Sequential await calls for independent async operations (like separate DB queries) unnecessarily delay the API response time.
**Action:** Identify independent `await` statements in route handlers and refactor them to execute concurrently using `Promise.all()`.
