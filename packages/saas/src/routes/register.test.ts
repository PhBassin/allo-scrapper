import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import { createRegisterRouter, createSlugRouter } from './register.js';
import type { DB, Pool } from '../db/types.js';

// ── module mocks ─────────────────────────────────────────────────────────────

// Mock org-service so we don't hit the filesystem (bootstrapOrgSchema reads SQL files)
vi.mock('../services/org-service.js', () => ({
  createOrg: vi.fn().mockResolvedValue({
    org: {
      id: 'org-uuid-1',
      name: 'My Cinema',
      slug: 'my-cinema',
      plan_id: 1,
      status: 'trial',
      schema_name: 'org_my_cinema',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      created_at: new Date(),
      updated_at: new Date(),
    },
    schemaCreated: true,
  }),
}));

// Mock org-queries for slug availability check
vi.mock('../db/org-queries.js', () => ({
  isSlugAvailable: vi.fn().mockResolvedValue(true),
  getOrgBySlug: vi.fn(),
  insertOrg: vi.fn(),
  slugToSchemaName: vi.fn((s: string) => `org_${s.replace(/-/g, '_')}`),
}));

// ── helpers ──────────────────────────────────────────────────────────────────

const VALID_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';

function makeDb(): DB {
  return { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
}

function makePool() {
  const newUser = { id: 1, username: 'admin@my-cinema.com', role_id: 1, role_name: 'admin' };
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [newUser], rowCount: 1 }),
    release: vi.fn(),
  };
  return { pool: { connect: vi.fn().mockResolvedValue(client) }, client };
}

function buildApp(db: DB, pool: Pool): Express {
  const app = express();
  app.use(express.json());
  app.set('db', db);
  app.set('pool', pool);
  app.use('/api', createSlugRouter());
  app.use('/api', createRegisterRouter());
  return app;
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('GET /api/orgs/:slug/available', () => {
  it('returns available:true when slug is free', async () => {
    const { isSlugAvailable } = await import('../db/org-queries.js');
    vi.mocked(isSlugAvailable).mockResolvedValueOnce(true);

    const { pool } = makePool();
    const app = buildApp(makeDb(), pool);

    const { default: supertest } = await import('supertest');
    const response = await supertest(app).get('/api/orgs/free-slug/available');

    expect(response.status).toBe(200);
    expect(response.body.available).toBe(true);
  });

  it('returns available:false when slug is taken', async () => {
    const { isSlugAvailable } = await import('../db/org-queries.js');
    vi.mocked(isSlugAvailable).mockResolvedValueOnce(false);

    const { pool } = makePool();
    const app = buildApp(makeDb(), pool);

    const { default: supertest } = await import('supertest');
    const response = await supertest(app).get('/api/orgs/taken-slug/available');

    expect(response.status).toBe(200);
    expect(response.body.available).toBe(false);
  });

  it('returns 400 on invalid slug format', async () => {
    const { pool } = makePool();
    const app = buildApp(makeDb(), pool);

    const { default: supertest } = await import('supertest');
    const response = await supertest(app).get('/api/orgs/INVALID_SLUG/available');

    expect(response.status).toBe(400);
  });
});

describe('POST /api/auth/register (SaaS)', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', VALID_JWT_SECRET);
    vi.stubEnv('JWT_EXPIRES_IN', '24h');
  });

  it('returns 201 with org, admin user, and JWT token on success', async () => {
    const { pool } = makePool();
    const app = buildApp(makeDb(), pool);

    const { default: supertest } = await import('supertest');
    const response = await supertest(app)
      .post('/api/auth/register')
      .send({
        orgName: 'My Cinema',
        slug: 'my-cinema',
        adminEmail: 'admin@my-cinema.com',
        adminPassword: 'Password1!',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.org).toBeDefined();
    expect(response.body.org.slug).toBe('my-cinema');
    // Admin user must be in the response
    expect(response.body.admin).toBeDefined();
    expect(response.body.admin.username).toBe('admin@my-cinema.com');
    // JWT token must be present
    expect(response.body.token).toBeDefined();
    expect(typeof response.body.token).toBe('string');
    expect(response.body.token.split('.')).toHaveLength(3);
  });

  it('returns 409 when slug is already taken', async () => {
    const { isSlugAvailable } = await import('../db/org-queries.js');
    vi.mocked(isSlugAvailable).mockResolvedValueOnce(false);

    const { pool } = makePool();
    const app = buildApp(makeDb(), pool);

    const { default: supertest } = await import('supertest');
    const response = await supertest(app)
      .post('/api/auth/register')
      .send({
        orgName: 'My Cinema',
        slug: 'my-cinema',
        adminEmail: 'admin@my-cinema.com',
        adminPassword: 'Password1!',
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it('returns 400 on missing required fields', async () => {
    const { pool } = makePool();
    const app = buildApp(makeDb(), pool);

    const { default: supertest } = await import('supertest');
    const response = await supertest(app)
      .post('/api/auth/register')
      .send({ orgName: 'X', slug: 'x' }); // missing email + password

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errors).toBeDefined();
  });

  it('JWT payload contains org_id and org_slug', async () => {
    const { pool } = makePool();
    const app = buildApp(makeDb(), pool);

    const { default: supertest } = await import('supertest');
    const response = await supertest(app)
      .post('/api/auth/register')
      .send({
        orgName: 'My Cinema',
        slug: 'my-cinema',
        adminEmail: 'admin@my-cinema.com',
        adminPassword: 'Password1!',
      });

    expect(response.status).toBe(201);

    const token = response.body.token as string;
    const payloadB64 = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    expect(payload.org_id).toBe('org-uuid-1');
    expect(payload.org_slug).toBe('my-cinema');
  });
});
