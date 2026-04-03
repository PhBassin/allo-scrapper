/**
 * RED tests for org routes (ping endpoint).
 */
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

function makeOrg(status = 'active') {
  return { id: 1, slug: 'acme', name: 'Acme Cinema', schema_name: 'org_acme', status };
}

function buildApp(orgStatus = 'active') {
  const app = express();
  app.use(express.json());

  const org = makeOrg(orgStatus);
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [org], rowCount: 1 }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn().mockResolvedValue(client) };
  app.set('pool', pool);
  return app;
}

describe('GET /api/org/:slug/ping', () => {
  it('returns 200 with org info for active org', async () => {
    const app = buildApp('active');
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/ping');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.org.slug).toBe('acme');
  });

  it('returns 200 with org info for trial org', async () => {
    const app = buildApp('trial');
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/ping');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
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
    const app = buildApp('suspended');
    const { createOrgRouter } = await import('./org.js');
    app.use('/api/org/:slug', createOrgRouter());

    const res = await request(app).get('/api/org/acme/ping');
    expect(res.status).toBe(403);
  });
});
