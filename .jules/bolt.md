## 2026-04-08 - Use Promise.all() to run concurrent independent queries
**Learning:** Found sequential independent database queries in `getScraperStatus` (`server/src/services/system-info.ts`) which unnecessarily block one another, thereby creating a response time bottleneck.
**Action:** When working on backend queries and system services, always verify that independent queries execute concurrently (using `Promise.all()`) instead of sequentially to optimize application latency.

## 2026-04-26 - Clone query parameters array to safely run queries concurrently
**Learning:** When converting sequential paginated database queries to run concurrently with `Promise.all()`, reusing the base `params` array by mutating it (e.g. `params.push(limit, offset)`) inside the concurrent block can lead to race conditions or incorrect arguments being passed to other queries.
**Action:** Always create a cloned array (like `const dataParams = [...params, limit, offset]`) for the query requiring extra parameters to avoid unintended query manipulations.
