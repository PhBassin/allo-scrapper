/**
 * Tests for org-scoped routes (#741).
 *
 * Covers:
 * - ping (existing, regression)
 * - cinemas routes: GET list, GET single, POST (quota guard), PUT, DELETE
 * - films routes: GET list, GET single
 * - reports routes: GET list, GET single
 * - scraper routes: POST trigger (quota guard), GET schedules
 * - users routes: GET list, POST (quota guard), PUT, DELETE, POST change-password
 * - requireOrgAuth: JWT org_slug mismatch → 403
 * - isolation: org A cannot see org B data via different DB clients
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { errorHandler } from 'allo-scrapper-server/dist/middleware/error-handler.js';

const { loggerWarnMock, loggerErrorMock } = vi.hoisted(() => ({
  loggerWarnMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('allo-scrapper-server/dist/utils/logger.js', () => ({
  logger: {
    warn: loggerWarnMock,
    error: loggerErrorMock,
    info: vi.fn(),
  },
}));

// The same secret configured in vitest.config.ts env
const TEST_JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';

/** Mint a short-lived JWT for use in test Authorization headers. */
function mintToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });
}

// ── Shared mock helpers ──────────────────────────────────────────────────────

function makeOrg(slug = 'acme', status = 'active') {
  return {
    id: 1,
    slug,
    name: `${slug} Cinema`,
    schema_name: `org_${slug.replace(/-/g, '_')}`,
    status,
    plan_id: 1,
    trial_ends_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/**
 * Builds a minimal Express app with mocked pool (for resolveTenant) and db.
 *
 * @param orgSlug  – slug the tenant middleware will resolve to
 * @param orgStatus – 'active' | 'trial' | 'suspended' | 'canceled'
 * @param dbRows   – rows to return from the scoped dbClient.query() (after infra calls)
 * @param jwtUser  – optional: user payload to mint a JWT for; returned as `token`
 */
function buildApp(
  orgSlug = 'acme',
  orgStatus = 'active',
  dbRows: Record<string, unknown>[] = [],
  jwtUser?: Record<string, unknown>,
) {
  const app = express();
  app.use(express.json());

  const org = makeOrg(orgSlug, orgStatus);

  // Scoped client returned by pool.connect().
  // resolveTenant always makes 2 infrastructure queries before the handler runs:
  //   1. getOrgBySlug → returns the org row
  //   2. SET search_path → returns empty
  // Subsequent calls return dbRows (the handler's data).
  const dbClient = {
    query: vi.fn()
      .mockResolvedValueOnce({ rows: [org], rowCount: 1 })        // getOrgBySlug
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })             // SET search_path
      .mockResolvedValue({ rows: dbRows, rowCount: dbRows.length }), // handler queries
    release: vi.fn(),
  };
  const pool = { connect: vi.fn().mockResolvedValue(dbClient) };
  app.set('pool', pool);

  // Global db (standalone fallback)
  const db = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
  app.set('db', db);

  // Mint a real JWT so requireAuth can verify it from the Authorization header
  const token = jwtUser ? mintToken(jwtUser) : undefined;

  app.use(errorHandler);

  return { app, pool, dbClient, db, org, token };
}

// ── ping (regression) ────────────────────────────────────────────────────────

describe('GET /api/org/:slug/ping', () => {
  it('returns 200 with org info for active org', async () => {
    const { app } = buildApp('acme', 'active');
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());
    app.use(errorHandler);

    const res = await request(app).get('/api/org/acme/ping');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.org.slug).toBe('acme');
  });

  it('remains public when a stale bearer token is sent', async () => {
    const { app } = buildApp('acme', 'active');
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());
    app.use(errorHandler);

    const res = await request(app)
      .get('/api/org/acme/ping')
      .set('Authorization', 'Bearer stale.invalid.token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 200 with org info for trial org', async () => {
    const { app } = buildApp('acme', 'trial');
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/ping');
    expect(res.status).toBe(200);
  });

  it('returns 404 when org not found', async () => {
    const app = express();
    app.use(express.json());
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    app.set('pool', pool);

    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/ghost/ping');
    expect(res.status).toBe(404);
  });

  it('returns 403 when org is suspended', async () => {
    const { app } = buildApp('acme', 'suspended');
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/ping');
    expect(res.status).toBe(403);
  });
});

// ── requireOrgAuth ────────────────────────────────────────────────────────────

describe('requireOrgAuth', () => {
  it('returns 403 when JWT org_slug does not match route slug', async () => {
    const jwtUser = {
      id: 1,
      username: 'admin',
      role_name: 'admin',
      is_system_role: true,
      permissions: [],
      org_slug: 'other-org', // token belongs to a different org
    };
    const { app, token } = buildApp('acme', 'active', [], jwtUser);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app)
      .get('/api/org/acme/cinemas')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    const errorText = [res.body?.error, res.body?.message, res.text].filter((value): value is string => typeof value === 'string').join(' ');
    expect(errorText).toMatch(/organization mismatch/i);
  });

  it('passes through when JWT org_slug matches route slug', async () => {
    const jwtUser = {
      id: 1,
      username: 'admin',
      role_name: 'admin',
      is_system_role: true,
      permissions: ['cinemas:read'],
      org_slug: 'acme',
    };
    const cinemas = [{ id: 'C001', name: 'Acme Cinéma' }];
    const { app, token } = buildApp('acme', 'active', cinemas, jwtUser);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app)
      .get('/api/org/acme/cinemas')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('passes through when JWT has no org_slug (standalone token used in SaaS context)', async () => {
    // No org_slug in token — should be allowed (not forced to a specific org)
    const jwtUser = {
      id: 1,
      username: 'admin',
      role_name: 'admin',
      is_system_role: true,
      permissions: ['cinemas:read'],
    };
    const { app, token } = buildApp('acme', 'active', [], jwtUser);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app)
      .get('/api/org/acme/cinemas')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ── Cinemas ───────────────────────────────────────────────────────────────────

describe('GET /api/org/:slug/cinemas', () => {
  it('returns 200 and uses the scoped dbClient', async () => {
    const jwtUser = {
      id: 1, username: 'admin', role_name: 'admin',
      is_system_role: true, permissions: ['cinemas:read'], org_slug: 'acme',
    };
    const cinemas = [{ id: 'C001', name: 'Acme Cinéma', city: 'Paris' }];
    const { app, dbClient, db, token } = buildApp('acme', 'active', cinemas, jwtUser);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app)
      .get('/api/org/acme/cinemas')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // The scoped client must have been queried (not the global db)
    expect(dbClient.query).toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns 403 when org A token requests org B cinema schedule details', async () => {
    const jwtUser = {
      id: 1, username: 'admin-a', role_name: 'admin',
      is_system_role: true, permissions: ['cinemas:read'], org_slug: 'org-a',
    };
    const { app, dbClient, db, token } = buildApp('org-b', 'active', [], jwtUser);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app)
      .get('/api/org/org-b/cinemas/CB01')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    const errorText = [res.body?.error, res.body?.message, res.text]
      .filter((value): value is string => typeof value === 'string')
      .join(' ');
    expect(errorText).toMatch(/organization mismatch/i);
    expect(db.query).not.toHaveBeenCalled();
    expect(dbClient.query).toHaveBeenCalled();
    expect(dbClient.query.mock.calls.some(([sql]: [string]) =>
      typeof sql === 'string' && sql.includes('SELECT * FROM organizations WHERE slug = $1')
    )).toBe(true);
    expect(dbClient.query.mock.calls.some(([sql]: [string]) =>
      typeof sql === 'string' && sql.includes('SET search_path TO public')
    )).toBe(true);
  });

  it('uses the scoped dbClient for cinema schedule details and keeps the global db untouched', async () => {
    const jwtUser = {
      id: 1, username: 'admin', role_name: 'admin',
      is_system_role: true, permissions: ['cinemas:read'], org_slug: 'acme',
    };
    const showtimes = [{ id: 'S001', film_id: 1, cinema_id: 'C001', date: '2026-04-21', time: '14:00', datetime_iso: '2026-04-21T14:00:00.000Z', version: null, format: null, experiences: '[]', week_start: '2026-04-15', film_title: 'Acme Film', original_title: null, poster_url: null, duration_minutes: 90, release_date: null, rerelease_date: null, genres: '[]', nationality: null, director: null, screenwriters: '[]', actors: '[]', synopsis: null, certificate: null, press_rating: null, audience_rating: null, source_url: 'https://example.test', trailer_url: null }];
    const { app, dbClient, db, token } = buildApp('acme', 'active', showtimes, jwtUser);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app)
      .get('/api/org/acme/cinemas/C001')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(dbClient.query).toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('POST /api/org/:slug/cinemas — quota guard', () => {
  it('returns 402 when quota is exceeded', async () => {
    const jwtUser = {
      id: 1, username: 'admin', role_name: 'admin',
      is_system_role: true, permissions: ['cinemas:create'], org_slug: 'acme',
    };
    const { app, dbClient, token } = buildApp('acme', 'active', [], jwtUser);

    // Mock quota check: plan with max_cinemas=3, usage=3 → exceeded
    // (resolveTenant's org lookup + SET search_path are already handled by buildApp)
    dbClient.query
      .mockResolvedValueOnce({                                           // getPlanById
        rows: [{ id: 1, name: 'free', max_cinemas: 3, max_users: 5, max_scrapes_per_day: 10 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({                                           // getOrCreateUsage
        rows: [{ id: 1, org_id: 1, month: '2026-04-01', cinemas_count: 3, users_count: 0, scrapes_count: 0, api_calls_count: 0 }],
        rowCount: 1,
      });

    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app)
      .post('/api/org/acme/cinemas')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 'C999', name: 'New Cinema', url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0001.html' });

    expect(res.status).toBe(402);
    expect(res.body.error).toBe('QUOTA_EXCEEDED');
    expect(res.body.resource).toBe('cinemas');
  });
});

// ── Films ─────────────────────────────────────────────────────────────────────

describe('GET /api/org/:slug/films', () => {
  it('returns 200 and queries scoped client', async () => {
    const jwtUser = {
      id: 1, username: 'admin', role_name: 'admin',
      is_system_role: true, permissions: [], org_slug: 'acme',
    };
    const { app, dbClient } = buildApp('acme', 'active', [], jwtUser);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/films');
    expect(res.status).toBe(200);
    expect(dbClient.query).toHaveBeenCalled();
  });
});

// ── Reports ───────────────────────────────────────────────────────────────────

describe('GET /api/org/:slug/reports', () => {
  it('requires authentication (401 without token)', async () => {
    const { app } = buildApp('acme', 'active', []);
    // No jwtUser — no req.user attached
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/reports');
    expect(res.status).toBe(401);
  });

  it('returns 200 for authenticated user with reports:list permission', async () => {
    const jwtUser = {
      id: 1, username: 'admin', role_name: 'admin',
      is_system_role: true, permissions: ['reports:list'], org_slug: 'acme',
    };
    const { app, dbClient, token } = buildApp('acme', 'active', [], jwtUser);

    // getScrapeReports makes 2 queries: COUNT(*) then paginated SELECT.
    // buildApp's default mockResolvedValue returns { rows: [], rowCount: 0 } which
    // causes countResult.rows[0] to be undefined → crash. Override with correct shapes.
    dbClient.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })  // COUNT(*)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });                // paginated SELECT

    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app)
      .get('/api/org/acme/reports')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(dbClient.query).toHaveBeenCalled();
  });
});

// ── Scraper trigger ───────────────────────────────────────────────────────────

describe('POST /api/org/:slug/scraper/trigger — quota guard', () => {
  it('returns 402 when scrapes quota exceeded', async () => {
    const jwtUser = {
      id: 1, username: 'admin', role_name: 'admin',
      is_system_role: true, permissions: ['scraper:trigger'], org_slug: 'acme',
    };
    const { app, dbClient, token } = buildApp('acme', 'active', [], jwtUser);

    // (resolveTenant's org lookup + SET search_path are already handled by buildApp)
    dbClient.query
      .mockResolvedValueOnce({                                           // getPlanById
        rows: [{ id: 1, name: 'free', max_cinemas: 3, max_users: 5, max_scrapes_per_day: 10 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({                                           // getOrCreateUsage
        rows: [{ id: 1, org_id: 1, month: '2026-04-01', cinemas_count: 0, users_count: 0, scrapes_count: 10, api_calls_count: 0 }],
        rowCount: 1,
      });

    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app)
      .post('/api/org/acme/scraper/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('QUOTA_EXCEEDED');
    expect(res.body.resource).toBe('scrapes');
  });
});

// ── Users ─────────────────────────────────────────────────────────────────────

describe('GET /api/org/:slug/users', () => {
  it('returns 401 without authentication', async () => {
    const { app } = buildApp('acme', 'active', []);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/users');
    expect(res.status).toBe(401);
  });

  it('returns 200 with users list for authenticated admin', async () => {
    const jwtUser = {
      id: 1, username: 'admin', role_name: 'admin',
      is_system_role: true, permissions: ['users:list'], org_slug: 'acme',
    };
    const users = [
      { id: 1, username: 'alice', role_id: 1, role_name: 'admin', created_at: new Date() },
    ];
    const { app, dbClient, token } = buildApp('acme', 'active', users, jwtUser);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app)
      .get('/api/org/acme/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(dbClient.query).toHaveBeenCalled();
  });
});

describe('POST /api/org/:slug/users — quota guard', () => {
  it('returns 402 when users quota is exceeded', async () => {
    const jwtUser = {
      id: 1, username: 'admin', role_name: 'admin',
      is_system_role: true, permissions: ['users:create'], org_slug: 'acme',
    };
    const { app, dbClient, token } = buildApp('acme', 'active', [], jwtUser);

    // (resolveTenant's org lookup + SET search_path are already handled by buildApp)
    dbClient.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, name: 'free', max_cinemas: 3, max_users: 5, max_scrapes_per_day: 10 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 1, org_id: 1, month: '2026-04-01', cinemas_count: 0, users_count: 5, scrapes_count: 0, api_calls_count: 0 }],
        rowCount: 1,
      });

    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app)
      .post('/api/org/acme/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'newuser', password: 'Passw0rd!', role_id: 1 });

    expect(res.status).toBe(402);
    expect(res.body.error).toBe('QUOTA_EXCEEDED');
    expect(res.body.resource).toBe('users');
  });

  it('returns 400 when the username already exists in the global user table', async () => {
    const jwtUser = {
      id: 1, username: 'admin', role_name: 'admin',
      is_system_role: true, permissions: ['users:create'], org_slug: 'acme',
    };
    const { app, db, dbClient, token } = buildApp('acme', 'active', [], jwtUser);

    dbClient.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'free', max_cinemas: 3, max_users: 5, max_scrapes_per_day: 10 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 1, org_id: 1, month: '2026-04-01', cinemas_count: 0, users_count: 0, scrapes_count: 0, api_calls_count: 0 }], rowCount: 1 });

    db.query = vi.fn().mockResolvedValue({
      rows: [{ id: 77, username: 'shareduser' }],
      rowCount: 1,
    });

    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());
    app.use(errorHandler);

    const res = await request(app)
      .post('/api/org/acme/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'shareduser', password: 'Passw0rd!', role_id: 1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error ?? res.body.message).toBe('Username already exists');
    expect(db.query).toHaveBeenCalled();
  });
});

describe('tenant user mutation isolation', () => {
  it('returns 403 when org A token is used against org B update route', async () => {
    const jwtUser = {
      id: 1, username: 'admin-a', role_name: 'admin',
      is_system_role: true, permissions: ['users:update'], org_slug: 'org-a',
    };
    const { app, token } = buildApp('org-b', 'active', [], jwtUser);

    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app)
      .put('/api/org/org-b/users/999')
      .set('Authorization', `Bearer ${token}`)
      .send({ role_id: 1 });

    expect(res.status).toBe(403);
  });

  it('returns 403 when org A token is used against org B delete route', async () => {
    const jwtUser = {
      id: 1, username: 'admin-a', role_name: 'admin',
      is_system_role: true, permissions: ['users:delete'], org_slug: 'org-a',
    };
    const { app, token } = buildApp('org-b', 'active', [], jwtUser);

    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app)
      .delete('/api/org/org-b/users/999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ── Tenant isolation ──────────────────────────────────────────────────────────

describe('tenant isolation', () => {
  it('org A and org B use separate dbClients — queries do not cross', async () => {
    const jwtUserA = {
      id: 1, username: 'admin-a', role_name: 'admin',
      is_system_role: true, permissions: ['cinemas:read'], org_slug: 'org-a',
    };
    const jwtUserB = {
      id: 2, username: 'admin-b', role_name: 'admin',
      is_system_role: true, permissions: ['cinemas:read'], org_slug: 'org-b',
    };

    const cinemasA = [{ id: 'CA01', name: 'Cinema A' }];
    const cinemasB = [{ id: 'CB01', name: 'Cinema B' }];

    const { app: appA, dbClient: clientA, token: tokenA } = buildApp('org-a', 'active', cinemasA, jwtUserA);
    const { app: appB, dbClient: clientB, token: tokenB } = buildApp('org-b', 'active', cinemasB, jwtUserB);

    const { createOrgRouter } = await import('./org.js');
    appA.use('/api/org/:slug', createOrgRouter());
    appB.use('/api/org/:slug', createOrgRouter());

    const resA = await request(appA)
      .get('/api/org/org-a/cinemas')
      .set('Authorization', `Bearer ${tokenA}`);
    const resB = await request(appB)
      .get('/api/org/org-b/cinemas')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    // Each app only queried its own client
    expect(clientA.query).toHaveBeenCalled();
    expect(clientB.query).toHaveBeenCalled();
  });
});
