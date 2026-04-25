## 2026-04-08 - Use Promise.all() to run concurrent independent queries
**Learning:** Found sequential independent database queries in `getScraperStatus` (`server/src/services/system-info.ts`) which unnecessarily block one another, thereby creating a response time bottleneck.
**Action:** When working on backend queries and system services, always verify that independent queries execute concurrently (using `Promise.all()`) instead of sequentially to optimize application latency.

## 2026-04-25 - Use Promise.all for independent DB queries in paginated endpoints
**Learning:** Sequential database operations like COUNT and SELECT in paginated queries (`getScrapeReports`) block execution, adding unnecessary latency to the request.
**Action:** Always wrap independent db.query calls (like COUNT and SELECT data) in Promise.all and clone param arrays (e.g., `const dataParams = [...params, limit, offset]`) to safely execute them concurrently without state mutations.
