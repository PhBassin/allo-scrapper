import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTestFixturesRouter } from './test-fixtures.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  return app;
}

describe('test fixture routes', () => {
  const createdOrgIds = new Set<number>();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    createdOrgIds.clear();
  });

  it('returns 201 from POST /test/seed-org and includes fixture payload', async () => {
    process.env.NODE_ENV = 'test';
    const app = buildApp();

    const createOrgFn = vi.fn().mockResolvedValue({
      org: {
        id: 101,
        slug: 'test-org-101',
        schema_name: 'org_test_org_101',
      },
    });
    const createAdminUserFn = vi.fn().mockResolvedValue({ id: 1, username: 'admin@test.local' });
    const seedOrgDataFn = vi.fn().mockResolvedValue({ users: 2, cinemas: 3, showtimes: 10 });

    app.use('/test', createTestFixturesRouter({ createOrgFn, createAdminUserFn, seedOrgDataFn }));

    const res = await request(app)
      .post('/test/seed-org')
      .send({ slug: 'test-org-101', name: 'Test Org 101' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.org_id).toBe(101);
    expect(res.body.data.org_slug).toBe('test-org-101');
    expect(res.body.data.schema_name).toBe('org_test_org_101');
    expect(res.body.data.seeded_counts).toEqual({ users: 2, cinemas: 3, showtimes: 10 });
    expect(typeof res.body.data.duration_ms).toBe('number');

    expect(createOrgFn).toHaveBeenCalledOnce();
    expect(createAdminUserFn).toHaveBeenCalledOnce();
    expect(seedOrgDataFn).toHaveBeenCalledOnce();

    createdOrgIds.add(res.body.data.org_id);
  });

  it('returns 404 from POST /test/seed-org when NODE_ENV is not test', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildApp();
    app.use('/test', createTestFixturesRouter());

    const res = await request(app).post('/test/seed-org').send({});

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 from DELETE /test/cleanup-org/:id and marks deleted', async () => {
    process.env.NODE_ENV = 'test';
    const app = buildApp();

    const cleanupOrgFn = vi.fn().mockResolvedValue({ orgId: 101, deleted: true });
    app.set('db', { query: vi.fn() });
    app.use('/test', createTestFixturesRouter({ cleanupOrgFn }));

    const res = await request(app).delete('/test/cleanup-org/101');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.org_id).toBe(101);
    expect(res.body.data.deleted).toBe(true);
    expect(typeof res.body.data.duration_ms).toBe('number');
    expect(cleanupOrgFn).toHaveBeenCalledOnce();
  });

  it('supports `/api/test/*` compatibility alias for seed and cleanup', async () => {
    process.env.NODE_ENV = 'test';
    const app = buildApp();

    const createOrgFn = vi.fn().mockResolvedValue({
      org: {
        id: 202,
        slug: 'api-alias-org',
        schema_name: 'org_api_alias_org',
      },
    });
    const createAdminUserFn = vi.fn().mockResolvedValue({ id: 2, username: 'admin-alias@test.local' });
    const seedOrgDataFn = vi.fn().mockResolvedValue({ users: 2, cinemas: 3, showtimes: 10 });
    const cleanupOrgFn = vi.fn().mockResolvedValue({ orgId: 202, deleted: true });

    app.set('db', { query: vi.fn() });
    app.set('pool', { connect: vi.fn() });
    app.use('/api/test', createTestFixturesRouter({ createOrgFn, createAdminUserFn, seedOrgDataFn, cleanupOrgFn }));

    const seedRes = await request(app).post('/api/test/seed-org').send({ slug: 'api-alias-org' });
    expect(seedRes.status).toBe(201);
    expect(seedRes.body.success).toBe(true);

    const cleanupRes = await request(app).delete('/api/test/cleanup-org/202');
    expect(cleanupRes.status).toBe(200);
    expect(cleanupRes.body.success).toBe(true);
  });

  it('returns 404 when fixture routes are not mounted in non-test mode', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildApp();

    const res = await request(app).post('/test/seed-org').send({});
    expect(res.status).toBe(404);
  });

  it('returns 404 from DELETE /test/cleanup-org/:id when org does not exist', async () => {
    process.env.NODE_ENV = 'test';
    const app = buildApp();

    const cleanupOrgFn = vi.fn().mockResolvedValue({ orgId: 999, deleted: false });
    app.set('db', { query: vi.fn() });
    app.use('/test', createTestFixturesRouter({ cleanupOrgFn }));

    const res = await request(app).delete('/test/cleanup-org/999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('creates 4 organizations in parallel without collisions', async () => {
    process.env.NODE_ENV = 'test';
    const app = buildApp();

    let orgCounter = 1000;
    const createOrgFn = vi.fn().mockImplementation(async (_db, input: { slug: string }) => {
      orgCounter += 1;
      return {
        org: {
          id: orgCounter,
          slug: input.slug,
          schema_name: `org_${input.slug.replace(/-/g, '_')}`,
        },
      };
    });
    const createAdminUserFn = vi.fn().mockImplementation(async (_pool, org: { id: number }) => {
      return { id: org.id, username: `admin-${org.id}@test.local` };
    });
    const seedOrgDataFn = vi.fn().mockResolvedValue({ users: 2, cinemas: 3, showtimes: 10 });

    app.use('/test', createTestFixturesRouter({ createOrgFn, createAdminUserFn, seedOrgDataFn }));

    const startedAt = Date.now();
    const responses = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        request(app)
          .post('/test/seed-org')
          .send({ slug: `parallel-org-${i}` })
      )
    );
    const duration = Date.now() - startedAt;

    for (const res of responses) {
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.seeded_counts).toEqual({ users: 2, cinemas: 3, showtimes: 10 });
      expect(res.body.data.duration_ms).toBeLessThan(500);
    }

    const orgIds = responses.map((r) => r.body.data.org_id);
    const uniqueOrgIds = new Set(orgIds);
    expect(uniqueOrgIds.size).toBe(4);
    expect(duration).toBeLessThan(1500);

    for (const orgId of orgIds) {
      createdOrgIds.add(orgId);
    }
  });

  it('isolates cleanup calls in parallel and keeps other org data intact', async () => {
    process.env.NODE_ENV = 'test';
    const app = buildApp();

    const existing = new Set([11, 12, 13, 14]);
    const cleanupOrgFn = vi.fn().mockImplementation(async (_db, orgId: number) => {
      const deleted = existing.delete(orgId);
      return { orgId, deleted };
    });

    app.set('db', { query: vi.fn() });
    app.use('/test', createTestFixturesRouter({ cleanupOrgFn }));

    const startedAt = Date.now();
    const responses = await Promise.all([
      request(app).delete('/test/cleanup-org/11'),
      request(app).delete('/test/cleanup-org/12'),
      request(app).delete('/test/cleanup-org/13'),
    ]);
    const duration = Date.now() - startedAt;

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
      expect(res.body.data.duration_ms).toBeLessThan(200);
    }

    expect(existing.has(14)).toBe(true);
    expect(duration).toBeLessThan(1000);
  });
});
