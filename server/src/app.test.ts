import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import type { DB } from './db/index.js';
import { createApp } from './app.js';
import { getCurrentConfig } from './services/rate-limit-source.js';

// Mock dependencies
vi.mock('./services/theme-generator.js');
vi.mock('./utils/logger.js');

let shouldRejectAuth = false;

// Only requireAuth is replaced: requirePermission still needs the real isAdminUser
vi.mock('./middleware/auth.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./middleware/auth.js')>()),
  requireAuth: (req: any, res: any, next: any) => {
    if (shouldRejectAuth) {
      return res.status(401).json({ success: false, error: 'Authentication required. No token provided.' });
    }
    (req as any).user = { id: 1, username: 'test', role_name: 'admin', is_system_role: true, permissions: [] };
    next();
  },
}));

import * as themeGenerator from './services/theme-generator.js';

function mockHealthyDb(app: Express, resolve = true) {
  const mockQuery = vi.fn();
  if (resolve) {
    mockQuery.mockResolvedValue({ rows: [{ result: 1 }] });
  } else {
    mockQuery.mockRejectedValue(new Error('Connection refused'));
  }
  const dbWithMock: DB = {
    query: mockQuery,
    end: vi.fn()
  } as unknown as DB;
  app.set('db', dbWithMock);
  return { mockQuery };
}

describe('App - Theme Endpoint', () => {
  let app: Express;
  const mockDb: DB = {} as DB;

  beforeEach(() => {
    app = createApp();
    app.set('db', mockDb);
    vi.clearAllMocks();
  });

  describe('GET /api/theme.css', () => {
    it('should return theme CSS with proper headers', async () => {
      const mockCSS = ':root { --color-primary: #FECC00; }';
      vi.mocked(themeGenerator.generateThemeCSS).mockResolvedValue(mockCSS);

      const res = await request(app)
        .get('/api/theme.css')
        .expect(200);

      expect(res.headers['content-type']).toContain('text/css');
      expect(res.headers['cache-control']).toBe('public, max-age=3600');
      expect(res.headers['etag']).toBeDefined();
      expect(res.text).toBe(mockCSS);
      expect(themeGenerator.generateThemeCSS).toHaveBeenCalledWith(mockDb);
    });

    it('should return 304 Not Modified when ETag matches', async () => {
      const mockCSS = ':root { --color-primary: #FECC00; }';
      vi.mocked(themeGenerator.generateThemeCSS).mockResolvedValue(mockCSS);

      // First request to get ETag
      const res1 = await request(app)
        .get('/api/theme.css')
        .expect(200);

      const etag = res1.headers['etag'];

      // Second request with If-None-Match header
      const res2 = await request(app)
        .get('/api/theme.css')
        .set('If-None-Match', etag)
        .expect(304);

      expect(res2.text).toBe('');
    });

    it('should return fresh CSS when ETag does not match', async () => {
      const mockCSS = ':root { --color-primary: #FECC00; }';
      vi.mocked(themeGenerator.generateThemeCSS).mockResolvedValue(mockCSS);

      const res = await request(app)
        .get('/api/theme.css')
        .set('If-None-Match', 'invalid-etag')
        .expect(200);

      expect(res.text).toBe(mockCSS);
    });

    it('should return fallback CSS when database connection is missing', async () => {
      const appWithoutDb = createApp();
      // Don't set db connection

      const res = await request(appWithoutDb)
        .get('/api/theme.css')
        .expect(200);

      expect(res.headers['content-type']).toContain('text/css');
      expect(res.text).toBe(':root { --color-primary: #FECC00; --color-secondary: #1F2937; }');
      expect(themeGenerator.generateThemeCSS).not.toHaveBeenCalled();
    });

    it('should return fallback CSS on theme generation error', async () => {
      vi.mocked(themeGenerator.generateThemeCSS).mockRejectedValue(
        new Error('Database error')
      );

      const res = await request(app)
        .get('/api/theme.css')
        .expect(200);

      expect(res.headers['content-type']).toContain('text/css');
      expect(res.text).toBe(':root { --color-primary: #FECC00; --color-secondary: #1F2937; }');
    });

    it('should generate different ETags for different CSS content', async () => {
      const mockCSS1 = ':root { --color-primary: #FECC00; }';
      const mockCSS2 = ':root { --color-primary: #FF0000; }';

      vi.mocked(themeGenerator.generateThemeCSS).mockResolvedValue(mockCSS1);

      const res1 = await request(app)
        .get('/api/theme.css')
        .expect(200);

      const etag1 = res1.headers['etag'];

      vi.mocked(themeGenerator.generateThemeCSS).mockResolvedValue(mockCSS2);

      const res2 = await request(app)
        .get('/api/theme.css')
        .expect(200);

      const etag2 = res2.headers['etag'];

      expect(etag1).not.toBe(etag2);
    });
  });

  describe('GET /api/health', () => {
    it('should return healthy status when database is accessible', async () => {
      const { mockQuery } = mockHealthyDb(app);

      const res = await request(app)
        .get('/api/health')
        .expect(200);

      expect(res.body.status).toBe('healthy');
      expect(res.body.database).toBe('connected');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.cached).toBe(false);
      expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return cached status within TTL', async () => {
      const { mockQuery } = mockHealthyDb(app);

      // First request - hits database
      const res1 = await request(app)
        .get('/api/health')
        .expect(200);
      expect(res1.body.cached).toBe(false);
      expect(mockQuery).toHaveBeenCalledTimes(1);

      // Second request within 5 seconds - uses cache
      const res2 = await request(app)
        .get('/api/health')
        .expect(200);
      expect(res2.body.cached).toBe(true);
      expect(res2.body.status).toBe('healthy');
      // Database query should not be called again
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should return unhealthy status when database query fails', async () => {
      const { mockQuery } = mockHealthyDb(app, false);

      const res = await request(app)
        .get('/api/health')
        .expect(503);

      expect(res.body.status).toBe('unhealthy');
      expect(res.body.database).toBe('disconnected');
      expect(res.body.cached).toBe(false);
    });

    it('should include rate limit headers', async () => {
      const { mockQuery } = mockHealthyDb(app);

      const res = await request(app)
        .get('/api/health')
        .expect(200);

      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });

    it('should fallback to simple health check when db connection is not set', async () => {
      const appWithoutDb = createApp();
      // Don't set db connection

      const res = await request(appWithoutDb)
        .get('/api/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.name).toBeDefined();
    });
  });

  describe('GET /metrics', () => {
    it('should return 401 for unauthenticated requests', async () => {
      shouldRejectAuth = true;
      try {
        const res = await request(app)
          .get('/metrics')
          .expect(401);

        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('Authentication required. No token provided.');
      } finally {
        shouldRejectAuth = false;
      }
    });

    it('should return Prometheus metrics when authenticated', async () => {
      const res = await request(app)
        .get('/metrics')
        .expect(200);

      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('ics_web_');
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown API routes', async () => {
      const res = await request(app)
        .get('/api/unknown')
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('API endpoint not found');
    });
  });

  describe('Content Security Policy', () => {
    it('should allow Google Fonts stylesheets in CSP style-src-elem', async () => {
      mockHealthyDb(app);

      const res = await request(app)
        .get('/api/health')
        .expect(200);

      const cspHeader = res.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();
      
      // CSP should allow fonts.googleapis.com for loading stylesheets
      expect(cspHeader).toMatch(/style-src-elem[^;]*https:\/\/fonts\.googleapis\.com/);
    });

    it('should allow Google Fonts CDN in CSP font-src', async () => {
      mockHealthyDb(app);

      const res = await request(app)
        .get('/api/health')
        .expect(200);

      const cspHeader = res.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();
      
      // CSP should allow fonts.gstatic.com for loading font files
      expect(cspHeader).toMatch(/font-src[^;]*https:\/\/fonts\.gstatic\.com/);
    });

    it('should include upgrade-insecure-requests directive in production', async () => {
      // upgrade-insecure-requests is gated on NODE_ENV=production so HTTP-only
      // dev deploys do not trigger browser-side HTTPS upgrade against a server
      // that doesn't listen on TLS. See csp-validation.test.ts for the dev-side
      // assertion and server/src/app.ts for the env-gating implementation.
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const prodApp = createApp();
        prodApp.set('db', mockDb);
        mockHealthyDb(prodApp);

        const res = await request(prodApp)
          .get('/api/health')
          .expect(200);

        const cspHeader = res.headers['content-security-policy'];
        expect(cspHeader).toBeDefined();

        // CSP should include upgrade-insecure-requests to force HTTPS in production
        expect(cspHeader).toContain('upgrade-insecure-requests');
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('should maintain existing CSP directives', async () => {
      mockHealthyDb(app);

      const res = await request(app)
        .get('/api/health')
        .expect(200);

      const cspHeader = res.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();
      
      // Verify existing directives are preserved
      expect(cspHeader).toContain("default-src 'self'");
      expect(cspHeader).toMatch(/style-src[^;]*'self'/);
      expect(cspHeader).toMatch(/style-src[^;]*'unsafe-inline'/);
      expect(cspHeader).toMatch(/font-src[^;]*'self'/);
      expect(cspHeader).toMatch(/font-src[^;]*data:/);
    });
  });
});

describe('App - trust proxy', () => {
  const originalTrustProxy = process.env.TRUST_PROXY;

  afterEach(() => {
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = originalTrustProxy;
  });

  it('trusts no proxy by default', () => {
    delete process.env.TRUST_PROXY;
    const trust = createApp().get('trust proxy fn') as (addr: string, i: number) => boolean;

    expect(trust('203.0.113.5', 0)).toBe(false); // public client hitting port 3000 directly
    expect(trust('192.168.1.20', 0)).toBe(false); // LAN client hitting port 3000 directly
    expect(trust('127.0.0.1', 0)).toBe(false);
  });

  it('reads TRUST_PROXY from the environment', () => {
    process.env.TRUST_PROXY = '203.0.113.5';
    const trust = createApp().get('trust proxy fn') as (addr: string, i: number) => boolean;

    expect(trust('203.0.113.5', 0)).toBe(true);
    expect(trust('172.18.0.4', 0)).toBe(false);
  });

  it('refuses to start with an invalid TRUST_PROXY', () => {
    process.env.TRUST_PROXY = 'not-an-ip';
    expect(() => createApp()).toThrow(/TRUST_PROXY/);
  });
});

describe('App - rate limiter order', () => {
  const originalTrustProxy = process.env.TRUST_PROXY;

  afterEach(() => {
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = originalTrustProxy;
  });

  // The per-user key generator reads the token version before its limiter
  // counts the request, 429 included. The per-IP general limiter runs first,
  // so it caps those lookups: see docs/reference/api/rate-limiting.md.
  it('rejects a request over the general limit before any token-version lookup', async () => {
    // Trust the forwarded address so this test exhausts an IP of its own
    process.env.TRUST_PROXY = 'loopback';
    const app = createApp();
    const { mockQuery } = mockHealthyDb(app);
    // Every token is current, so the protected limiter keys on its user
    mockQuery.mockImplementation(async (sql: string) => ({
      rows: sql.includes('token_version') ? [{ token_version: 0 }] : [{ result: 1 }],
    }));
    // One user per request, all behind one IP: the requests fill the per-IP
    // general bucket and nothing else, each of them being the first of its
    // per-user protected bucket. The test holds whatever the two maxima are.
    const firstUserId = 7000;
    const get = (userId: number) => {
      const token = jwt.sign({ id: userId, username: `looper${userId}`, ver: 0 }, process.env.JWT_SECRET as string, { algorithm: 'HS256' });
      return request(app).get('/api/reports').set('Authorization', `Bearer ${token}`).set('X-Forwarded-For', '198.51.100.7');
    };
    const { generalMax, protectedMax } = getCurrentConfig();

    for (let i = 0; i < generalMax; i++) {
      mockQuery.mockClear();
      const underLimit = await get(firstUserId + i);
      expect(underLimit.status).toBe(200);
      // The protected limiter answers last: its headers show an untouched per-user bucket
      expect(underLimit.headers['ratelimit-remaining']).toBe(String(protectedMax - 1));
    }
    // The last request under the general limit reached the protected limiter's key generator
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT token_version FROM users'),
      [firstUserId + generalMax - 1],
    );

    mockQuery.mockClear();
    const res = await get(firstUserId + generalMax);
    expect(res.status).toBe(429);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('App - CSRF double-submit check', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const allowedOrigin = 'http://spa.test';
  let app: Express;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = allowedOrigin;
    app = createApp();
    mockHealthyDb(app);
    // The check is skipped under NODE_ENV=test and reads the env per request
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
  });

  const post = (cookie?: string, header?: string) => {
    const req = request(app).post('/api/csrf-probe-not-a-route');
    if (cookie !== undefined) req.set('Cookie', `csrf_token=${cookie}`);
    if (header !== undefined) req.set('X-CSRF-Token', header);
    return req;
  };

  it('accepts matching cookie and header tokens', async () => {
    const res = await post('abc123token', 'abc123token');
    // Past the check, the probe path falls through to the API 404 handler
    expect(res.status).toBe(404);
  });

  it.each(['/API/theaters', '/Api/users/1/reset-password', '/api/AUTH/x'])(
    'checks %s too: route matching is case-insensitive',
    async (path) => {
      const res = await request(app).post(path).send({});
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF token missing or invalid.');
    },
  );

  it.each([
    ['/API/auth/login', 400, 'Username and password are required'],
    ['/api/Auth/Refresh', 401, 'No refresh token provided.'],
    ['/api/auth/LOGOUT', 200, undefined],
  ])('keeps the %s exemption whatever the case', async (path, status, error) => {
    // No CSRF cookie or header. The allowed Origin takes the request through
    // the strict CORS of the auth routes, so the answer is the route's own:
    // neither the check's 403 nor a 500 raised on the way.
    const res = await request(app).post(path).set('Origin', allowedOrigin).send({});
    expect(res.status).toBe(status);
    expect(res.body.error).toBe(error);
  });

  it('rejects when the header is missing', async () => {
    const res = await post('abc123token');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF token missing or invalid.');
  });

  it('rejects when the cookie is missing', async () => {
    const res = await post(undefined, 'abc123token');
    expect(res.status).toBe(403);
  });

  it('rejects same-length tokens that differ', async () => {
    const res = await post('abc123token', 'abc123tokeX');
    expect(res.status).toBe(403);
  });

  it('rejects tokens of different lengths without throwing', async () => {
    const res = await post('abc123token', 'abc123');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF token missing or invalid.');
  });

  it('rejects when the header token is a prefix-extended copy of the cookie', async () => {
    const res = await post('abc123token', 'abc123token-extra');
    expect(res.status).toBe(403);
  });

  // cookie-parser turns a `j:` cookie into the JSON value it holds. The byte
  // array is the case only the string check stops: Buffer.from() would rebuild
  // the very bytes of the header token from it, and the comparison would pass.
  it.each([
    ['an array holding the token', ['abc123token']],
    ['the bytes of the token', [...Buffer.from('abc123token')]],
  ])('rejects a cookie parsed as a non-string (JSON cookie): %s', async (_label, value) => {
    const res = await post(encodeURIComponent(`j:${JSON.stringify(value)}`), 'abc123token');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF token missing or invalid.');
  });
});
