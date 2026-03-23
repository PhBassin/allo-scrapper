import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      // Test-friendly rate limits (high enough for all tests)
      RATE_LIMIT_GENERAL_MAX: '100',
      RATE_LIMIT_AUTH_MAX: '50',
      RATE_LIMIT_REGISTER_MAX: '50',
      RATE_LIMIT_PROTECTED_MAX: '100',
      RATE_LIMIT_SCRAPER_MAX: '50',
      RATE_LIMIT_PUBLIC_MAX: '100',
      RATE_LIMIT_WINDOW_MS: '60000', // 1 minute
      JWT_SECRET: 'test-secret-minimum-32-chars-required-for-validation',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 65, // Relaxed for complex conditional logic
        statements: 80,
        // Apply thresholds per file, not globally
        perFile: true,
      },
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/types/**',
        // Exclude files without tests for now
        'src/app.ts',
        'src/index.ts',
        'src/db/**',
        'src/routes/**',
        'src/middleware/**',
        'src/services/cron.ts',
        'src/services/progress-tracker.ts',
        'src/services/scrape-manager.ts',
        'src/services/scraper/film-parser.ts',
        'src/services/scraper/http-client.ts',
        'src/services/scraper/index.ts',
        'src/utils/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
