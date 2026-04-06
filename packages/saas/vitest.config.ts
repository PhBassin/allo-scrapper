import { defineConfig } from 'vitest/config';
import path from 'path';

// Resolve cross-package imports from server/src so Vitest can transform them.
// At runtime these are loaded by the server process which has the files on disk;
// in tests (Vitest/esbuild) we need explicit aliases because Vitest cannot
// traverse outside its own rootDir via bare relative paths ending in `.js`.
const serverSrc = path.resolve(__dirname, '../../server/src');

export default defineConfig({
  resolve: {
    alias: [
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
