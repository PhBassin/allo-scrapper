
## 2024-05-17 - [Optimizing Component Renders with useMemo]
**Learning:** Found that some derived states, particularly arrays/computations on arrays like grouping or filtering (e.g., `getUniqueDates`, `filter`, `groupByFilm` in `CinemaPage.tsx`), were being recalculated on every component render. Since components can re-render frequently due to other unrelated state changes (like showing a scrape progress bar, `showProgress`), memoizing these computations prevents potentially expensive recalculations and optimizes rendering speed.
**Action:** When working on components rendering lists from derived state arrays, always evaluate if `useMemo` can be used to prevent recalculation when the underlying source data (`showtimes`) or filter criteria (`selectedDate`) haven't changed.
