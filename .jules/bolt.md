## 2026-04-08 - Use Promise.all() to run concurrent independent queries
**Learning:** Found sequential independent database queries in `getScraperStatus` (`server/src/services/system-info.ts`) which unnecessarily block one another, thereby creating a response time bottleneck.
**Action:** When working on backend queries and system services, always verify that independent queries execute concurrently (using `Promise.all()`) instead of sequentially to optimize application latency.

## 2025-05-24 - Memoizing Expensive Derived State Filtering in React

**Learning:** When calculating derived state by nested filtering (e.g. O(N*C*S) arrays) inside components based on other states or props (like `afterTime`), doing it directly during render causes severe iteration overhead upon every component re-render.
**Action:** Use `useMemo` with an appropriate dependency array (like `[allFilms, afterTime]`) to memoize the result, preventing redundant allocation and slow O(N*C*S) filtering from running on unrelated state changes.
