/**
 * RED tests for auth middleware.
 *
 * Covers:
 *  1. Standalone JWT (no org_id/org_slug) — backward compat must pass
 *  2. Org-aware JWT (contains org_id + org_slug) — must populate req.user correctly
 */

// IMPORTANT: Set JWT_SECRET BEFORE any imports — auth.ts reads it at module load time
process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';

function makeStandaloneToken(): string {
  return jwt.sign(
    {
      id: 1,
      username: 'alice',
      role_name: 'admin',
      is_system_role: true,
      permissions: [],
    },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function makeOrgAwareToken(orgId: number, orgSlug: string): string {
  return jwt.sign(
    {
      id: 2,
      username: 'bob',
      role_name: 'editor',
      is_system_role: false,
      permissions: [],
      org_id: orgId,
      org_slug: orgSlug,
    },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function buildApp() {
  const { requireAuth } = await import('./auth.js');
  const app = express();
  app.use(express.json());
  app.get('/protected', requireAuth, (req: any, res) => { // codeql[js/missing-rate-limiting] - test-only helper, no real network exposure
    res.json({ user: req.user });
  });
  return app;
}

describe('requireAuth — standalone JWT (no org_id)', () => {
  it('returns 200 and req.user when standalone JWT is valid', async () => {
    const app = await buildApp();
    const token = makeStandaloneToken();

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('alice');
    expect(res.body.user.role_name).toBe('admin');
    // org_id and org_slug are not present (standalone token)
    expect(res.body.user.org_id).toBeUndefined();
    expect(res.body.user.org_slug).toBeUndefined();
  });

  it('returns 401 when no token is provided', async () => {
    const app = await buildApp();
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const app = await buildApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

describe('requireAuth — org-aware JWT (with org_id + org_slug)', () => {
  it('returns 200 and populates org_id and org_slug on req.user', async () => {
    const app = await buildApp();
    const token = makeOrgAwareToken(42, 'acme');

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('bob');
    expect(res.body.user.org_id).toBe(42);
    expect(res.body.user.org_slug).toBe('acme');
  });

  it('org_id and org_slug are optional — token without them still works', async () => {
    const app = await buildApp();
    const token = makeStandaloneToken();

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Should NOT fail just because org_id/org_slug are absent
    expect(res.body.user.id).toBe(1);
  });
});
