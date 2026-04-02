import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ── mock requireSuperadmin so we control auth in route tests ──────────────────
vi.mock('../middleware/superadmin-auth.js', () => ({
  requireSuperadmin: vi.fn((_req, _res, next) => {
    _req.superadmin = { id: 1, username: 'root' };
    next();
  }),
}));

// ── mock SuperadminAuthService ────────────────────────────────────────────────
vi.mock('../services/superadmin-auth-service.js', () => ({
  SuperadminAuthService: vi.fn(),
}));

import { createSuperadminRouter } from '../routes/superadmin.js';
import { SuperadminAuthService } from '../services/superadmin-auth-service.js';

// ── helpers ──────────────────────────────────────────────────────────────────

const VALID_SECRET = 'superadmin-secret-at-least-32-chars-long!!';

function buildApp(dbRows?: { query: ReturnType<typeof vi.fn> }): Express {
  const app = express();
  app.use(express.json());

  const mockPool = {
    connect: vi.fn().mockResolvedValue({
      query: dbRows?.query ?? vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    }),
  };

  app.set('pool', mockPool);

  app.use('/api/superadmin', createSuperadminRouter());
  return app;
}

function authHeader(): string {
  const token = jwt.sign({ id: 1, username: 'root', scope: 'superadmin' }, VALID_SECRET, {
    expiresIn: '1h',
  });
  return `Bearer ${token}`;
}

// ── POST /api/superadmin/login ────────────────────────────────────────────────

describe('POST /api/superadmin/login', () => {
  beforeEach(() => {
    vi.stubEnv('SUPERADMIN_JWT_SECRET', VALID_SECRET);
  });

  it('returns 200 and a token when credentials are valid', async () => {
    vi.mocked(SuperadminAuthService).mockImplementation(() => ({
      validateCredentials: vi.fn().mockResolvedValue({ id: 1, username: 'root' }),
      mintSuperadminJwt: vi.fn().mockReturnValue('superadmin.jwt.token'),
      createSuperadmin: vi.fn(),
    } as any));

    const app = buildApp();
    const res = await request(app)
      .post('/api/superadmin/login')
      .send({ username: 'root', password: 'Password1!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('returns 401 when credentials are invalid', async () => {
    vi.mocked(SuperadminAuthService).mockImplementation(() => ({
      validateCredentials: vi.fn().mockResolvedValue(null),
      mintSuperadminJwt: vi.fn(),
      createSuperadmin: vi.fn(),
    } as any));

    const app = buildApp();
    const res = await request(app)
      .post('/api/superadmin/login')
      .send({ username: 'root', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when username or password is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/superadmin/login')
      .send({ username: 'root' }); // no password

    expect(res.status).toBe(400);
  });
});

// ── GET /api/superadmin/dashboard ─────────────────────────────────────────────

describe('GET /api/superadmin/dashboard', () => {
  it('returns 200 with MRR, ARR, counts', async () => {
    // Mock: org counts query → { total: 5, active: 3, trial: 1, suspended: 1 }
    const queryFn = vi
      .fn()
      // orgs by status
      .mockResolvedValueOnce({
        rows: [
          { status: 'active', count: '3' },
          { status: 'trial', count: '1' },
          { status: 'suspended', count: '1' },
        ],
        rowCount: 3,
      })
      // new orgs this week
      .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 })
      // MRR
      .mockResolvedValueOnce({ rows: [{ mrr_cents: '29900' }], rowCount: 1 });

    const app = buildApp({ query: queryFn });

    const res = await request(app)
      .get('/api/superadmin/dashboard')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      orgs: expect.any(Object),
      new_orgs_this_week: expect.any(Number),
      mrr_cents: expect.any(Number),
    });
  });

  it('returns 401 when not authenticated', async () => {
    // Remove the mock pass-through for this test
    const { requireSuperadmin } = await import('../middleware/superadmin-auth.js');
    vi.mocked(requireSuperadmin).mockImplementationOnce((_req, res, _next) => {
      res.status(401).json({ success: false, error: 'Unauthorized' });
    });

    const app = buildApp();
    const res = await request(app).get('/api/superadmin/dashboard');

    expect(res.status).toBe(401);
  });
});

// ── GET /api/superadmin/orgs ──────────────────────────────────────────────────

describe('GET /api/superadmin/orgs', () => {
  it('returns 200 with list of orgs', async () => {
    const queryFn = vi.fn().mockResolvedValue({
      rows: [
        { id: 'uuid-1', name: 'Cinema A', slug: 'cinema-a', status: 'active', plan_id: 1 },
        { id: 'uuid-2', name: 'Cinema B', slug: 'cinema-b', status: 'trial', plan_id: 1 },
      ],
      rowCount: 2,
    });

    const app = buildApp({ query: queryFn });
    const res = await request(app)
      .get('/api/superadmin/orgs')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('supports ?status= filter', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const app = buildApp({ query: queryFn });

    await request(app)
      .get('/api/superadmin/orgs?status=suspended')
      .set('Authorization', authHeader());

    // The query should have been called with a status filter
    const queryText: string = queryFn.mock.calls[0][0];
    expect(queryText).toMatch(/status/i);
  });
});

// ── GET /api/superadmin/orgs/:id ─────────────────────────────────────────────

describe('GET /api/superadmin/orgs/:id', () => {
  it('returns 200 with org detail', async () => {
    const queryFn = vi
      .fn()
      // org lookup
      .mockResolvedValueOnce({
        rows: [{ id: 'uuid-1', name: 'Cinema A', slug: 'cinema-a', status: 'active', plan_id: 1 }],
        rowCount: 1,
      });

    const app = buildApp({ query: queryFn });
    const res = await request(app)
      .get('/api/superadmin/orgs/uuid-1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('uuid-1');
  });

  it('returns 404 when org does not exist', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const app = buildApp({ query: queryFn });

    const res = await request(app)
      .get('/api/superadmin/orgs/nonexistent')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });
});

// ── POST /api/superadmin/orgs/:id/suspend ────────────────────────────────────

describe('POST /api/superadmin/orgs/:id/suspend', () => {
  it('returns 200 and suspends the org', async () => {
    const queryFn = vi
      .fn()
      // org lookup
      .mockResolvedValueOnce({
        rows: [{ id: 'uuid-1', name: 'Cinema A', slug: 'cinema-a', status: 'active', plan_id: 1 }],
        rowCount: 1,
      })
      // UPDATE status
      .mockResolvedValueOnce({
        rows: [{ id: 'uuid-1', status: 'suspended' }],
        rowCount: 1,
      })
      // audit log insert
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const app = buildApp({ query: queryFn });
    const res = await request(app)
      .post('/api/superadmin/orgs/uuid-1/suspend')
      .set('Authorization', authHeader())
      .send({ reason: 'Non-payment' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when org does not exist', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const app = buildApp({ query: queryFn });

    const res = await request(app)
      .post('/api/superadmin/orgs/nonexistent/suspend')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });
});

// ── POST /api/superadmin/orgs/:id/reactivate ─────────────────────────────────

describe('POST /api/superadmin/orgs/:id/reactivate', () => {
  it('returns 200 and sets status to active', async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ id: 'uuid-1', name: 'Cinema A', slug: 'cinema-a', status: 'suspended', plan_id: 1 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 'uuid-1', status: 'active' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // audit log

    const app = buildApp({ query: queryFn });
    const res = await request(app)
      .post('/api/superadmin/orgs/uuid-1/reactivate')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── PUT /api/superadmin/orgs/:id/plan ────────────────────────────────────────

describe('PUT /api/superadmin/orgs/:id/plan', () => {
  it('returns 200 and updates the plan', async () => {
    const queryFn = vi
      .fn()
      // org lookup
      .mockResolvedValueOnce({
        rows: [{ id: 'uuid-1', name: 'Cinema A', slug: 'cinema-a', status: 'active', plan_id: 1 }],
        rowCount: 1,
      })
      // plan lookup
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Pro' }], rowCount: 1 })
      // UPDATE plan_id
      .mockResolvedValueOnce({ rows: [{ id: 'uuid-1', plan_id: 2 }], rowCount: 1 })
      // audit log
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const app = buildApp({ query: queryFn });
    const res = await request(app)
      .put('/api/superadmin/orgs/uuid-1/plan')
      .set('Authorization', authHeader())
      .send({ plan_id: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when plan_id is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .put('/api/superadmin/orgs/uuid-1/plan')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 when plan does not exist', async () => {
    const queryFn = vi
      .fn()
      // org lookup succeeds
      .mockResolvedValueOnce({
        rows: [{ id: 'uuid-1', name: 'Cinema A', slug: 'cinema-a', status: 'active', plan_id: 1 }],
        rowCount: 1,
      })
      // plan lookup → empty
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const app = buildApp({ query: queryFn });
    const res = await request(app)
      .put('/api/superadmin/orgs/uuid-1/plan')
      .set('Authorization', authHeader())
      .send({ plan_id: 99 });

    expect(res.status).toBe(404);
  });
});

// ── POST /api/superadmin/orgs/:id/reset-trial ────────────────────────────────

describe('POST /api/superadmin/orgs/:id/reset-trial', () => {
  it('returns 200 and resets the trial period', async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ id: 'uuid-1', name: 'Cinema A', slug: 'cinema-a', status: 'trial', plan_id: 1 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 'uuid-1', trial_ends_at: new Date() }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // audit log

    const app = buildApp({ query: queryFn });
    const res = await request(app)
      .post('/api/superadmin/orgs/uuid-1/reset-trial')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── POST /api/superadmin/impersonate ─────────────────────────────────────────

describe('POST /api/superadmin/impersonate', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', 'org-jwt-secret-at-least-32-chars-long!!');
  });

  it('returns 200 with a 1h impersonation JWT', async () => {
    const queryFn = vi
      .fn()
      // org lookup by slug
      .mockResolvedValueOnce({
        rows: [{ id: 'uuid-1', name: 'Cinema A', slug: 'cinema-a', status: 'active', plan_id: 1 }],
        rowCount: 1,
      })
      // audit log insert
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const app = buildApp({ query: queryFn });
    const res = await request(app)
      .post('/api/superadmin/impersonate')
      .set('Authorization', authHeader())
      .send({ org_slug: 'cinema-a' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();

    // Token should be an org JWT (signed with JWT_SECRET)
    const decoded = jwt.verify(res.body.token, 'org-jwt-secret-at-least-32-chars-long!!') as Record<string, unknown>;
    expect(decoded.org_slug).toBe('cinema-a');
    expect(decoded.impersonated_by).toBe(1); // superadmin id
    expect(decoded.impersonation).toBe(true);
  });

  it('returns 400 when org_slug is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/superadmin/impersonate')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 when org does not exist', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const app = buildApp({ query: queryFn });

    const res = await request(app)
      .post('/api/superadmin/impersonate')
      .set('Authorization', authHeader())
      .send({ org_slug: 'does-not-exist' });

    expect(res.status).toBe(404);
  });
});

// ── GET /api/superadmin/audit-log ─────────────────────────────────────────────

describe('GET /api/superadmin/audit-log', () => {
  it('returns 200 with paginated audit log entries', async () => {
    const queryFn = vi
      .fn()
      // count query
      .mockResolvedValueOnce({ rows: [{ total: '42' }], rowCount: 1 })
      // rows query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            actor_id: 1,
            action: 'suspend_org',
            target_type: 'organization',
            target_id: 'uuid-1',
            metadata: {},
            created_at: new Date('2026-01-01T00:00:00Z'),
          },
        ],
        rowCount: 1,
      });

    const app = buildApp({ query: queryFn });
    const res = await request(app)
      .get('/api/superadmin/audit-log')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeDefined();
    expect(res.body.page).toBeDefined();
    expect(res.body.limit).toBeDefined();
  });

  it('supports ?page= and ?limit= query params', async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ total: '100' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const app = buildApp({ query: queryFn });
    const res = await request(app)
      .get('/api/superadmin/audit-log?page=2&limit=20')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(20);
    // Offset should be (page-1) * limit = 20
    const rowsQueryCall = queryFn.mock.calls[1];
    expect(rowsQueryCall[1]).toContain(20); // offset
  });

  it('returns 401 when not authenticated', async () => {
    const { requireSuperadmin } = await import('../middleware/superadmin-auth.js');
    vi.mocked(requireSuperadmin).mockImplementationOnce((_req, res, _next) => {
      res.status(401).json({ success: false, error: 'Unauthorized' });
    });

    const app = buildApp();
    const res = await request(app).get('/api/superadmin/audit-log');

    expect(res.status).toBe(401);
  });
});
