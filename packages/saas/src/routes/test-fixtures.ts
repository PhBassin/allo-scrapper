import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createOrg } from '../services/org-service.js';
import { SaasAuthService } from '../services/saas-auth-service.js';
import { logger } from '../utils/logger.js';
import type { DB, Pool, Organization } from '../db/types.js';

interface SeedCounts {
  users: number;
  cinemas: number;
  showtimes: number;
}

interface CleanupResult {
  orgId: number;
  deleted: boolean;
}

interface TestFixturesDependencies {
  createOrgFn: typeof createOrg;
  createAdminUserFn: (pool: Pool, org: Organization, email: string, password: string) => Promise<{ id: number; username: string }>;
  seedOrgDataFn: (pool: Pool, org: Organization, adminUserId: number, uniqueSeed: string) => Promise<SeedCounts>;
  cleanupOrgFn: (pool: Pool, orgId: number) => Promise<CleanupResult>;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function workerTag(): string {
  return process.env['TEST_WORKER_INDEX'] ?? process.env['VITEST_POOL_ID'] ?? '0';
}

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function isSafeSchemaName(schemaName: string): boolean {
  return /^org_[a-z0-9_]+$/.test(schemaName);
}

async function defaultCreateAdminUser(pool: Pool, org: Organization, email: string, password: string): Promise<{ id: number; username: string }> {
  const authService = new SaasAuthService(pool);
  const admin = await authService.createAdminUser(org, email, password);
  return { id: admin.id, username: admin.username };
}

async function defaultSeedOrgData(pool: Pool, org: Organization, _adminUserId: number, uniqueSeed: string): Promise<SeedCounts> {
  if (!isSafeSchemaName(org.schema_name)) {
    throw new Error('Unsafe schema name');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET search_path TO "${org.schema_name}", public`);

    await client.query(
      `CREATE TABLE IF NOT EXISTS cinemas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT,
        city TEXT
      )`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS films (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        source_url TEXT NOT NULL
      )`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS showtimes (
        id TEXT PRIMARY KEY,
        film_id INTEGER NOT NULL REFERENCES films(id),
        cinema_id TEXT NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        datetime_iso TEXT NOT NULL,
        week_start TEXT NOT NULL
      )`
    );

    const extraUserPasswordHash = await bcrypt.hash(`Fixture-${uniqueSeed}-A1!`, 10);
    await client.query(
      `INSERT INTO users (username, password_hash, role_id, email_verified)
       VALUES ($1, $2, 2, true)
       ON CONFLICT (username) DO NOTHING`,
      [`editor-${uniqueSeed}@test.local`, extraUserPasswordHash]
    );

    for (let i = 0; i < 3; i += 1) {
      const cinemaId = `TC-${uniqueSeed}-${i}`;
      await client.query(
        `INSERT INTO cinemas (id, name, url, city)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [cinemaId, `Test Cinema ${uniqueSeed} ${i}`, `https://example.test/${cinemaId}`, 'Paris']
      );
    }

    for (let i = 0; i < 3; i += 1) {
      const filmId = 900000 + i;
      await client.query(
        `INSERT INTO films (id, title, source_url)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [filmId, `Fixture Film ${uniqueSeed} ${i}`, `https://example.test/film/${filmId}`]
      );
    }

    for (let i = 0; i < 10; i += 1) {
      const filmId = 900000 + (i % 3);
      const cinemaId = `TC-${uniqueSeed}-${i % 3}`;
      const showtimeId = `TS-${uniqueSeed}-${i}`;
      await client.query(
        `INSERT INTO showtimes (id, film_id, cinema_id, date, time, datetime_iso, week_start)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [showtimeId, filmId, cinemaId, '2026-04-16', '20:00', `2026-04-16T20:${String(i).padStart(2, '0')}:00.000Z`, '2026-04-15']
      );
    }

    await client.query('COMMIT');

    return {
      users: 2,
      cinemas: 3,
      showtimes: 10,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function defaultCleanupOrg(pool: Pool, orgId: number): Promise<CleanupResult> {
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;

    const orgResult = await client.query<{ id: number; schema_name: string }>(
      'SELECT id, schema_name FROM organizations WHERE id = $1 FOR UPDATE',
      [orgId]
    );

    const org = orgResult.rows[0];
    if (!org) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return { orgId, deleted: false };
    }

    if (!isSafeSchemaName(org.schema_name)) {
      throw new Error('Unsafe schema name');
    }

    await client.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    await client.query(`DROP SCHEMA IF EXISTS "${org.schema_name}" CASCADE`);

    await client.query('COMMIT');
    inTransaction = false;

    return { orgId, deleted: true };
  } catch (error) {
    if (inTransaction) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

const defaultDependencies: TestFixturesDependencies = {
  createOrgFn: createOrg,
  createAdminUserFn: defaultCreateAdminUser,
  seedOrgDataFn: defaultSeedOrgData,
  cleanupOrgFn: defaultCleanupOrg,
};

export function createTestFixturesRouter(deps: Partial<TestFixturesDependencies> = {}): Router {
  const router = Router();
  const dependencies: TestFixturesDependencies = {
    ...defaultDependencies,
    ...deps,
  };

  router.post('/seed-org', async (req, res, next) => {
    if (process.env['NODE_ENV'] !== 'test') {
      return res.status(404).json({ success: false, error: 'Not Found' });
    }

    try {
      const startedAt = Date.now();
      const db = req.app.get('db') as DB;
      const pool = req.app.get('pool') as Pool;

      const now = Date.now();
      const uniq = `${workerTag()}-${now}-${randomSuffix()}`;
      const body = req.body as {
        slug?: string;
        name?: string;
        adminEmail?: string;
        adminPassword?: string;
      };

      const generatedSlug = normalizeSlug(body.slug ?? `test-org-w${workerTag()}-t${now}-r${randomSuffix()}`);
      const orgName = body.name ?? `Test Org ${uniq}`;
      const adminEmail = body.adminEmail ?? `admin-${uniq}@test.local`;
      const adminPassword = body.adminPassword ?? `P@ss-${uniq}-Aa1!`;

      const { org } = await dependencies.createOrgFn(db, {
        name: orgName,
        slug: generatedSlug,
        plan_id: 1,
      });

      const admin = await dependencies.createAdminUserFn(pool, org, adminEmail, adminPassword);
      const seeded = await dependencies.seedOrgDataFn(pool, org, admin.id, uniq);

      const durationMs = Date.now() - startedAt;
      logger.info('test fixture org seeded', {
        org_id: org.id,
        org_slug: org.slug,
        duration_ms: durationMs,
      });

      return res.status(201).json({
        success: true,
        data: {
          org_id: org.id,
          org_slug: org.slug,
          schema_name: org.schema_name,
          admin: {
            id: admin.id,
            username: admin.username,
            password: adminPassword,
          },
          seeded_counts: seeded,
          duration_ms: durationMs,
        },
      });
    } catch (error) {
      next(error);
      return;
    }
  });

  router.delete('/cleanup-org/:id', async (req, res, next) => {
    if (process.env['NODE_ENV'] !== 'test') {
      return res.status(404).json({ success: false, error: 'Not Found' });
    }

    try {
      const orgId = Number.parseInt(req.params['id'] ?? '', 10);
      if (Number.isNaN(orgId)) {
        return res.status(400).json({ success: false, error: 'Invalid org id' });
      }

      const startedAt = Date.now();
      const pool = req.app.get('pool') as Pool;
      const result = await dependencies.cleanupOrgFn(pool, orgId);
      const durationMs = Date.now() - startedAt;

      logger.info('test fixture org cleanup', {
        org_id: orgId,
        deleted: result.deleted,
        duration_ms: durationMs,
      });

      if (!result.deleted) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
      }

      return res.json({
        success: true,
        data: {
          org_id: orgId,
          deleted: true,
          duration_ms: durationMs,
        },
      });
    } catch (error) {
      next(error);
      return;
    }
  });

  return router;
}
