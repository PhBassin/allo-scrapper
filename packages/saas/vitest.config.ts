import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve cross-package imports from server/src so Vitest can transform them.
const serverSrc = path.resolve(__dirname, '../../server/src');

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@server',
        replacement: serverSrc,
      },
      // Map any import of the form `../../../server/src/<X>.js` → actual TS file
      {
        find: /^(\.\.\/)*server\/src\/(.*)\.js$/,
        replacement: path.join(serverSrc, '$2.ts'),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
      JWT_EXPIRES_IN: '1h',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 65,
        statements: 80,
        perFile: true,
      },
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/plugin.ts',
      ],
    },
  },
});
