// IMPORTANT: mock jwt-secret-validator BEFORE importing auth middleware,
// since auth.ts calls validateJWTSecret() at module load time and caches the result.
import { vi } from 'vitest';

const SECRET = 'test-auth-middleware-secret-at-least-32-chars!!';

vi.mock('../utils/jwt-secret-validator.js', () => ({
  // Use literal — vi.mock factory is hoisted before const SECRET is initialised
  validateJWTSecret: vi.fn(() => 'test-auth-middleware-secret-at-least-32-chars!!'),
  FORBIDDEN_SECRETS: [],
}));

import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import express, { type Response } from 'express';
import request from 'supertest';
import { requireAuth, type AuthRequest } from './auth.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  // lgtm[js/missing-rate-limiting] -- test harness, not a real route
  app.get('/protected', requireAuth, (req: AuthRequest, res: Response) => { // lgtm[js/missing-rate-limiting]
    res.json({ success: true, user: req.user });
  });
  return app;
}

function signStandalone(overrides = {}) {
  return jwt.sign(
    {
      id: 1,
      username: 'alice',
      role_name: 'admin',
      is_system_role: true,
      permissions: ['settings:read'],
      ...overrides,
    },
    SECRET,
    { expiresIn: '1h' },
  );
}

function signSaas(overrides = {}) {
  return jwt.sign(
    {
      id: 42,
      username: 'admin@my-cinema.com',
      org_id: 'org-uuid-1',
      org_slug: 'my-cinema',
      role_id: 1,
      role_name: 'admin',
      permissions: [],
      ...overrides,
    },
    SECRET,
    { expiresIn: '1h' },
  );
}

describe('requireAuth middleware', () => {
  // ── rejection cases ───────────────────────────────────────────────────────

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(makeApp()).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when Authorization header is not a Bearer token', async () => {
    const res = await request(makeApp())
      .get('/protected')
      .set('Authorization', 'Basic dXNlcjpwYXNz');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for an expired token', async () => {
    const token = jwt.sign({ id: 1, username: 'alice' }, SECRET, { expiresIn: '-1s' });
    const res = await request(makeApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for a token signed with the wrong secret', async () => {
    const token = jwt.sign({ id: 1, username: 'alice' }, 'totally-wrong-secret-32-chars!!--');
    const res = await request(makeApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ── standalone JWT (no org fields) ───────────────────────────────────────

  it('accepts a standalone JWT and populates req.user', async () => {
    const token = signStandalone();
    const res = await request(makeApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(1);
    expect(res.body.user.username).toBe('alice');
    expect(res.body.user.role_name).toBe('admin');
    expect(res.body.user.is_system_role).toBe(true);
    expect(res.body.user.permissions).toEqual(['settings:read']);
  });

  it('standalone JWT: req.user.org_id and org_slug are absent', async () => {
    const token = signStandalone();
    const res = await request(makeApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.org_id).toBeUndefined();
    expect(res.body.user.org_slug).toBeUndefined();
  });

  // ── SaaS JWT (with org_id + org_slug) ────────────────────────────────────

  it('accepts a SaaS JWT and populates req.user with org_id and org_slug', async () => {
    const token = signSaas();
    const res = await request(makeApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(42);
    expect(res.body.user.username).toBe('admin@my-cinema.com');
    expect(res.body.user.org_id).toBe('org-uuid-1');
    expect(res.body.user.org_slug).toBe('my-cinema');
    expect(res.body.user.role_name).toBe('admin');
  });

  it('SaaS JWT: is_system_role defaults to false when absent from payload', async () => {
    const token = signSaas();
    const res = await request(makeApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.is_system_role).toBe(false);
  });
});
