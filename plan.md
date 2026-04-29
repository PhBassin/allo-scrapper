1. **Refactor `getScrapeReports` to run queries concurrently**
   - The function currently runs two sequential database queries: a `SELECT COUNT(*)` followed by a `SELECT *` for pagination.
   - Using `Promise.all` allows executing these queries concurrently, potentially cutting database latency nearly in half.
   - Care will be taken to ensure that the `params` array mutation for the limit/offset doesn't cause race conditions by passing a copy of the array for the paginated query.

2. **Pre-commit Instructions**
   - After implementing the change, I will run linting, tests, and formatting checks via pre-commit steps to ensure the change is correct and does not break existing functionality.

3. **Submit the Pull Request**
   - I will submit the change as a performance optimization with the "⚡ Bolt: [performance improvement]" format.
