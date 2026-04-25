import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { createOrg } from '../services/org-service.js';
import { SaasAuthService } from '../services/saas-auth-service.js';
import type { DB, Pool } from '../db/types.js';
import { logger } from '../utils/logger.js';
import { getWeekDates, getWeekStart } from 'allo-scrapper-server/dist/utils/date.js';

type SeedRequestBody = {
  slug?: string;
  name?: string;
  adminEmail?: string;
  adminPassword?: string;
  planId?: number;
};

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

function isFixtureRuntimeEnabled(): boolean {
  return process.env['NODE_ENV'] === 'test'
    || (process.env['NODE_ENV'] === 'development' && process.env['E2E_ENABLE_ORG_FIXTURE'] === 'true');
}

function buildDefaultSlug(): string {
  return `e2e-test-${randomBytes(5).toString('hex')}`;
}

function buildDefaultPassword(): string {
  return `P@ss-${randomBytes(12).toString('base64url')}-Aa1!`;
}

function normalizeSeedInput(body: SeedRequestBody): {
  slug: string;
  name: string;
  adminEmail: string;
  adminPassword: string;
  planId: number;
} {
  const slug = (body.slug?.trim() || buildDefaultSlug()).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error('Invalid slug format');
  }

  const name = body.name?.trim() || `Fixture ${slug}`;
  const adminEmail = body.adminEmail?.trim() || `${slug}@test.local`;
  const adminPassword = body.adminPassword || buildDefaultPassword();
  const planId = Number.isInteger(body.planId) && (body.planId as number) > 0 ? (body.planId as number) : 1;

  return { slug, name, adminEmail, adminPassword, planId };
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function buildFixtureSlugHash(slug: string, length: number): string {
  return createHash('sha1').update(slug).digest('hex').slice(0, length);
}

function buildFixtureCinemaId(slug: string, index: number): string {
  return `C${buildFixtureSlugHash(slug, 7)}${index}`;
}

function buildFixtureFilmId(slug: string, index: number): number {
  const base = 100000 + (Number.parseInt(buildFixtureSlugHash(slug, 6), 16) % 700000);
  return base + index - 1;
}

function buildFixtureShowtimeId(slug: string, index: number): string {
  return `S${buildFixtureSlugHash(slug, 6)}${index.toString().padStart(3, '0')}`;
}

async function seedTenantData(
  pool: Pool,
  schemaName: string,
  slug: string,
): Promise<{ users: number; cinemas: number; schedules: number }> {
  const client = await pool.connect();

  try {
    const schemaIdentifier = quoteIdentifier(schemaName);
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${schemaIdentifier}, public`);

    const fixtureRoleResult = await client.query<{ id: number }>(
      `SELECT id
         FROM roles
        WHERE name <> 'admin'
        ORDER BY CASE name
          WHEN 'viewer' THEN 1
          WHEN 'operator' THEN 2
          WHEN 'editor' THEN 3
          ELSE 99
        END,
        id
        LIMIT 1`
    );
    const fixtureRoleId = fixtureRoleResult.rows[0]?.id;
    if (!fixtureRoleId) {
      throw new Error('No non-admin role found in tenant schema');
    }

    const viewerPassword = await bcrypt.hash(buildDefaultPassword(), 10);
    await client.query(
      `INSERT INTO users (username, password_hash, role_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO NOTHING`,
      [`viewer-${slug}@test.local`, viewerPassword, fixtureRoleId]
    );

    const cinemas = [1, 2, 3].map((index) => ({
      id: buildFixtureCinemaId(slug, index),
      name: `Fixture Cinema ${index} (${slug})`,
      url: `https://example.test/cinema/${slug}/${index}`,
    }));

    for (const cinema of cinemas) {
      await client.query(
        `INSERT INTO cinemas (id, name, url)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [cinema.id, cinema.name, cinema.url]
      );
    }

    const films = [
      { id: buildFixtureFilmId(slug, 1), title: `Fixture Film A (${slug})` },
      { id: buildFixtureFilmId(slug, 2), title: `Fixture Film B (${slug})` },
      { id: buildFixtureFilmId(slug, 3), title: `Fixture Film C (${slug})` },
    ];

    for (const film of films) {
      await client.query(
        `INSERT INTO films (id, title, source_url)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [film.id, film.title, `https://example.test/film/${slug}/${film.id}`]
      );
    }

    const weekStart = getWeekStart();
    const weekDates = getWeekDates(weekStart, 5);
    const showtimeSlots = [
      '10:00', '11:30', '13:00', '14:30', '16:00',
      '17:30', '19:00', '20:30', '21:00', '22:15',
    ];

    for (let i = 0; i < showtimeSlots.length; i += 1) {
      const film = films[i % films.length];
      const cinema = cinemas[i % cinemas.length];
      const time = showtimeSlots[i];
      const id = buildFixtureShowtimeId(slug, i + 1);
      const date = weekDates[i % weekDates.length] as string;

      await client.query(
        `INSERT INTO showtimes (id, film_id, cinema_id, date, time, datetime_iso, week_start)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [id, film.id, cinema.id, date, time, `${date}T${time}:00.000Z`, weekStart]
      );
    }

    const usersCountResult = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
    const cinemasCountResult = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM cinemas');
    const schedulesCountResult = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM showtimes');

    await client.query('COMMIT');

    return {
      users: Number.parseInt(usersCountResult.rows[0]?.count ?? '0', 10),
      cinemas: Number.parseInt(cinemasCountResult.rows[0]?.count ?? '0', 10),
      schedules: Number.parseInt(schedulesCountResult.rows[0]?.count ?? '0', 10),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function isFixtureOrganization(slug: string, schemaName: string): boolean {
  return slug.startsWith('e2e-') || schemaName.startsWith('org_e2e_');
}

export function createTestFixturesRouter(): Router {
  const router = Router();

  router.post('/seed-org', async (req: Request, res: Response) => {
    if (!isFixtureRuntimeEnabled()) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const startedAt = Date.now();

    try {
      const db = req.app.get('db') as DB;
      const pool = req.app.get('pool') as Pool;

      const input = normalizeSeedInput(req.body as SeedRequestBody);
      const { org } = await createOrg(db, {
        name: input.name,
        slug: input.slug,
        plan_id: input.planId,
      }, pool);

      const authService = new SaasAuthService(pool);
      const admin = await authService.createAdminUser(org, input.adminEmail, input.adminPassword);

      const seeded = await seedTenantData(pool, org.schema_name, org.slug);

      logger.info('test fixture org seeded', {
        org_id: org.id,
          org_slug: org.slug,
          duration_ms: Date.now() - startedAt,
          plan_id: input.planId,
        });

      return res.status(201).json({
        success: true,
        data: {
          org_id: org.id,
          org_slug: org.slug,
          schema_name: org.schema_name,
          plan_id: input.planId,
          admin: {
            id: admin.id,
            username: admin.username,
            password: input.adminPassword,
          },
          seeded,
        },
      });
    } catch (error) {
      logger.error('test fixture seed failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ success: false, error: 'Failed to seed test organization' });
    }
  });

  router.delete('/cleanup-org/:id', async (req: Request, res: Response) => {
    if (!isFixtureRuntimeEnabled()) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const startedAt = Date.now();
    const orgId = Number.parseInt(req.params['id'] as string, 10);
    if (!Number.isInteger(orgId) || orgId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid org id' });
    }

    try {
      const db = req.app.get('db') as DB;
      const pool = req.app.get('pool') as Pool;

      const orgResult = await db.query<{ id: number; slug: string; schema_name: string }>(
        'SELECT id, slug, schema_name FROM organizations WHERE id = $1',
        [orgId]
      );

      const org = orgResult.rows[0];
      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
      }

      if (!isFixtureOrganization(org.slug, org.schema_name)) {
        logger.warn('test fixture cleanup refused for non-fixture organization', {
          org_id: org.id,
          org_slug: org.slug,
          schema_name: org.schema_name,
        });
        return res.status(403).json({ success: false, error: 'Cleanup is only allowed for fixture organizations' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(org.schema_name)} CASCADE`);
        await client.query('DELETE FROM organizations WHERE id = $1', [orgId]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      logger.info('test fixture org cleaned', {
        org_id: orgId,
        duration_ms: Date.now() - startedAt,
      });

      return res.status(200).json({
        success: true,
        data: {
          org_id: orgId,
          deleted: true,
        },
      });
    } catch (error) {
      logger.error('test fixture cleanup failed', {
        org_id: orgId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ success: false, error: 'Failed to cleanup test organization' });
    }
  });

  return router;
}

export function createTestFixturesNotFoundRouter(): Router {
  const router = Router();

  router.use((_req, res) => {
    return res.status(404).json({
      success: false,
      error: 'Not found',
    });
  });

  return router;
}
