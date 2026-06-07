1. **Optimize `getMoviesByDate` and `getWeeklyMovies` in `server/src/db/movie-queries.ts`**
   - The loops that group theaters by movie are currently using `Map`. Based on memory `## 2024-05-24 - [Optimize groupShowtimesByCinema iteration]`, using plain Objects instead of `Map` can be >2x faster in tight loops grouping thousands of objects.
   - Replace `const moviesMap = new Map<number, Movie & { theaters: Theater[] }>();` with a plain dictionary using `Object.create(null)` and track values in an array.
   - This should provide a measurable performance improvement for endpoints returning movie listings.

2. **Run tests & pre-commit checks**
   - Ensure the server tests pass, run format and lint.
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

3. **Submit the PR**
   - Title: "⚡ Bolt: [Performance] Optimize movie grouping loops using plain Objects"
   - Description to include What, Why, Impact, and Measurement.
