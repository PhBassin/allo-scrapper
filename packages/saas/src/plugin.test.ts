/**
 * RED tests for saasPlugin.
 *
 * Verifies that register() wires SaaS migrations by calling runMigrations
 * with the SaaS migration directory.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Express } from 'express';

// We spy on runMigrations imported dynamically inside plugin.ts.
// Since plugin.ts uses a dynamic import to avoid cross-rootDir compile-time
// dependency, we mock the module path it resolves to at runtime.
// In the test environment (packages/saas), the server module path is resolved
// via the workspace alias configured in tsconfig / vitest.
vi.mock('../../../server/src/db/migrations.js', () => ({
  runMigrations: vi.fn().mockResolvedValue(undefined),
}));

describe('saasPlugin', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    vi.clearAllMocks();
  });

  it('has the correct plugin name', async () => {
    const { saasPlugin } = await import('./plugin.js');
    expect(saasPlugin.name).toBe('@allo-scrapper/saas');
  });

  it('mounts /api/saas/orgs route (runMigrations is called during register)', async () => {
    const { saasPlugin } = await import('./plugin.js');
    const db = { query: vi.fn() };
    const pool = { connect: vi.fn() };

    // register() should complete without throwing
    await expect(saasPlugin.register(app, { db, pool })).resolves.toBeUndefined();
  });

  it('calls runMigrations with the SaaS migration directory on register()', async () => {
    const { saasPlugin, getSaasMigrationDir } = await import('./plugin.js');

    // Import the mock to inspect calls
    const migrationsModule = await import('../../../server/src/db/migrations.js');
    const runMigrationsMock = vi.mocked(migrationsModule.runMigrations);

    const db = { query: vi.fn() };
    const pool = { connect: vi.fn() };

    await saasPlugin.register(app, { db, pool });

    expect(runMigrationsMock).toHaveBeenCalledOnce();
    expect(runMigrationsMock).toHaveBeenCalledWith(
      db,
      [getSaasMigrationDir()]
    );
  });
});
