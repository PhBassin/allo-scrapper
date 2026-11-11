// Set secure JWT_SECRET BEFORE importing rate-limit
process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import type { DB } from '../db/index.js';
import { requireAuth, type AuthRequest } from './auth.js';
import {
  generalLimiter,
  authLimiter,
  registerLimiter,
  protectedLimiter,
  scraperLimiter,
  publicLimiter,
  healthCheckLimiter,
} from './rate-limit.js';
import rateLimit from 'express-rate-limit';

/** A secret the server does not know: a token signed with it fails verification. */
const UNKNOWN_SECRET = 'wrong-secret-minimum-32-chars-long-or-longer';

// Helper: sign a minimal JWT for rate-limit key tests, with the current secret unless another is given
const makeToken = (
  userId: number,
  ver = 0,
  { secret = process.env.JWT_SECRET as string, ...options }: jwt.SignOptions & { secret?: string } = {},
): string => jwt.sign({ id: userId, username: `user${userId}`, ver }, secret, { algorithm: 'HS256', ...options });

/** A token that only its expiry makes invalid: right secret, current `ver`. */
const makeExpiredToken = (userId: number): string => makeToken(userId, 0, { expiresIn: -10 });

/** Give the app a DB whose users table holds `version` for every id (null: no such user). */
const withDb = (target: express.Application, version: number | null = 0) => {
  const query = vi.fn().mockResolvedValue({ rows: version === null ? [] : [{ token_version: version }] });
  target.set('db', { query } as unknown as DB);
  return query;
};

describe('Rate Limiting Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Trust proxy to enable rate limiting in tests
    app.set('trust proxy', 1);
  });

  describe('generalLimiter', () => {
    beforeEach(() => {
      app.get('/test', generalLimiter, (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app).get('/test');
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });

    it('should be backed by express-rate-limit', () => {
      expect(typeof generalLimiter).toBe('function');
      expect(typeof (generalLimiter as typeof rateLimit)).toBe('function');
    });
  });

  describe('authLimiter', () => {
    beforeEach(() => {
      app.post('/login', authLimiter, (req, res) => {
        if (req.body.success) {
          return res.status(200).json({ success: true });
        }
        res.status(401).json({ success: false });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app)
        .post('/login')
        .send({ success: true });
      expect(response.status).toBe(200);
    });

    it('should skip successful requests (status 200)', async () => {
      // Make 4 successful login attempts (should not count toward limit)
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post('/login')
          .send({ success: true });
        expect(res.status).toBe(200);
      }

      // Successful requests should not have been rate limited
      const response = await request(app)
        .post('/login')
        .send({ success: true });
      expect(response.status).toBe(200);
    });
  });

  describe('registerLimiter', () => {
    beforeEach(() => {
      app.post('/register', registerLimiter, (_req, res) => {
        res.status(201).json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).post('/register').send({});
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('protectedLimiter', () => {
    beforeEach(() => {
      app.get('/reports', protectedLimiter, (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).get('/reports');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('scraperLimiter', () => {
    beforeEach(() => {
      app.post('/scraper/trigger', scraperLimiter, (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).post('/scraper/trigger').send({});
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('publicLimiter', () => {
    beforeEach(() => {
      app.get('/public', publicLimiter, (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).get('/public');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('protectedLimiter — per-user key generation', () => {
    it('should use user id as rate-limit key so two users on same IP have independent quotas', async () => {
      // Create a tight-limit app to make exhaustion testable without 60 requests
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      withDb(tightApp);
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');
      const tightLimiter = rateLimit({
        windowMs: 60_000,
        max: 2,
        skip: () => false,
        keyGenerator: authenticatedKeyGenerator,
      });
      tightApp.get('/p', tightLimiter, (_req, res) => res.json({ ok: true }));

      const token1 = makeToken(1);
      const token2 = makeToken(2);
      const sameIp = '1.2.3.4';

      // Exhaust user 1's quota (2 requests)
      await request(tightApp).get('/p').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp);
      await request(tightApp).get('/p').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp);
      const exhausted = await request(tightApp).get('/p').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp);
      expect(exhausted.status).toBe(429);

      // User 2 on same IP should still have full quota
      const user2res = await request(tightApp).get('/p').set('Authorization', `Bearer ${token2}`).set('X-Forwarded-For', sameIp);
      expect(user2res.status).toBe(200);
    });

    it('should key on the access_token cookie so two browser users on same IP have independent quotas', async () => {
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      withDb(tightApp);
      tightApp.use(cookieParser());
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');
      const keys: string[] = [];
      const tightLimiter = rateLimit({
        windowMs: 60_000,
        max: 2,
        skip: () => false,
        keyGenerator: async (req) => {
          const key = await authenticatedKeyGenerator(req);
          keys.push(key);
          return key;
        },
      });
      tightApp.get('/p-cookie', tightLimiter, (_req, res) => res.json({ ok: true }));

      const cookie1 = `access_token=${makeToken(21)}`;
      const cookie2 = `access_token=${makeToken(22)}`;
      const sameIp = '1.2.3.9';

      await request(tightApp).get('/p-cookie').set('Cookie', cookie1).set('X-Forwarded-For', sameIp);
      await request(tightApp).get('/p-cookie').set('Cookie', cookie1).set('X-Forwarded-For', sameIp);
      const exhausted = await request(tightApp).get('/p-cookie').set('Cookie', cookie1).set('X-Forwarded-For', sameIp);
      expect(exhausted.status).toBe(429);
      expect(keys.at(-1)).toBe('user:21');

      const user2res = await request(tightApp).get('/p-cookie').set('Cookie', cookie2).set('X-Forwarded-For', sameIp);
      expect(user2res.status).toBe(200);
      expect(keys.at(-1)).toBe('user:22');
    });

    it('should fall back to IP when the access_token cookie is invalid', async () => {
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      withDb(tightApp);
      tightApp.use(cookieParser());
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');
      let generatedKey = '';
      const trackingLimiter = rateLimit({
        windowMs: 60_000,
        max: 100,
        skip: () => false,
        keyGenerator: async (req) => {
          generatedKey = await authenticatedKeyGenerator(req);
          return generatedKey;
        },
      });
      tightApp.get('/p-bad-cookie', trackingLimiter, (_req, res) => res.json({ ok: true }));

      await request(tightApp).get('/p-bad-cookie').set('Cookie', 'access_token=not.a.valid.jwt').set('X-Forwarded-For', '1.2.3.10');
      expect(generatedKey).toBe('1.2.3.10');
    });

    it('should prefer the access_token cookie over a Bearer header, like requireAuth', async () => {
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      withDb(tightApp);
      tightApp.use(cookieParser());
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');
      let generatedKey = '';
      const trackingLimiter = rateLimit({
        windowMs: 60_000,
        max: 100,
        skip: () => false,
        keyGenerator: async (req) => {
          generatedKey = await authenticatedKeyGenerator(req);
          return generatedKey;
        },
      });
      tightApp.get('/p-both', trackingLimiter, (_req, res) => res.json({ ok: true }));

      await request(tightApp)
        .get('/p-both')
        .set('Cookie', `access_token=${makeToken(31)}`)
        .set('Authorization', `Bearer ${makeToken(32)}`);
      expect(generatedKey).toBe('user:31');
    });

    it.each([
      ['a revoked token (stale ver)', 1],
      ['a token of a deleted user', null],
    ])('should fall back to IP for %s so it cannot spend the user quota', async (_label, dbVersion) => {
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      withDb(tightApp, dbVersion);
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');
      let generatedKey = '';
      const trackingLimiter = rateLimit({
        windowMs: 60_000,
        max: 100,
        skip: () => false,
        keyGenerator: async (req) => {
          generatedKey = await authenticatedKeyGenerator(req);
          return generatedKey;
        },
      });
      tightApp.get('/p-revoked', trackingLimiter, (_req, res) => res.json({ ok: true }));

      await request(tightApp).get('/p-revoked').set('Authorization', `Bearer ${makeToken(33, 0)}`).set('X-Forwarded-For', '1.2.3.11');
      expect(generatedKey).toBe('1.2.3.11');
    });

    it('should look the token version up once per request', async () => {
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');
      const query = withDb(app);
      const req = { headers: { authorization: `Bearer ${makeToken(34)}` }, app, ip: '1.2.3.12' } as unknown as Request;

      expect(await authenticatedKeyGenerator(req)).toBe('user:34');
      expect(await authenticatedKeyGenerator(req)).toBe('user:34');
      expect(query).toHaveBeenCalledTimes(1);
    });

    // requireAuth and protectedLimiter are both static imports: they must come from
    // the same module graph to share one access-token.ts (other tests reset modules)
    it('should share that one lookup with requireAuth on a protected route', async () => {
      const query = withDb(app);
      app.get('/protected-shared', protectedLimiter, requireAuth, (req, res) => {
        res.json({ userId: (req as AuthRequest).user?.id });
      });

      const response = await request(app)
        .get('/protected-shared')
        .set('Authorization', `Bearer ${makeToken(36)}`)
        .set('X-Forwarded-For', '1.2.3.15');

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe(36);
      // The limiter did run (it is skipped without req.ip), so both middlewares needed the version
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(query).toHaveBeenCalledTimes(1);
    });

    // A token that fails verification never reaches the token-version lookup:
    // only a correctly signed, unexpired token costs a database read.
    it.each([
      ['no token', {}],
      ['a malformed Bearer token', { headers: { authorization: 'Bearer not.a.valid.jwt' } }],
      [
        'a Bearer token signed with an unknown secret',
        { headers: { authorization: `Bearer ${makeToken(37, 0, { secret: UNKNOWN_SECRET })}` } },
      ],
      ['an expired Bearer token', { headers: { authorization: `Bearer ${makeExpiredToken(38)}` } }],
      ['an expired access_token cookie', { cookies: { access_token: makeExpiredToken(39) } }],
    ])('should fall back to IP for %s without a token-version lookup', async (_label, carrier) => {
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');
      const query = withDb(app);
      const req = { headers: {}, ...carrier, app, ip: '1.2.3.16' } as unknown as Request;

      expect(await authenticatedKeyGenerator(req)).toBe('1.2.3.16');
      expect(query).not.toHaveBeenCalled();
    });

    it('should not log a warning for a missing or invalid token', async () => {
      const { logger } = await import('../utils/logger.js');
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');
      withDb(app);

      const invalid = { headers: { authorization: 'Bearer not.a.valid.jwt' }, app, ip: '1.2.3.13' } as unknown as Request;
      const anonymous = { headers: {}, app, ip: '1.2.3.13' } as unknown as Request;
      expect(await authenticatedKeyGenerator(invalid)).toBe('1.2.3.13');
      expect(await authenticatedKeyGenerator(anonymous)).toBe('1.2.3.13');
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('should fall back to IP and warn when the token version lookup fails', async () => {
      const { logger } = await import('../utils/logger.js');
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');
      app.set('db', { query: vi.fn().mockRejectedValue(new Error('db down')) });

      const req = { headers: { authorization: `Bearer ${makeToken(35)}` }, app, ip: '1.2.3.14' } as unknown as Request;
      expect(await authenticatedKeyGenerator(req)).toBe('1.2.3.14');
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('should key IPv6 clients by subnet so rotating addresses share one bucket', async () => {
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');
      const keyFor = (ip: string) => authenticatedKeyGenerator({ headers: {}, app, ip } as unknown as Request);

      expect(await keyFor('2001:db8:1:2:aaaa::1')).toBe(await keyFor('2001:db8:1:2:bbbb::2'));
      expect(await keyFor('2001:db8:1:2::1')).not.toBe(await keyFor('2001:db8:ffff:2::1'));
    });

    it('should fall back to IP when no Authorization header is present', async () => {
      app.get('/protected-fallback', protectedLimiter, (_req, res) => {
        res.json({ success: true });
      });
      const response = await request(app)
        .get('/protected-fallback')
        .set('X-Forwarded-For', '5.6.7.8');
      expect(response.status).toBe(200);
    });

    it('should fall back to IP when Authorization header contains a malformed token', async () => {
      app.get('/protected-malformed', protectedLimiter, (_req, res) => {
        res.json({ success: true });
      });
      const response = await request(app)
        .get('/protected-malformed')
        .set('Authorization', 'Bearer not.a.valid.jwt');
      expect(response.status).toBe(200);
    });

    it('should fall back to IP when Authorization header contains a token with an invalid signature', async () => {
      // Create a tight-limit app to test fallback
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      withDb(tightApp);
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');
      const tightLimiter = rateLimit({
        windowMs: 60_000,
        max: 2,
        skip: () => false,
        keyGenerator: authenticatedKeyGenerator,
      });
      tightApp.get('/p-invalid', tightLimiter, (_req, res) => res.json({ ok: true }));

      // Token with incorrect secret but same spoofed user ID 1
      const spoofedToken = makeToken(1, 0, { secret: UNKNOWN_SECRET });
      const sameIp = '1.2.3.4';

      // If it fails to verify, it falls back to IP fallback.
      // So requests with spoofedToken (invalid signature) and no token at all on same IP will count against the SAME IP bucket.
      await request(tightApp).get('/p-invalid').set('Authorization', `Bearer ${spoofedToken}`).set('X-Forwarded-For', sameIp);
      await request(tightApp).get('/p-invalid').set('X-Forwarded-For', sameIp); // no token, same IP
      const exhausted = await request(tightApp).get('/p-invalid').set('X-Forwarded-For', sameIp);
      expect(exhausted.status).toBe(429);
    });
  });

  describe('scraperLimiter — per-user key generation', () => {
    it('should use user id as rate-limit key so two users on same IP have independent quotas', async () => {
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      withDb(tightApp);
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');
      const tightLimiter = rateLimit({
        windowMs: 60_000,
        max: 2,
        skip: () => false,
        keyGenerator: authenticatedKeyGenerator,
      });
      tightApp.post('/scrape', tightLimiter, (_req, res) => res.json({ ok: true }));

      const token1 = makeToken(10);
      const token2 = makeToken(11);
      const sameIp = '2.3.4.5';

      await request(tightApp).post('/scrape').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp).send({});
      await request(tightApp).post('/scrape').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp).send({});
      const exhausted = await request(tightApp).post('/scrape').set('Authorization', `Bearer ${token1}`).set('X-Forwarded-For', sameIp).send({});
      expect(exhausted.status).toBe(429);

      const user2res = await request(tightApp).post('/scrape').set('Authorization', `Bearer ${token2}`).set('X-Forwarded-For', sameIp).send({});
      expect(user2res.status).toBe(200);
    });
  });

  // The tests above build their own limiter around authenticatedKeyGenerator.
  // These ones go through the exported limiters, so that dropping the key
  // generator from a `limiterSpecs` row is caught here. Only the key generator
  // reads the token version on such a route: the lookup proves it is wired.
  // The exported limiters keep their counters for the whole file, hence a user
  // id and a client IP that no other test uses.
  describe('exported limiters — per-user key wiring', () => {
    const cookie = (token: string) => ['Cookie', `access_token=${token}`] as const;
    const bearer = (token: string) => ['Authorization', `Bearer ${token}`] as const;

    it.each([
      { name: 'protectedLimiter', limiter: protectedLimiter, carrier: 'the access_token cookie', header: cookie, userId: 50 },
      { name: 'protectedLimiter', limiter: protectedLimiter, carrier: 'a Bearer header', header: bearer, userId: 51 },
      { name: 'scraperLimiter', limiter: scraperLimiter, carrier: 'the access_token cookie', header: cookie, userId: 52 },
      { name: 'scraperLimiter', limiter: scraperLimiter, carrier: 'a Bearer header', header: bearer, userId: 53 },
    ])('$name should resolve the user of $carrier for its key', async ({ limiter, header, userId }) => {
      const query = withDb(app);
      app.use(cookieParser());
      app.get('/wired', limiter, (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/wired')
        .set(...header(makeToken(userId)))
        .set('X-Forwarded-For', `1.2.3.${userId}`);

      expect(response.status).toBe(200);
      expect(query).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('token_version'), [userId]);
    });
  });

    describe('multi-secret JWT verification (rotation)', () => {
    let previousSecrets: string | undefined;

    beforeEach(async () => {
      previousSecrets = process.env.JWT_PREVIOUS_SECRETS;
      const { invalidateSecretsCache } = await import('../utils/jwt-secrets.js');
      invalidateSecretsCache();
    });

    afterEach(() => {
      if (previousSecrets !== undefined) {
        process.env.JWT_PREVIOUS_SECRETS = previousSecrets;
      } else {
        delete process.env.JWT_PREVIOUS_SECRETS;
      }
    });

    it('should verify tokens signed with a previous secret', async () => {
      const oldSecret = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6_old';
      process.env.JWT_PREVIOUS_SECRETS = oldSecret;
      const oldToken = makeToken(42, 0, { secret: oldSecret });

      const tightApp = express();
      tightApp.set('trust proxy', 1);
      withDb(tightApp);
      const { authenticatedKeyGenerator } = await import('./rate-limit.js');

      // Track the generated key instead of hitting rate limit
      let generatedKey = '';
      const trackingLimiter = rateLimit({
        windowMs: 60_000,
        max: 100,
        skip: () => false,
        keyGenerator: async (req) => {
          generatedKey = await authenticatedKeyGenerator(req);
          return generatedKey;
        },
      });

      tightApp.get('/rotate-test', trackingLimiter, (_req, res) => res.json({ ok: true }));

      await request(tightApp)
        .get('/rotate-test')
        .set('Authorization', `Bearer ${oldToken}`)
        .set('X-Forwarded-For', '10.0.0.1');

      // The key should be user:42 (user id from token), not IP-based
      expect(generatedKey).toBe('user:42');
    });
  });

  describe('Environment variable configuration', () => {
    it('should respect RATE_LIMIT_WINDOW_MS environment variable', () => {
      const windowMs = process.env.RATE_LIMIT_WINDOW_MS;
      expect(windowMs).toBeDefined();
    });

    it('should respect RATE_LIMIT_GENERAL_MAX environment variable', () => {
      const max = process.env.RATE_LIMIT_GENERAL_MAX;
      expect(max).toBeDefined();
    });

    it('should respect RATE_LIMIT_AUTH_MAX environment variable', () => {
      const max = process.env.RATE_LIMIT_AUTH_MAX;
      expect(max).toBeDefined();
    });

    it('should respect RATE_LIMIT_REGISTER_MAX environment variable', () => {
      const max = process.env.RATE_LIMIT_REGISTER_MAX;
      expect(max).toBeDefined();
    });

    it('should respect RATE_LIMIT_PROTECTED_MAX environment variable', () => {
      const max = process.env.RATE_LIMIT_PROTECTED_MAX;
      expect(max).toBeDefined();
    });

    it('should respect RATE_LIMIT_SCRAPER_MAX environment variable', () => {
      const max = process.env.RATE_LIMIT_SCRAPER_MAX;
      expect(max).toBeDefined();
    });

    it('should respect RATE_LIMIT_PUBLIC_MAX environment variable', () => {
      const max = process.env.RATE_LIMIT_PUBLIC_MAX;
      expect(max).toBeDefined();
    });

    it('should respect RATE_LIMIT_HEALTH_MAX environment variable', () => {
      const max = process.env.RATE_LIMIT_HEALTH_MAX;
      expect(max).toBeDefined();
    });
  });

  describe('healthCheckLimiter', () => {
    beforeEach(() => {
      app.get('/health', healthCheckLimiter, (_req, res) => {
        res.json({ status: 'healthy' });
      });
    });

    it('should allow requests within the limit', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('X-Forwarded-For', '203.0.113.42'); // External IP to trigger rate limiting
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });

    it('skips a request whose peer and client IP are both loopback', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['ratelimit-limit']).toBeUndefined();
    });

    it('limits a forged loopback X-Forwarded-For from a non-loopback peer', async () => {
      const lanApp = express();
      lanApp.set('trust proxy', 1);
      lanApp.use((req, _res, next) => {
        Object.defineProperty(req.socket, 'remoteAddress', { value: '192.168.1.20', configurable: true });
        next();
      });
      lanApp.get('/health', healthCheckLimiter, (_req, res) => res.json({ status: 'healthy' }));

      const response = await request(lanApp).get('/health').set('X-Forwarded-For', '127.0.0.1');
      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBeDefined();
    });

    it('should rate limit after max requests (10 by default)', async () => {
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      const tightLimiter = rateLimit({
        windowMs: 60_000, // 1 minute
        max: 10,
        skip: (req) => {
          const internalIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
          return !req.ip || internalIPs.includes(req.ip);
        },
        standardHeaders: true,
        message: {
          success: false,
          error: 'Too many health check requests',
        },
      });
      tightApp.get('/health', tightLimiter, (_req, res) => res.json({ status: 'healthy' }));

      const clientIp = '203.0.113.42'; // External IP

      // Make 10 requests (should all succeed)
      for (let i = 0; i < 10; i++) {
        const res = await request(tightApp)
          .get('/health')
          .set('X-Forwarded-For', clientIp);
        expect(res.status).toBe(200);
      }

      // 11th request should be rate limited
      const limitedResponse = await request(tightApp)
        .get('/health')
        .set('X-Forwarded-For', clientIp);
      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.body.error).toBeDefined();
    });

    it('should exempt localhost IPs from rate limiting', async () => {
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      const tightLimiter = rateLimit({
        windowMs: 60_000,
        max: 2, // Very strict limit to make test fast
        skip: (req) => {
          const internalIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
          return !req.ip || internalIPs.includes(req.ip);
        },
        standardHeaders: true,
      });
      tightApp.get('/health', tightLimiter, (_req, res) => res.json({ status: 'healthy' }));

      // Make many requests from localhost (should never be rate limited)
      for (let i = 0; i < 20; i++) {
        const res = await request(tightApp)
          .get('/health')
          .set('X-Forwarded-For', '127.0.0.1');
        expect(res.status).toBe(200);
      }

      // IPv6 localhost
      for (let i = 0; i < 20; i++) {
        const res = await request(tightApp)
          .get('/health')
          .set('X-Forwarded-For', '::1');
        expect(res.status).toBe(200);
      }
    });

    it('should return proper error message when rate limited', async () => {
      const tightApp = express();
      tightApp.set('trust proxy', 1);
      const tightLimiter = rateLimit({
        windowMs: 60_000,
        max: 1,
        skip: (req) => {
          const internalIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
          return !req.ip || internalIPs.includes(req.ip);
        },
        message: {
          success: false,
          error: 'Too many health check requests',
        },
      });
      tightApp.get('/health', tightLimiter, (_req, res) => res.json({ status: 'healthy' }));

      const clientIp = '203.0.113.99';

      // First request succeeds
      await request(tightApp).get('/health').set('X-Forwarded-For', clientIp);

      // Second request is rate limited
      const limitedResponse = await request(tightApp)
        .get('/health')
        .set('X-Forwarded-For', clientIp);

      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.body.success).toBe(false);
      expect(limitedResponse.body.error).toBe('Too many health check requests');
    });
  });

  describe('live source subscription', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      vi.resetModules();
    });

    function makeDb(rows: any[]): DB {
      return {
        query: vi.fn().mockResolvedValue({ rows }),
      } as unknown as DB;
    }

    it('picks up new limits after source.loadFromDb updates the source', async () => {
      const source = await import('../services/rate-limit-source.js');
      const middleware = await import('./rate-limit.js');

      await source.loadFromDb(makeDb([{
        window_ms: 60000,
        general_max: 1,
        auth_max: 5,
        register_max: 3,
        register_window_ms: 3600000,
        protected_max: 60,
        scraper_max: 10,
        public_max: 100,
        health_max: 10,
        health_window_ms: 60000,
        updated_at: '2026-04-01T00:00:00.000Z',
        updated_by: null,
        environment: 'test',
      }]));

      const app = express();
      app.set('trust proxy', 1);
      app.get('/t', middleware.generalLimiter, (_req, res) => res.json({ ok: true }));

      const r1 = await request(app).get('/t');
      expect(r1.status).toBe(200);

      const r2 = await request(app).get('/t');
      expect(r2.status).toBe(429);
    });

    it('keeps env-derived limits when loadFromDb fails', async () => {
      const source = await import('../services/rate-limit-source.js');
      const middleware = await import('./rate-limit.js');

      const failingDb = {
        query: vi.fn().mockRejectedValue(new Error('DB down')),
      } as unknown as DB;

      await source.loadFromDb(failingDb);

      const app = express();
      app.set('trust proxy', 1);
      app.get('/t', middleware.generalLimiter, (_req, res) => res.json({ ok: true }));

      for (let i = 0; i < 10; i++) {
        const r = await request(app).get('/t');
        expect(r.status).toBe(200);
      }
    });
  });

  describe('each limiter reflects its own configured max after refresh', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    function makeDb(row: Record<string, unknown>): DB {
      return {
        query: vi.fn().mockResolvedValue({ rows: [row] }),
      } as unknown as DB;
    }

    const baseRow = {
      window_ms: 60000,
      general_max: 100,
      auth_max: 100,
      register_max: 100,
      register_window_ms: 3600000,
      protected_max: 100,
      scraper_max: 100,
      public_max: 100,
      health_max: 100,
      health_window_ms: 60000,
      updated_at: '2026-04-01T00:00:00.000Z',
      updated_by: null,
      environment: 'test',
    };

    // Drive only the target limiter's max to 1 (siblings stay 100).
    // Correct wiring => 2nd request is 429. A mis-wiring reads a sibling's
    // key (100) => 2nd request is 200 => test fails.
    // auth uses skipSuccessfulRequests, so its handler must fail (>=400) to count.
    // health skips internal IPs, so it needs an external X-Forwarded-For.
    const cases = [
      { exportName: 'generalLimiter', maxKey: 'general_max', method: 'get' as const, handlerStatus: 200 },
      { exportName: 'authLimiter', maxKey: 'auth_max', method: 'post' as const, handlerStatus: 401 },
      { exportName: 'registerLimiter', maxKey: 'register_max', method: 'post' as const, handlerStatus: 201 },
      { exportName: 'protectedLimiter', maxKey: 'protected_max', method: 'get' as const, handlerStatus: 200 },
      { exportName: 'scraperLimiter', maxKey: 'scraper_max', method: 'post' as const, handlerStatus: 200 },
      { exportName: 'publicLimiter', maxKey: 'public_max', method: 'get' as const, handlerStatus: 200 },
      { exportName: 'healthCheckLimiter', maxKey: 'health_max', method: 'get' as const, handlerStatus: 200, externalIp: '203.0.113.42' },
    ];

    it.each(cases)(
      '$exportName enforces max=1 from its own $maxKey after refresh (2nd request is 429)',
      async ({ exportName, maxKey, method, handlerStatus, externalIp }) => {
        const source = await import('../services/rate-limit-source.js');
        const middleware = await import('./rate-limit.js');

        await source.loadFromDb(makeDb({ ...baseRow, [maxKey]: 1 }));

        const handler = (middleware as Record<string, RequestHandler>)[exportName];
        const limiterApp = express();
        limiterApp.set('trust proxy', 1);
        limiterApp.use(express.json());
        const respond = (_req: Request, res: Response) => res.status(handlerStatus).json({ ok: true });
        if (method === 'get') {
          limiterApp.get('/x', handler, respond);
        } else {
          limiterApp.post('/x', handler, respond);
        }

        const send = () => {
          const r = method === 'get' ? request(limiterApp).get('/x') : request(limiterApp).post('/x').send({});
          return externalIp ? r.set('X-Forwarded-For', externalIp) : r;
        };

        const first = await send();
        expect(first.status).toBe(handlerStatus);

        const second = await send();
        expect(second.status).toBe(429);
      },
    );
  });
});
