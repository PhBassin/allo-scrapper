import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Exclude integration-heavy files that require a live DB/Redis connection.
      // scraper/index.ts (thin orchestrator entry) and redis/client.ts require live
      // infrastructure; core run logic is tested via the ScrapeRun class in
      // scrape-run.ts and the helpers test file.
      exclude: [
        // Test helpers are not production code.
        'tests/**',
        'src/scraper/index.ts',
        'src/redis/client.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 65,
      },
    },
  },
});
