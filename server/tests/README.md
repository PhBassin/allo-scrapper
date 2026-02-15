# Testing Guide

## Overview

This project uses **Vitest** for unit testing with comprehensive code coverage tracking.

## Test Coverage Targets

- **Lines**: ≥80%
- **Functions**: ≥80%
- **Statements**: ≥80%
- **Branches**: ≥65% (relaxed for complex conditional logic)

## Running Tests

### Watch Mode (Default - Recommended for Development)
```bash
npm test
```
Tests automatically re-run when you modify source files or test files.

### Single Run
```bash
npm run test:run
```
Run all tests once and exit. Useful for CI/CD pipelines.

### With UI
```bash
npm run test:ui
```
Opens an interactive web-based UI to explore tests and coverage.

### Coverage Report
```bash
npm run test:coverage
```
Generates a detailed coverage report with:
- Terminal output (text format)
- HTML report in `coverage/` directory
- JSON report for analysis tools

## Test Structure

### Current Test Files
```
server/
├── src/
│   └── services/
│       └── scraper/
│           ├── theater-parser.ts           # Parser implementation
│           └── theater-parser.test.ts      # Unit tests (29 tests)
└── tests/
    ├── README.md                           # This file
    └── fixtures/
        ├── cinema-c0089-page.html          # Max Linder Panorama
        ├── cinema-w7504-page.html          # Épée de Bois
        └── cinema-c0072-page.html          # Le Grand Action
```

### Test Suites

#### 1. Cinema C0089 (Max Linder Panorama) - New Cinema Tests
- Validates parsing of cinema ID, name, address, postal code, city
- Tests screen count and image URL extraction
- Validates date arrays and film data structures
- Tests showtime parsing with proper date/time formats

#### 2. Regression Tests - Existing Cinemas
- **W7504 (Épée de Bois)**: Ensures existing cinema still parses correctly
- **C0072 (Le Grand Action)**: Verifies no breaking changes

#### 3. Edge Cases
- Missing theater data
- Malformed JSON in data attributes
- Empty HTML pages
- Cinemas with no films showing
- Consistent data structure validation

#### 4. Data Validation
- Valid film IDs (integers > 0)
- ISO date format validation (YYYY-MM-DD)
- Source URL format checks
- Week start calculation (Wednesdays)

## Adding Test Fixtures

### For New Cinemas

1. **Fetch full HTML page from Allociné**:
   ```bash
   curl "https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html" \
     -o tests/fixtures/cinema-cxxxx-page.html
   ```

2. **Verify fixture size**:
   ```bash
   ls -lh tests/fixtures/cinema-cxxxx-page.html
   ```
   Typical size: 400-600KB

3. **Create test suite** in `theater-parser.test.ts`:
   ```typescript
   describe('parseTheaterPage - Cinema CXXXX', () => {
     let html: string;
     let result: ReturnType<typeof parseTheaterPage>;

     beforeAll(() => {
       html = readFileSync(join(__dirname, '../../../tests/fixtures/cinema-cxxxx-page.html'), 'utf-8');
       result = parseTheaterPage(html, 'CXXXX');
     });

     it('should extract cinema ID correctly', () => {
       expect(result.cinema.id).toBe('CXXXX');
     });

     // Add more tests...
   });
   ```

4. **Run tests to verify**:
   ```bash
   npm run test:run
   ```

## Current Test Results

### ✅ Test Execution
- **Test Files**: 1 passed
- **Tests**: 29 passed (100% pass rate)
- **Duration**: ~700ms

### ✅ Code Coverage (theater-parser.ts)
- **Lines**: 94.3% ✅ (target: 80%)
- **Functions**: 100% ✅ (target: 80%)
- **Statements**: 93.7% ✅ (target: 80%)
- **Branches**: 68.8% ✅ (target: 65%)

## Troubleshooting

### Tests Fail After Allociné HTML Changes
If Allociné modifies their website structure:
1. Update fixtures with fresh HTML
2. Review parser logic in `theater-parser.ts`
3. Adjust test expectations if needed
4. Verify `data-theater` and `data-showtimes-dates` attributes exist

### Coverage Threshold Not Met
If coverage drops below thresholds:
1. Check which lines are uncovered: `npm run test:coverage`
2. Add tests for uncovered branches/lines
3. Consider if uncovered code is dead code (can be removed)
4. Review `vitest.config.ts` for exclusions

### Slow Test Execution
- Fixtures are ~1.6MB total - this is acceptable
- If tests become slow, consider:
  - Reducing fixture sizes (extract relevant sections only)
  - Mocking file I/O operations
  - Running tests in parallel (Vitest does this by default)

### Test Flakiness
If tests intermittently fail:
- Ensure fixtures are committed to git
- Check for timezone-dependent date logic
- Verify no external HTTP calls in tests (use fixtures only)

## Best Practices

### 1. Test Naming
- Use descriptive test names: `should extract cinema address correctly`
- Group related tests in `describe()` blocks
- Prefix regression tests: `Regression: Cinema W7504`

### 2. Fixture Management
- **DO**: Save complete HTML pages for realistic testing
- **DO**: Include diverse data (multiple films, showtimes, versions)
- **DON'T**: Edit fixtures manually (re-fetch instead)
- **DON'T**: Commit minified HTML (keep original formatting for debugging)

### 3. Test Assertions
- Test both positive and negative cases
- Validate data types and formats, not just presence
- Use specific matchers: `toBe()`, `toMatch()`, `toBeGreaterThan()`
- Avoid brittle tests (e.g., exact string matching with accents)

### 4. Coverage Goals
- Aim for 80%+ coverage on business logic
- 100% coverage is not always necessary
- Prioritize testing:
  - Public API functions
  - Edge cases and error handling
  - Complex conditional logic
  - Data transformations

## Future Improvements

### Potential Test Additions
1. **Film Parser Tests**: Add tests for `film-parser.ts`
2. **HTTP Client Tests**: Mock HTTP responses
3. **Integration Tests**: Test full scraper workflow end-to-end
4. **Database Tests**: Test queries and data persistence
5. **API Endpoint Tests**: Test Express routes

### Test Infrastructure Enhancements
- Add snapshot testing for complex data structures
- Integrate with GitHub Actions CI/CD
- Add performance benchmarking
- Implement visual regression testing for frontend

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest UI Guide](https://vitest.dev/guide/ui.html)
- [Coverage Configuration](https://vitest.dev/config/#coverage)
- [Testing Best Practices](https://testingjavascript.com/)

## Questions?

If you have questions or need help with testing:
1. Review this guide thoroughly
2. Check existing test files for patterns
3. Run tests in UI mode for interactive exploration
4. Consult Vitest documentation for advanced features
