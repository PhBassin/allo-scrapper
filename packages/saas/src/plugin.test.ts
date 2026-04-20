/**
 * RED tests for saasPlugin.
 *
 * Verifies that register() wires SaaS migrations by calling runMigrations
 * with the SaaS migration directory.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Express } from 'express';
import request from 'supertest';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// We spy on runMigrations imported dynamically inside plugin.ts.
// Since plugin.ts uses a dynamic import to avoid cross-rootDir compile-time
// dependency, we mock the module path it resolves to at runtime.
// In the test environment (packages/saas), the server module path is resolved
// via the workspace alias configured in tsconfig / vitest.
vi.mock('allo-scrapper-server/dist/db/migrations.js', () => ({
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
    const migrationsModule = await import('allo-scrapper-server/dist/db/migrations.js');
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

  it('mounts /test fixture routes when E2E fixture mode is enabled outside NODE_ENV=test', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('E2E_ENABLE_ORG_FIXTURE', 'true');

    const { saasPlugin } = await import('./plugin.js');
    const db = { query: vi.fn() };
    const pool = { connect: vi.fn() };

    await saasPlugin.register(app, { db, pool });

    const res = await request(app).post('/test/seed-org').send({});
    expect(res.status).not.toBe(404);
  });


  it('includes saas_008_create_default_ics_org.sql in migrations directory', async () => {
    const fs = await import('fs/promises');
    const files = await fs.readdir(path.join(__dirname, '../migrations'));
    const migrationFiles = files.filter((f) => f.endsWith('.sql')).sort();

    expect(migrationFiles).toContain('saas_008_create_default_ics_org.sql');
  });

  it('includes saas_009_fix_org_settings_fk_cascade.sql in migrations directory', async () => {
    const fs = await import('fs/promises');
    const files = await fs.readdir(path.join(__dirname, '../migrations'));
    const migrationFiles = files.filter((f) => f.endsWith('.sql')).sort();

    expect(migrationFiles).toContain('saas_009_fix_org_settings_fk_cascade.sql');
  });

  it('includes saas_010_add_fk_indexes.sql in migrations directory', async () => {
    const fs = await import('fs/promises');
    const files = await fs.readdir(path.join(__dirname, '../migrations'));
    const migrationFiles = files.filter((f) => f.endsWith('.sql')).sort();

    expect(migrationFiles).toContain('saas_010_add_fk_indexes.sql');
  });
});
