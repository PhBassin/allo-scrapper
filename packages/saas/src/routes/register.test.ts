/**
 * RED tests for register routes.
 * Uses supertest against a minimal express app stub.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const SLUG_VALID = 'my-cinema';
const JWT_SECRET = 'local-dev-jwt-fixture-key-1234567890abcd';

function buildApp(dbOverride?: object, poolOverride?: object) {
  const app = express();
  app.use(express.json());

  // Default stubs
  const db = dbOverride ?? {
    query: vi.fn().mockResolvedValue({ rows: [{ count: '0' }], rowCount: 1 }),
  };
  const pool = poolOverride ?? {
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 1, username: 'admin@acme.com', role_id: 1, role_name: 'admin' }],
        rowCount: 1,
      }),
      release: vi.fn(),
    }),
  };
  app.set('db', db);
  app.set('pool', pool);

  return app;
}

describe('POST /api/saas/orgs (register)', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', JWT_SECRET);
  });

  it('returns 400 when orgName is missing', async () => {
    const app = buildApp();
    const { createRegisterRouter } = await import('./register.js');
    app.use('/api', createRegisterRouter());

    const res = await request(app)
      .post('/api/saas/orgs')
      .send({ slug: SLUG_VALID, adminEmail: 'a@b.com', adminPassword: 'password1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when slug is invalid', async () => {
    const app = buildApp();
    const { createRegisterRouter } = await import('./register.js');
    app.use('/api', createRegisterRouter());

    const res = await request(app)
      .post('/api/saas/orgs')
      .send({ orgName: 'Acme', slug: 'A!', adminEmail: 'a@b.com', adminPassword: 'password1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when adminPassword is too short', async () => {
    const app = buildApp();
    const { createRegisterRouter } = await import('./register.js');
    app.use('/api', createRegisterRouter());

    const res = await request(app)
      .post('/api/saas/orgs')
      .send({ orgName: 'Acme', slug: SLUG_VALID, adminEmail: 'a@b.com', adminPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 when slug is already taken', async () => {
    // DB always returns count=1 → slug taken
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ count: '1' }], rowCount: 1 }) };
    const app = buildApp(db);
    const { createRegisterRouter } = await import('./register.js');
    app.use('/api', createRegisterRouter());

    const res = await request(app)
      .post('/api/saas/orgs')
      .send({ orgName: 'Acme', slug: SLUG_VALID, adminEmail: 'a@b.com', adminPassword: 'password1' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 201 with token and org on success', async () => {
    const org = {
      id: 1, name: 'Acme', slug: SLUG_VALID,
      schema_name: 'org_my_cinema', status: 'trial', trial_ends_at: new Date().toISOString(),
    };
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 }),
    };
    const poolQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [org], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 1, username: 'admin@acme.com', role_id: 1, role_name: 'admin' }], rowCount: 1 });
    const pool = {
      connect: vi.fn().mockResolvedValue({
        query: poolQuery,
        release: vi.fn(),
      }),
    };
    const app = buildApp(db, pool);
    const { createRegisterRouter } = await import('./register.js');
    app.use('/api', createRegisterRouter());

    const res = await request(app)
      .post('/api/saas/orgs')
      .send({ orgName: 'Acme', slug: SLUG_VALID, adminEmail: 'admin@acme.com', adminPassword: 'password1' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.org.slug).toBe(SLUG_VALID);
  });
});

describe('GET /api/saas/orgs/:slug/available', () => {
  it('returns available: true when slug is free', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ count: '0' }], rowCount: 1 }) };
    const app = buildApp(db);
    const { createRegisterRouter } = await import('./register.js');
    app.use('/api', createRegisterRouter());

    const res = await request(app).get(`/api/saas/orgs/${SLUG_VALID}/available`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
  });

  it('returns available: false when slug is taken', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ count: '1' }], rowCount: 1 }) };
    const app = buildApp(db);
    const { createRegisterRouter } = await import('./register.js');
    app.use('/api', createRegisterRouter());

    const res = await request(app).get(`/api/saas/orgs/${SLUG_VALID}/available`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  it('returns 400 for invalid slug format', async () => {
    const app = buildApp();
    const { createRegisterRouter } = await import('./register.js');
    app.use('/api', createRegisterRouter());

    const res = await request(app).get('/api/saas/orgs/A!/available');
    expect(res.status).toBe(400);
  });
});
