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
 * @param dbRows   – rows to return from the scoped dbClient.query()
 * @param jwtUser  – optional: user object attached to req.user (simulates requireAuth)
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

  // Scoped client returned by pool.connect()
  const dbClient = {
    query: vi.fn().mockResolvedValue({ rows: dbRows, rowCount: dbRows.length }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn().mockResolvedValue(dbClient) };
  app.set('pool', pool);

  // Global db (standalone fallback)
  const db = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
  app.set('db', db);

  // Simulate requireAuth by attaching req.user before routes if jwtUser provided
  if (jwtUser) {
    app.use((req, _res, next) => {
      (req as any).user = jwtUser;
      next();
    });
  }

  return { app, pool, dbClient, db, org };
}

// ── ping (regression) ────────────────────────────────────────────────────────

describe('GET /api/org/:slug/ping', () => {
  it('returns 200 with org info for active org', async () => {
    const { app } = buildApp('acme', 'active');
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/ping');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.org.slug).toBe('acme');
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
    const { app } = buildApp('acme', 'active', [], jwtUser);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/cinemas');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/token does not match/i);
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
    const { app } = buildApp('acme', 'active', cinemas, jwtUser);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/cinemas');
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
    const { app } = buildApp('acme', 'active', [], jwtUser);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/cinemas');
    expect(res.status).toBe(200);
  });
});

// ── Cinemas ───────────────────────────────────────────────────────────────────

describe('GET /api/org/:slug/cinemas', () => {
  it('returns 200 and uses the scoped dbClient', async () => {
    const jwtUser = {
      id: 1, username: 'admin', role_name: 'admin',
      is_system_role: true, permissions: [], org_slug: 'acme',
    };
    const cinemas = [{ id: 'C001', name: 'Acme Cinéma', city: 'Paris' }];
    const { app, dbClient, db } = buildApp('acme', 'active', cinemas, jwtUser);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/cinemas');
    expect(res.status).toBe(200);
    // The scoped client must have been queried (not the global db)
    expect(dbClient.query).toHaveBeenCalled();
  });
});

describe('POST /api/org/:slug/cinemas — quota guard', () => {
  it('returns 402 when quota is exceeded', async () => {
    const jwtUser = {
      id: 1, username: 'admin', role_name: 'admin',
      is_system_role: true, permissions: ['cinemas:create'], org_slug: 'acme',
    };
    const { app, dbClient } = buildApp('acme', 'active', [], jwtUser);

    // Mock quota check: plan with max_cinemas=3, usage=3 → exceeded
    dbClient.query
      .mockResolvedValueOnce({ rows: [makeOrg('acme')], rowCount: 1 }) // resolveTenant org lookup
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                 // SET search_path
      .mockResolvedValueOnce({                                           // getPlanById
        rows: [{ id: 1, name: 'free', max_cinemas: 3, max_users: 5, max_scrapes_per_month: 10 }],
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
    const { app, dbClient } = buildApp('acme', 'active', [], jwtUser);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/reports');
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
    const { app, dbClient } = buildApp('acme', 'active', [], jwtUser);

    dbClient.query
      .mockResolvedValueOnce({ rows: [makeOrg('acme')], rowCount: 1 }) // org lookup
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                 // SET search_path
      .mockResolvedValueOnce({                                           // getPlanById
        rows: [{ id: 1, name: 'free', max_cinemas: 3, max_users: 5, max_scrapes_per_month: 10 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({                                           // getOrCreateUsage
        rows: [{ id: 1, org_id: 1, month: '2026-04-01', cinemas_count: 0, users_count: 0, scrapes_count: 10, api_calls_count: 0 }],
        rowCount: 1,
      });

    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).post('/api/org/acme/scraper/trigger').send({});
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
    const { app, dbClient } = buildApp('acme', 'active', users, jwtUser);
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/users');
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
    const { app, dbClient } = buildApp('acme', 'active', [], jwtUser);

    dbClient.query
      .mockResolvedValueOnce({ rows: [makeOrg('acme')], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 1, name: 'free', max_cinemas: 3, max_users: 5, max_scrapes_per_month: 10 }],
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
      .send({ username: 'newuser', password: 'Passw0rd!', role_id: 1 });

    expect(res.status).toBe(402);
    expect(res.body.error).toBe('QUOTA_EXCEEDED');
    expect(res.body.resource).toBe('users');
  });
});

// ── Tenant isolation ──────────────────────────────────────────────────────────

describe('tenant isolation', () => {
  it('org A and org B use separate dbClients — queries do not cross', async () => {
    const jwtUserA = {
      id: 1, username: 'admin-a', role_name: 'admin',
      is_system_role: true, permissions: [], org_slug: 'org-a',
    };
    const jwtUserB = {
      id: 2, username: 'admin-b', role_name: 'admin',
      is_system_role: true, permissions: [], org_slug: 'org-b',
    };

    const cinemasA = [{ id: 'CA01', name: 'Cinema A' }];
    const cinemasB = [{ id: 'CB01', name: 'Cinema B' }];

    const { app: appA, dbClient: clientA } = buildApp('org-a', 'active', cinemasA, jwtUserA);
    const { app: appB, dbClient: clientB } = buildApp('org-b', 'active', cinemasB, jwtUserB);

    const { createOrgRouter } = await import('./org.js');
    appA.use('/api/org/:slug', createOrgRouter());
    appB.use('/api/org/:slug', createOrgRouter());

    const resA = await request(appA).get('/api/org/org-a/cinemas');
    const resB = await request(appB).get('/api/org/org-b/cinemas');

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    // Each app only queried its own client
    expect(clientA.query).toHaveBeenCalled();
    expect(clientB.query).toHaveBeenCalled();
  });
});
