## 2026-04-08 - Use Promise.all() to run concurrent independent queries
**Learning:** Found sequential independent database queries in `getScraperStatus` (`server/src/services/system-info.ts`) which unnecessarily block one another, thereby creating a response time bottleneck.
**Action:** When working on backend queries and system services, always verify that independent queries execute concurrently (using `Promise.all()`) instead of sequentially to optimize application latency.
## 2026-05-12 - Use prototype-less objects for performance-critical dictionary lookups
**Learning:** Found that large data array grouping (e.g., scrape attempts by cinema) can be bottlenecked by object prototype overhead and iterative `for-of` loops.
**Action:** For performance-critical grouping logic involving large arrays, use `Object.create(null)` to avoid prototype-chain lookups and standard `for` loops, grouping and tracking state simultaneously to eliminate secondary iterations.
