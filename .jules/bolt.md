## 2026-04-08 - Use Promise.all() to run concurrent independent queries
**Learning:** Found sequential independent database queries in `getScraperStatus` (`server/src/services/system-info.ts`) which unnecessarily block one another, thereby creating a response time bottleneck.
**Action:** When working on backend queries and system services, always verify that independent queries execute concurrently (using `Promise.all()`) instead of sequentially to optimize application latency.
## 2024-05-24 - Refactor Sequential Database Queries with Promise.all
**Learning:** In the database layer (e.g. Postgres queries), sequential `COUNT(*)` and paginated `SELECT` queries introduce unnecessary network roundtrip latency overhead, forming a bottleneck.
**Action:** When refactoring sequential database queries to run concurrently via `Promise.all()`, never mutate the shared `params` array directly. Always clone the array (e.g. `const dataParams = [...params, limit, offset]`) for the query requiring additional parameters, to prevent race conditions and unintended parameter corruption across concurrent calls.
