/**
 * Integration tests — CSRF bootstrap exemption in the global app middleware.
 *
 * Regression guard for: https://github.com/PhBassin/allo-scrapper
 * Bug: POST /api/auth/login returned 403 CSRF error on first login (no prior
 * csrf_token cookie) because the global CSRF middleware ran before the login
 * handler had a chance to create the cookie.
 *
 * Fix: /api/auth/login and /api/auth/logout are exempt from the global CSRF
 * middleware (they are the bootstrap/teardown routes for the cookie).
 *
 * These tests use a minimal Express app that replays the exact middleware
 * order from server/src/app.ts to guarantee the exemption stays in place.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import request from 'supertest';

/** Permissive rate limiter — satisfies CodeQL's missing-rate-limiting query. */
const testRateLimiter = rateLimit({ windowMs: 60_000, max: 1000 });

/**
 * Builds a minimal app that reproduces the exact CSRF middleware block
 * from server/src/app.ts, including the CSRF_EXEMPT list.
 * Mounts a fake /api/auth/login, /api/auth/logout, and /api/protected
 * so we can assert the correct behaviour for each case.
 */
function buildAppWithGlobalCsrf() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(testRateLimiter);

  // ── replicated verbatim from server/src/app.ts ──────────────────────────
  const CSRF_EXEMPT = ['/api/auth/login', '/api/auth/logout'];
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (!req.path.startsWith('/api/')) return next();
    if (CSRF_EXEMPT.includes(req.path)) return next();
    const cookieToken = (req.cookies as Record<string, string>)?.csrf_token;
    const headerToken = req.headers['x-csrf-token'];
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return res.status(403).json({ success: false, error: 'CSRF token missing or invalid' });
    }
    return next();
  });
  // ────────────────────────────────────────────────────────────────────────

  // Fake login: sets the CSRF cookie on success (mirrors auth.ts behaviour)
  app.post('/api/auth/login', (_req, res) => {
    const token = 'fake-csrf-token-from-login';
    res.cookie('csrf_token', token, { httpOnly: false, sameSite: 'strict', path: '/' });
    res.json({ success: true, data: { token: 'jwt-here' } });
  });

  // Fake logout: clears the CSRF cookie
  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('csrf_token', { path: '/' });
    res.json({ success: true });
  });

  // Any other state-changing API route that IS protected
  app.post('/api/protected', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: first-login with no prior csrf_token cookie must NOT return 403
// ─────────────────────────────────────────────────────────────────────────────
describe('CSRF global middleware — login/logout bootstrap exemption', () => {
  it('POST /api/auth/login succeeds without a prior csrf_token cookie (regression: #first-login-403)', async () => {
    const app = buildAppWithGlobalCsrf();

    // Simulate a fresh browser with no cookies at all
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'secret' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/auth/login sets the csrf_token cookie in the response', async () => {
    const app = buildAppWithGlobalCsrf();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'secret' });

    const setCookieHeader = res.headers['set-cookie'] as string[] | string | undefined;
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? ''];
    expect(cookies.some((c) => c.startsWith('csrf_token='))).toBe(true);
  });

  it('POST /api/auth/logout succeeds without a csrf_token cookie (no chicken-and-egg on logout)', async () => {
    const app = buildAppWithGlobalCsrf();

    const res = await request(app)
      .post('/api/auth/logout')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/protected returns 403 when no csrf_token cookie is present', async () => {
    const app = buildAppWithGlobalCsrf();

    const res = await request(app)
      .post('/api/protected')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/csrf/i);
  });

  it('POST /api/protected returns 200 after login provides the csrf cookie', async () => {
    const app = buildAppWithGlobalCsrf();

    // Step 1 — login (no cookie required)
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'secret' });
    expect(loginRes.status).toBe(200);

    // Extract the csrf_token from Set-Cookie
    const setCookieHeader = loginRes.headers['set-cookie'] as string[] | string | undefined;
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? ''];
    const csrfCookieEntry = cookies.find((c) => c.startsWith('csrf_token='));
    const csrfToken = csrfCookieEntry?.match(/^csrf_token=([^;]+)/)?.[1] ?? '';
    expect(csrfToken).not.toBe('');

    // Step 2 — subsequent request uses the cookie + header (double-submit)
    const protectedRes = await request(app)
      .post('/api/protected')
      .set('Cookie', `csrf_token=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({});

    expect(protectedRes.status).toBe(200);
    expect(protectedRes.body.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ensure the CSRF_EXEMPT list is kept minimal — only login/logout
// ─────────────────────────────────────────────────────────────────────────────
describe('CSRF_EXEMPT list stays minimal', () => {
  it('only /api/auth/login and /api/auth/logout are exempt', async () => {
    // This test documents the intended contract.
    // If you need to add a new exempt route, update this test deliberately
    // and add a comment explaining why the route cannot use CSRF.
    const EXPECTED_EXEMPT = ['/api/auth/login', '/api/auth/logout'];

    // Import the actual exemption list from csrf.ts source to detect drift.
    // We do this by grep-parsing the source file at test time.
    const { readFileSync } = await import('fs');
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');

    const __filename = fileURLToPath(import.meta.url);
    const csrfSrc = readFileSync(join(dirname(__filename), 'csrf.ts'), 'utf8');

    const match = csrfSrc.match(/export const CSRF_EXEMPT\s*=\s*\[([^\]]+)\]/);
    expect(match, 'CSRF_EXEMPT array not found in csrf.ts').toBeTruthy();

    const exemptList = match![1]
      .split(',')
      .map((s) => s.trim().replace(/['"]/g, ''))
      .filter(Boolean);

    expect(exemptList.sort()).toEqual(EXPECTED_EXEMPT.sort());
  });
});
