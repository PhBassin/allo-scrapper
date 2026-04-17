## 2024-05-18 - Memoize nested array filtering operations
**Learning:** In frontend components, performing multiple nested array operations (like `.filter()` containing `.some()` containing another `.some()`) on every render can cause measurable performance degradation, especially during rapid state updates like scrolling or search input.
**Action:** When a derived array value requires expensive nested iterations, wrap the calculation in `useMemo` so it only recalculates when its underlying dependencies change.
