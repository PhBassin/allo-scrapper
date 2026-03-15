
## 2024-05-17 - [Optimizing Component Renders with useMemo]
**Learning:** Found that some derived states, particularly arrays/computations on arrays like grouping or filtering (e.g., `getUniqueDates`, `filter`, `groupByFilm` in `CinemaPage.tsx`), were being recalculated on every component render. Since components can re-render frequently due to other unrelated state changes (like showing a scrape progress bar, `showProgress`), memoizing these computations prevents potentially expensive recalculations and optimizes rendering speed.
**Action:** When working on components rendering lists from derived state arrays, always evaluate if `useMemo` can be used to prevent recalculation when the underlying source data (`showtimes`) or filter criteria (`selectedDate`) haven't changed.

## 2026-03-04 - Safely Caching Intl.DateTimeFormat
**Learning:** While replacing `toLocaleDateString` with cached `Intl.DateTimeFormat` instances is a common and effective micro-optimization to prevent expensive object re-initialization during React renders and loops, it introduces a critical difference in error handling. `toLocaleDateString` gracefully handles invalid dates by returning "Invalid Date", whereas `Intl.DateTimeFormat.prototype.format()` throws a `RangeError: Invalid time value` if the date is invalid, which can crash the application or backend API.
**Action:** When migrating to cached `Intl.DateTimeFormat` instances, always explicitly validate the date (e.g., `if (isNaN(date.getTime())) return '';`) before calling `.format()`. Use module-level caching where possible, and `useMemo` in React components when module-level is not feasible.

## 2026-03-15 - [Optimize Array Presence Checks in React Renders]
**Learning:** Found an anti-pattern in `CinemaDateSelector.tsx` where `.filter(s => s.date === date).length > 0` was used inside a render loop. This forces JavaScript to iterate through the entire array and allocate memory for a new intermediate array just to perform a boolean check, resulting in unnecessary $O(N)$ operations during render.
**Action:** When only checking if an element exists in a collection, always use `Array.prototype.some()`. It early-exits on the first match (making it $O(1)$ in best-case scenarios) and avoids allocating memory for intermediate arrays.
