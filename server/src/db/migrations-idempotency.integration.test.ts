import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import pg from 'pg';
import { runMigrations } from './migrations.js';
import path from 'path';
import fs from 'fs/promises';

let container: StartedTestContainer;
let pool: pg.Pool;

async function readMigrationSql(filename: string): Promise<string> {
  const migrationsDir = path.join(process.cwd(), '../migrations');
  return await fs.readFile(path.join(migrationsDir, filename), 'utf8');
}

describe('Database Migration Idempotency (Integration)', () => {
  beforeAll(async () => {
    container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'allo',
        POSTGRES_USER: 'postgres',
        POSTGRES_PASSWORD: 'password',
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2))
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(5432);

    pool = new pg.Pool({
      connectionString: `postgres://postgres:password@${host}:${port}/allo`,
    });

    // Run init.sql to bootstrap the core tables before migrations
    const initSqlPath = path.join(process.cwd(), '../docker/init.sql');
    const initSql = await fs.readFile(initSqlPath, 'utf8');
    await pool.query(initSql);
  }, 120000);

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
    if (container) {
      await container.stop();
    }
  });

  it('Scenario 1 & 2: Fresh database - run migrations twice', async () => {
    // Scenario 1: First run on fresh database
    await expect(runMigrations(pool)).resolves.not.toThrow();

    // Verify some expected schemas exist
    const { rows: tables } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tableNames = tables.map(r => r.table_name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('showtimes');

    // Scenario 2: Second run on same database (should be idempotent)
    // Run them again and ensure no errors are thrown
    await expect(runMigrations(pool)).resolves.not.toThrow();
  });

  it('Scenario 3 & 4: Populated database - run migrations', async () => {
    // The first test already migrated this database. Add realistic existing data
    // and rerun the retrofitted SQL directly to prove idempotency on a populated DB.

    const sql010 = await readMigrationSql('010_remove_phantom_permissions.sql');
    const sql011 = await readMigrationSql('011_add_roles_crud_permissions.sql');
    const sql012 = await readMigrationSql('012_add_read_permissions.sql');
    const sql015 = await readMigrationSql('015_add_schedule_permissions.sql');
    const sql016 = await readMigrationSql('016_add_admin_permissions.sql');
    const sql023 = await readMigrationSql('023_add_scrape_settings.sql');

    // 010: populated DB contains a phantom permission from out-of-band writes.
    await pool.query(
      `INSERT INTO permissions (name, description, category)
       VALUES ('system:read', 'Phantom permission for idempotency test', 'system')
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`
    );
    await expect(pool.query(sql010)).resolves.not.toThrow();
    const phantomAfterFirstRun = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM permissions WHERE name = 'system:read'`
    );
    expect(phantomAfterFirstRun.rows[0].count).toBe('0');

    await expect(pool.query(sql010)).resolves.not.toThrow();
    const phantomAfterSecondRun = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM permissions WHERE name = 'system:read'`
    );
    expect(phantomAfterSecondRun.rows[0].count).toBe('0');

    // 011: rerun against existing permissions to hit ON CONFLICT and repeatable UPDATE.
    await expect(pool.query(sql011)).resolves.not.toThrow();
    await expect(pool.query(sql011)).resolves.not.toThrow();
    const rolesCrudPermissions = await pool.query<{ name: string; description: string }>(
      `SELECT name, description
       FROM permissions
       WHERE name IN ('roles:list', 'roles:create', 'roles:update', 'roles:delete', 'roles:read')
       ORDER BY name`
    );
    expect(rolesCrudPermissions.rows).toHaveLength(5);
    expect(rolesCrudPermissions.rows.find(row => row.name === 'roles:read')?.description)
      .toBe("Voir les détails d'un rôle");

    // 012: operator assignments already exist, so reruns must be harmless.
    await expect(pool.query(sql012)).resolves.not.toThrow();
    await expect(pool.query(sql012)).resolves.not.toThrow();
    const operatorReadPermissions = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE r.name = 'operator'
         AND p.name IN ('cinemas:read', 'users:read')`
    );
    expect(operatorReadPermissions.rows[0].count).toBe('2');

    // 015: populated DB already has schedule permissions and assignments.
    await expect(pool.query(sql015)).resolves.not.toThrow();
    await expect(pool.query(sql015)).resolves.not.toThrow();
    const schedulePermissionAssignments = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE r.name = 'operator'
         AND p.name IN (
           'scraper:schedules:list',
           'scraper:schedules:create',
           'scraper:schedules:update',
           'scraper:schedules:delete'
         )`
    );
    expect(schedulePermissionAssignments.rows[0].count).toBe('4');

    // 016: admin role should keep one assignment per permission after reruns.
    const totalPermissions = await pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM permissions'
    );
    await expect(pool.query(sql016)).resolves.not.toThrow();
    await expect(pool.query(sql016)).resolves.not.toThrow();
    const adminRolePermissions = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = 'admin' AND r.is_system = true`
    );
    expect(adminRolePermissions.rows[0].count).toBe(totalPermissions.rows[0].count);

    // 023: populated singleton row already exists, so reruns must preserve schema and constraints.
    await pool.query(
      `UPDATE app_settings
       SET scrape_mode = 'from_today_limited', scrape_days = 5
       WHERE id = 1`
    );
    await expect(pool.query(sql023)).resolves.not.toThrow();
    await expect(pool.query(sql023)).resolves.not.toThrow();
    const scrapeSettings = await pool.query<{ scrape_mode: string; scrape_days: number }>(
      'SELECT scrape_mode, scrape_days FROM app_settings WHERE id = 1'
    );
    expect(scrapeSettings.rows).toEqual([
      { scrape_mode: 'from_today_limited', scrape_days: 5 },
    ]);

    const scrapeSettingsConstraints = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM information_schema.table_constraints
       WHERE table_name = 'app_settings'
         AND constraint_name IN ('valid_scrape_mode', 'valid_scrape_days')`
    );
    expect(scrapeSettingsConstraints.rows[0].count).toBe('2');
  });
});
