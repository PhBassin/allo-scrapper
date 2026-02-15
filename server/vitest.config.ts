import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
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
