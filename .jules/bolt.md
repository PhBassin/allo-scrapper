
## 2024-05-17 - [Optimizing Component Renders with useMemo]
**Learning:** Found that some derived states, particularly arrays/computations on arrays like grouping or filtering (e.g., `getUniqueDates`, `filter`, `groupByFilm` in `CinemaPage.tsx`), were being recalculated on every component render. Since components can re-render frequently due to other unrelated state changes (like showing a scrape progress bar, `showProgress`), memoizing these computations prevents potentially expensive recalculations and optimizes rendering speed.
**Action:** When working on components rendering lists from derived state arrays, always evaluate if `useMemo` can be used to prevent recalculation when the underlying source data (`showtimes`) or filter criteria (`selectedDate`) haven't changed.

## 2026-03-04 - Safely Caching Intl.DateTimeFormat
**Learning:** While replacing `toLocaleDateString` with cached `Intl.DateTimeFormat` instances is a common and effective micro-optimization to prevent expensive object re-initialization during React renders and loops, it introduces a critical difference in error handling. `toLocaleDateString` gracefully handles invalid dates by returning "Invalid Date", whereas `Intl.DateTimeFormat.prototype.format()` throws a `RangeError: Invalid time value` if the date is invalid, which can crash the application or backend API.
**Action:** When migrating to cached `Intl.DateTimeFormat` instances, always explicitly validate the date (e.g., `if (isNaN(date.getTime())) return '';`) before calling `.format()`. Use module-level caching where possible, and `useMemo` in React components when module-level is not feasible.

## 2026-03-15 - [Optimize Array Presence Checks in React Renders]
**Learning:** Found an anti-pattern in `CinemaDateSelector.tsx` where `.filter(s => s.date === date).length > 0` was used inside a render loop. This forces JavaScript to iterate through the entire array and allocate memory for a new intermediate array just to perform a boolean check, resulting in unnecessary $O(N)$ operations during render.
**Action:** When only checking if an element exists in a collection, always use `Array.prototype.some()`. It early-exits on the first match (making it $O(1)$ in best-case scenarios) and avoids allocating memory for intermediate arrays.
## 2026-03-16 - [Parallelize DB queries in FilmService]
**Learning:** Sequential database queries for fetching films and showtimes (e.g., `getWeeklyFilms` then `getWeeklyShowtimes`) create a performance bottleneck in `FilmService` since they are independent operations.
**Action:** Use `Promise.all` to run independent DB queries concurrently, which reduces the total response time and improves API throughput for related endpoints.

## 2026-03-18 - [Optimize Array Transformations]
**Learning:** Chaining `.map().filter()` creates unnecessary intermediate arrays, increasing memory allocation and garbage collection overhead, especially in rendering loops or reactive memoized computations.
**Action:** When filtering and transforming data simultaneously, replace `.map().filter()` chains with a single `.reduce()` or a combination of `.flatMap()` to compute the result in one pass and avoid allocating unused intermediate objects.

## 2026-03-27 - [Concurrent Database Stats Queries in system-queries.ts]
**Learning:** System statistics were executing 5 independent sequential `COUNT(*)` and size queries instead of using `Promise.all()`. This is an architecture-specific bottleneck that adds noticeable latency to the `/api/admin/system` endpoint because it executes N times the DB roundtrip.
**Action:** Replaced sequential awaits in `getDatabaseStats` with a single `Promise.all()` to gather `sizeResult`, `tableCountResult`, `cinemaCountResult`, `filmCountResult`, and `showtimeCountResult` concurrently, improving endpoint latency dramatically.

## 2026-03-29 - [Concurrent Role Permissions Queries in role-queries.ts]
**Learning:** Sequential database queries inside a `for...of` loop for fetching permissions per role created an N+1 query bottleneck in `getAllRoles`. This is an architecture-specific issue that adds noticeable latency to endpoints querying roles, because it executes N times the DB roundtrip for permissions.
**Action:** Replaced sequential awaits in `getAllRoles` with a `Promise.all()` over an array map to gather permissions for all roles concurrently, improving database throughput for related API endpoints.

## 2024-05-24 - [Optimize groupShowtimesByCinema iteration]
**Learning:** Destructuring with rest operator (`...`) is surprisingly slow compared to `Object.assign` combined with `delete` in V8 when cloning large arrays of objects, and using plain Objects instead of `Map` can be >2x faster in tight loops grouping thousands of objects.
**Action:** In performance-critical loops processing arrays, prefer `Record<string, any>` maps, standard `for` loops, and `Object.assign` + `delete` over modern ES6 destructuring and `Map` collections.
