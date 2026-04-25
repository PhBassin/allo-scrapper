import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { DB, Pool } from '../db/types.js';

const createOrgMock = vi.fn();
const createAdminUserMock = vi.fn();

vi.mock('../services/org-service.js', () => ({
  createOrg: createOrgMock,
}));

vi.mock('../services/saas-auth-service.js', () => ({
  SaasAuthService: class {
    createAdminUser = createAdminUserMock;
  },
}));

function buildApp(db: DB, pool: Pool) {
  const app = express();
  app.use(express.json());
  app.set('db', db);
  app.set('pool', pool);
  return app;
}

function createMockPoolClient() {
  const callBySql = new Map<string, number>();
  const query = vi.fn().mockImplementation((sql: string) => {
    if (sql.includes('SELECT id') && sql.includes('FROM roles') && sql.includes("name <> 'admin'")) {
      return Promise.resolve({ rows: [{ id: 3 }], rowCount: 1 });
    }
    if (sql.includes('SELECT COUNT(*)::text AS count FROM users')) {
      return Promise.resolve({ rows: [{ count: '2' }], rowCount: 1 });
    }
    if (sql.includes('SELECT COUNT(*)::text AS count FROM cinemas')) {
      return Promise.resolve({ rows: [{ count: '3' }], rowCount: 1 });
    }
    if (sql.includes('SELECT COUNT(*)::text AS count FROM showtimes')) {
      return Promise.resolve({ rows: [{ count: '10' }], rowCount: 1 });
    }

    const priorCalls = callBySql.get(sql) ?? 0;
    callBySql.set(sql, priorCalls + 1);

    if (sql.includes('INSERT INTO users')) {
      // First user is inserted by createAdminUser in real flow, second by seed helper.
      // Simulate "already exists" on repeated seed calls.
      const inserted = priorCalls === 0 ? 1 : 0;
      return Promise.resolve({ rows: [], rowCount: inserted });
    }

    return Promise.resolve({ rows: [], rowCount: 1 });
  });

  return {
    query,
    release: vi.fn(),
  };
}

describe('test fixture routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'test');
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('POST /test/seed-org returns org metadata and seeded counts', async () => {
    const mockDb = {
      query: vi.fn(),
    } as unknown as DB;

    const mockClient = createMockPoolClient();

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    createOrgMock.mockResolvedValue({
      org: {
        id: 41,
        slug: 'e2e-fixture-a',
        schema_name: 'org_e2e_fixture_a',
      },
    });

    createAdminUserMock.mockResolvedValue({
      id: 7,
      username: 'admin@fixture.local',
    });

    const app = buildApp(mockDb, mockPool);
    const { createTestFixturesRouter } = await import('./test-fixtures.js');
    app.use('/test', createTestFixturesRouter());

    const res = await request(app)
      .post('/test/seed-org')
      .send({ slug: 'e2e-fixture-a', name: 'Fixture A' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.org_id).toBe(41);
    expect(res.body.data.org_slug).toBe('e2e-fixture-a');
    expect(res.body.data.schema_name).toBe('org_e2e_fixture_a');
    expect(res.body.data.plan_id).toBe(1);
    expect(res.body.data.admin.username).toBe('admin@fixture.local');
    expect(res.body.data.admin.password).toBeTypeOf('string');
    expect(res.body.data.seeded).toMatchObject({
      users: 2,
      cinemas: 3,
      schedules: 10,
    });
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('SET LOCAL search_path TO'));
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO cinemas'), expect.any(Array));
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO showtimes'), expect.any(Array));
  });

  it('POST /test/seed-org supports concurrent calls with unique org ids/slugs', async () => {
    const mockDb = {
      query: vi.fn(),
    } as unknown as DB;

    const mockClient = createMockPoolClient();
    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    createOrgMock
      .mockResolvedValueOnce({ org: { id: 501, slug: 'e2e-a', schema_name: 'org_e2e_a' } })
      .mockResolvedValueOnce({ org: { id: 502, slug: 'e2e-b', schema_name: 'org_e2e_b' } })
      .mockResolvedValueOnce({ org: { id: 503, slug: 'e2e-c', schema_name: 'org_e2e_c' } })
      .mockResolvedValueOnce({ org: { id: 504, slug: 'e2e-d', schema_name: 'org_e2e_d' } });

    createAdminUserMock.mockImplementation(async (_org, email: string) => ({
      id: 9,
      username: email,
    }));

    const app = buildApp(mockDb, mockPool);
    const { createTestFixturesRouter } = await import('./test-fixtures.js');
    app.use('/test', createTestFixturesRouter());

    const responses = await Promise.all([
      request(app).post('/test/seed-org').send({ slug: 'e2e-a' }),
      request(app).post('/test/seed-org').send({ slug: 'e2e-b' }),
      request(app).post('/test/seed-org').send({ slug: 'e2e-c' }),
      request(app).post('/test/seed-org').send({ slug: 'e2e-d' }),
    ]);

    responses.forEach((res) => {
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    const orgIds = new Set(responses.map((res) => res.body.data.org_id));
    const slugs = new Set(responses.map((res) => res.body.data.org_slug));
    const adminUsernames = new Set(responses.map((res) => res.body.data.admin.username));

    expect(orgIds.size).toBe(4);
    expect(slugs.size).toBe(4);
    expect(adminUsernames.size).toBe(4);

    const cinemaInsertCalls = mockClient.query.mock.calls
      .filter((call) => typeof call[0] === 'string' && (call[0] as string).includes('INSERT INTO cinemas'));
    const cinemaNames = new Set(cinemaInsertCalls.map((call) => call[1]?.[1] as string));
    expect(cinemaNames.size).toBeGreaterThanOrEqual(12);
  });

  it('POST /test/seed-org accepts an explicit plan id', async () => {
    const mockDb = {
      query: vi.fn(),
    } as unknown as DB;

    const mockClient = createMockPoolClient();
    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    createOrgMock.mockResolvedValue({
      org: {
        id: 601,
        slug: 'e2e-starter',
        schema_name: 'org_e2e_starter',
      },
    });

    createAdminUserMock.mockResolvedValue({
      id: 9,
      username: 'starter-admin@test.local',
    });

    const app = buildApp(mockDb, mockPool);
    const { createTestFixturesRouter } = await import('./test-fixtures.js');
    app.use('/test', createTestFixturesRouter());

    const res = await request(app)
      .post('/test/seed-org')
      .send({ slug: 'e2e-starter', planId: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.plan_id).toBe(2);
    expect(createOrgMock).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        slug: 'e2e-starter',
        plan_id: 2,
      }),
      mockPool,
    );
  });

  it('POST /test/seed-org returns 404 outside test mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const mockDb = { query: vi.fn() } as unknown as DB;
    const mockPool = { connect: vi.fn() } as unknown as Pool;
    const app = buildApp(mockDb, mockPool);

    const { createTestFixturesRouter } = await import('./test-fixtures.js');
    app.use('/test', createTestFixturesRouter());

    const res = await request(app).post('/test/seed-org').send({});

    expect(res.status).toBe(404);
  });

  it('POST /test/seed-org returns org metadata when fixture mode is explicitly enabled outside test mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('E2E_ENABLE_ORG_FIXTURE', 'true');

    const mockDb = {
      query: vi.fn(),
    } as unknown as DB;

    const mockClient = createMockPoolClient();

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    createOrgMock.mockResolvedValue({
      org: {
        id: 42,
        slug: 'e2e-fixture-dev',
        schema_name: 'org_e2e_fixture_dev',
      },
    });

    createAdminUserMock.mockResolvedValue({
      id: 8,
      username: 'admin-dev@fixture.local',
    });

    const app = buildApp(mockDb, mockPool);
    const { createTestFixturesRouter } = await import('./test-fixtures.js');
    app.use('/test', createTestFixturesRouter());

    const res = await request(app)
      .post('/test/seed-org')
      .send({ slug: 'e2e-fixture-dev', name: 'Fixture Dev' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.org_slug).toBe('e2e-fixture-dev');
  });

  it('DELETE /test/cleanup-org/:id removes schema and org row', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [{ id: 41, slug: 'e2e-fixture-a', schema_name: 'org_e2e_fixture_a' }],
        rowCount: 1,
      }),
    } as unknown as DB;

    const mockClient = createMockPoolClient();

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    const app = buildApp(mockDb, mockPool);
    const { createTestFixturesRouter } = await import('./test-fixtures.js');
    app.use('/test', createTestFixturesRouter());

    const res = await request(app).delete('/test/cleanup-org/41');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('DROP SCHEMA IF EXISTS "org_e2e_fixture_a" CASCADE');
    expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM organizations WHERE id = $1', [41]);
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });

  it('DELETE /test/cleanup-org/:id returns 404 for unknown org', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    } as unknown as DB;

    const mockPool = {
      connect: vi.fn(),
    } as unknown as Pool;

    const app = buildApp(mockDb, mockPool);
    const { createTestFixturesRouter } = await import('./test-fixtures.js');
    app.use('/test', createTestFixturesRouter());

    const res = await request(app).delete('/test/cleanup-org/9999');

    expect(res.status).toBe(404);
  });

  it('DELETE /test/cleanup-org/:id returns 404 outside test mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const mockDb = { query: vi.fn() } as unknown as DB;
    const mockPool = { connect: vi.fn() } as unknown as Pool;
    const app = buildApp(mockDb, mockPool);

    const { createTestFixturesRouter } = await import('./test-fixtures.js');
    app.use('/test', createTestFixturesRouter());

    const res = await request(app).delete('/test/cleanup-org/41');

    expect(res.status).toBe(404);
  });

  it('DELETE /test/cleanup-org/:id works when fixture mode is explicitly enabled outside test mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('E2E_ENABLE_ORG_FIXTURE', 'true');

    const mockDb = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [{ id: 41, slug: 'e2e-fixture-a', schema_name: 'org_e2e_fixture_a' }],
        rowCount: 1,
      }),
    } as unknown as DB;

    const mockClient = createMockPoolClient();

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    const app = buildApp(mockDb, mockPool);
    const { createTestFixturesRouter } = await import('./test-fixtures.js');
    app.use('/test', createTestFixturesRouter());

    const res = await request(app).delete('/test/cleanup-org/41');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('DELETE /test/cleanup-org/:id refuses non-fixture organizations', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [{ id: 7, slug: 'customer-prod', schema_name: 'org_customer_prod' }],
        rowCount: 1,
      }),
    } as unknown as DB;

    const mockPool = {
      connect: vi.fn(),
    } as unknown as Pool;

    const app = buildApp(mockDb, mockPool);
    const { createTestFixturesRouter } = await import('./test-fixtures.js');
    app.use('/test', createTestFixturesRouter());

    const res = await request(app).delete('/test/cleanup-org/7');

    expect(res.status).toBe(403);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it('DELETE /test/cleanup-org/:id only deletes requested org during parallel cleanup', async () => {
    const mockDb = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 41, slug: 'e2e-a', schema_name: 'org_e2e_a' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 42, slug: 'e2e-b', schema_name: 'org_e2e_b' }], rowCount: 1 }),
    } as unknown as DB;

    const clientA = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      release: vi.fn(),
    };
    const clientB = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn()
        .mockResolvedValueOnce(clientA)
        .mockResolvedValueOnce(clientB),
    } as unknown as Pool;

    const app = buildApp(mockDb, mockPool);
    const { createTestFixturesRouter } = await import('./test-fixtures.js');
    app.use('/test', createTestFixturesRouter());

    const [resA, resB] = await Promise.all([
      request(app).delete('/test/cleanup-org/41'),
      request(app).delete('/test/cleanup-org/42'),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(clientA.query).toHaveBeenCalledWith('DELETE FROM organizations WHERE id = $1', [41]);
    expect(clientB.query).toHaveBeenCalledWith('DELETE FROM organizations WHERE id = $1', [42]);
  });
});
