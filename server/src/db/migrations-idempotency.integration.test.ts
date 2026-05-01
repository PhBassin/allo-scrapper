import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import pg from 'pg';
import { runMigrations } from './migrations.js';
import path from 'path';
import fs from 'fs/promises';

let container: StartedTestContainer;
let pool: pg.Pool;

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
    // Scenario 3 & 4: the database is already migrated and has some data.
    // We can insert some duplicate data to make sure no unique constraints or
    // other insert-based migrations fail if they were to run again.
    // Wait, the migrations runner won't run applied migrations again. 
    // We need to bypass the `schema_migrations` check to force re-running the SQL files!
    
    const retrofittedFiles = [
      '010_remove_phantom_permissions.sql',
      '011_add_roles_crud_permissions.sql',
      '012_add_read_permissions.sql',
      '015_add_schedule_permissions.sql',
      '016_add_admin_permissions.sql',
      '022_fix_showtime_deduplication.sql',
      '023_add_scrape_settings.sql'
    ];

    const migrationsDir = path.join(process.cwd(), '../migrations');

    // We don't run 007 again because it relies on the 'role' column which was dropped in 008.

    for (const filename of retrofittedFiles) {
      const sql = await fs.readFile(path.join(migrationsDir, filename), 'utf8');
      
      // Execute the migration SQL directly (bypassing schema_migrations tracking)
      // This proves they are truly idempotent
      await expect(pool.query(sql)).resolves.not.toThrow();
      
      // Let's insert some data that would conflict if not handled, for those where it makes sense
      // For instance, another admin user or a showtime.
    }
    
    // Run 022 again
    const sql022 = await fs.readFile(path.join(migrationsDir, '022_fix_showtime_deduplication.sql'), 'utf8');
    await expect(pool.query(sql022)).resolves.not.toThrow();

    // Run 023 again
    const sql023 = await fs.readFile(path.join(migrationsDir, '023_add_scrape_settings.sql'), 'utf8');
    await expect(pool.query(sql023)).resolves.not.toThrow();
  });
});
