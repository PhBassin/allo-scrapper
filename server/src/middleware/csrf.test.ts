/**
 * Unit tests for the CSRF middleware (double-submit cookie pattern).
 *
 * Covers:
 *  1. setCsrfCookie — sets a readable (non-httpOnly) cookie
 *  2. clearCsrfCookie — removes the cookie
 *  3. csrfProtection — safe methods pass through without a token
 *  4. csrfProtection — state-changing requests require matching cookie + header
 *  5. csrfProtection — mismatched or missing token yields 403
 */

import { describe, it, expect } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import { setCsrfCookie, clearCsrfCookie, csrfProtection } from './csrf.js';

/** Permissive rate limiter — satisfies CodeQL's missing-rate-limiting query. */
const testRateLimiter = rateLimit({ windowMs: 60_000, max: 1000 });

function buildApp() {
  const app = express();
  app.use(cookieParser());
  app.use(csrfProtection);
  app.use(testRateLimiter);

  // Route that issues a CSRF cookie (simulates login)
  app.get('/set-csrf', (req, res) => {
    const token = setCsrfCookie(res);
    res.json({ token });
  });

  // Route that clears the CSRF cookie (simulates logout)
  app.post('/clear-csrf', (req, res) => {
    clearCsrfCookie(res);
    res.json({ ok: true });
  });

  // Protected state-changing endpoint
  app.post('/protected', (req, res) => {
    res.json({ ok: true });
  });

  // Safe read-only endpoint
  app.get('/read-only', (req, res) => {
    res.json({ ok: true });
  });

  return app;
}

describe('setCsrfCookie', () => {
  it('sets a csrf_token cookie that is readable by JS (not httpOnly)', async () => {
    const app = buildApp();
    const res = await request(app).get('/set-csrf');

    expect(res.status).toBe(200);

    const setCookieHeader = res.headers['set-cookie'] as string[] | string | undefined;
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? ''];
    const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='));

    expect(csrfCookie).toBeDefined();
    // Must NOT be httpOnly — JS needs to read it for double-submit pattern
    expect(csrfCookie?.toLowerCase()).not.toContain('httponly');
    // Token must be a non-empty hex string (32 random bytes = 64 hex chars)
    const tokenMatch = csrfCookie?.match(/^csrf_token=([^;]+)/);
    expect(tokenMatch?.[1]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the generated token value', async () => {
    const app = buildApp();
    const res = await request(app).get('/set-csrf');
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates a unique token on each call', async () => {
    const app = buildApp();
    const [res1, res2] = await Promise.all([
      request(app).get('/set-csrf'),
      request(app).get('/set-csrf'),
    ]);
    expect(res1.body.token).not.toBe(res2.body.token);
  });
});

describe('csrfProtection — safe methods bypass validation', () => {
  it('GET passes through without any CSRF token', async () => {
    const app = buildApp();
    const res = await request(app).get('/read-only');
    expect(res.status).toBe(200);
  });

  it('HEAD passes through without any CSRF token', async () => {
    const app = buildApp();
    const res = await request(app).head('/read-only');
    expect(res.status).toBe(200);
  });

  it('OPTIONS passes through without any CSRF token', async () => {
    const app = buildApp();
    const res = await request(app).options('/read-only');
    // Express default OPTIONS handling returns 200 or 204
    expect([200, 204]).toContain(res.status);
  });
});

describe('csrfProtection — POST requires matching cookie + header', () => {
  it('returns 403 when both cookie and header are absent', async () => {
    const app = buildApp();
    const res = await request(app).post('/protected').send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/csrf/i);
  });

  it('returns 403 when cookie is present but header is absent', async () => {
    const app = buildApp();
    const token = 'a'.repeat(64);
    const res = await request(app)
      .post('/protected')
      .set('Cookie', `csrf_token=${token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('returns 403 when header is present but cookie is absent', async () => {
    const app = buildApp();
    const token = 'a'.repeat(64);
    const res = await request(app)
      .post('/protected')
      .set('X-CSRF-Token', token)
      .send({});
    expect(res.status).toBe(403);
  });

  it('returns 403 when cookie and header are present but do not match', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/protected')
      .set('Cookie', `csrf_token=${'a'.repeat(64)}`)
      .set('X-CSRF-Token', 'b'.repeat(64))
      .send({});
    expect(res.status).toBe(403);
  });

  it('returns 200 when cookie and header match', async () => {
    const app = buildApp();
    const token = 'c'.repeat(64);
    const res = await request(app)
      .post('/protected')
      .set('Cookie', `csrf_token=${token}`)
      .set('X-CSRF-Token', token)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('clearCsrfCookie', () => {
  it('clears the csrf_token cookie on a CSRF-protected route', async () => {
    const app = buildApp();
    const token = 'd'.repeat(64);
    const res = await request(app)
      .post('/clear-csrf')
      .set('Cookie', `csrf_token=${token}`)
      .set('X-CSRF-Token', token)
      .send({});

    expect(res.status).toBe(200);
    const setCookieHeader = res.headers['set-cookie'] as string[] | string | undefined;
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? ''];
    const cleared = cookies.find((c) => c.startsWith('csrf_token='));
    // Cleared cookie has empty value and Max-Age=0 or Expires in the past
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/csrf_token=(?:;|$)/);
  });
});
