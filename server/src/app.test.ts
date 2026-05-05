import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DB } from './db/client.js';
import type { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { createApp, applyPlugins, registerFallbackHandlers, isTrustedInternalMetricsScrape, type AppPlugin } from './app.js';
import { AuthError } from './utils/errors.js';

// Mock dependencies
vi.mock('./services/theme-generator.js');
vi.mock('./utils/logger.js');

import * as themeGenerator from './services/theme-generator.js';

const createMockDb = (queryImpl = vi.fn().mockResolvedValue({ rows: [{ result: 1 }] })): DB => ({
  query: queryImpl,
  end: vi.fn(),
} as unknown as DB);

const TEST_JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';

function mintToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });
}

const loadNonTestAppModule = async () => {
  vi.resetModules();
  return import('./app.js');
};

describe('App - Theme Endpoint', () => {
  let app: Express;
  const mockDb: DB = {} as DB;
  let originalNodeEnv: string | undefined;
  let originalGeneralMax: string | undefined;
  let originalHealthMax: string | undefined;

  describe('isTrustedInternalMetricsScrape', () => {
    it('accepts direct docker-network scrapes without forwarded headers', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '172.18.0.5' },
      } as any;

      expect(isTrustedInternalMetricsScrape(req)).toBe(true);
    });

    it('rejects requests that present forwarded headers even from private addresses', () => {
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.42' },
        socket: { remoteAddress: '172.18.0.5' },
      } as any;

      expect(isTrustedInternalMetricsScrape(req)).toBe(false);
    });

    it('rejects 10.x and 192.168.x private addresses that are outside the Docker bridge trust boundary', () => {
      const tenNetReq = {
        headers: {},
        socket: { remoteAddress: '10.0.0.5' },
      } as any;
      const lanReq = {
        headers: {},
        socket: { remoteAddress: '192.168.1.8' },
      } as any;

      expect(isTrustedInternalMetricsScrape(tenNetReq)).toBe(false);
      expect(isTrustedInternalMetricsScrape(lanReq)).toBe(false);
    });

    it('rejects loopback and public addresses', () => {
      const loopbackReq = {
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as any;
      const publicReq = {
        headers: {},
        socket: { remoteAddress: '203.0.113.42' },
      } as any;

      expect(isTrustedInternalMetricsScrape(loopbackReq)).toBe(false);
      expect(isTrustedInternalMetricsScrape(publicReq)).toBe(false);
    });
  });

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalGeneralMax = process.env.RATE_LIMIT_GENERAL_MAX;
    originalHealthMax = process.env.RATE_LIMIT_HEALTH_MAX;
    process.env.NODE_ENV = 'development';
    app = createApp();
    app.set('db', mockDb);
    registerFallbackHandlers(app); // Register 404 and SPA fallback handlers
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.RATE_LIMIT_GENERAL_MAX = originalGeneralMax;
    process.env.RATE_LIMIT_HEALTH_MAX = originalHealthMax;
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
      // Mock successful database query
      const mockQuery = vi.fn().mockResolvedValue({ rows: [{ result: 1 }] });
      const dbWithMock: DB = { 
        query: mockQuery,
        end: vi.fn()
      } as unknown as DB;
      
      app.set('db', dbWithMock);

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
      const mockQuery = vi.fn().mockResolvedValue({ rows: [{ result: 1 }] });
      const dbWithMock: DB = {
        query: mockQuery,
        end: vi.fn()
      } as unknown as DB;
      
      app.set('db', dbWithMock);

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
      const mockQuery = vi.fn().mockRejectedValue(new Error('Connection refused'));
      const dbWithMock: DB = {
        query: mockQuery,
        end: vi.fn()
      } as unknown as DB;
      
      app.set('db', dbWithMock);

      const res = await request(app)
        .get('/api/health')
        .expect(503);

      expect(res.body.status).toBe('unhealthy');
      expect(res.body.database).toBe('disconnected');
      expect(res.body.cached).toBe(false);
    });

    it('should include rate limit headers', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [{ result: 1 }] });
      const dbWithMock: DB = {
        query: mockQuery,
        end: vi.fn()
      } as unknown as DB;
      
      app.set('db', dbWithMock);

      const res = await request(app)
        .get('/api/health')
        .set('X-Forwarded-For', '203.0.113.10')
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

    it('should never rate limit repeated localhost health probes through the real app stack', async () => {
      process.env.NODE_ENV = 'development';
      process.env.RATE_LIMIT_GENERAL_MAX = '2';

      const { createApp: createNonTestApp } = await loadNonTestAppModule();
      const localhostApp = createNonTestApp();
      localhostApp.set('db', createMockDb());

      for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
        for (let i = 0; i < 20; i++) {
          const res = await request(localhostApp)
            .get('/api/health')
            .set('X-Forwarded-For', ip);

          expect(res.status).toBe(200);
          expect(res.body.status).toMatch(/^(healthy|ok)$/);
        }
      }
    });

    it('should still rate limit external /api/health callers on the 11th request', async () => {
      process.env.NODE_ENV = 'development';
      process.env.RATE_LIMIT_GENERAL_MAX = '1';
      process.env.RATE_LIMIT_HEALTH_MAX = '10';

      const { createApp: createNonTestApp } = await loadNonTestAppModule();
      const externalApp = createNonTestApp();
      externalApp.set('db', createMockDb());

      for (let i = 0; i < 10; i++) {
        const res = await request(externalApp)
          .get('/api/health')
          .set('X-Forwarded-For', '203.0.113.42');

        expect(res.status).toBe(200);
      }

      const limited = await request(externalApp)
        .get('/api/health')
        .set('X-Forwarded-For', '203.0.113.42');

      expect(limited.status).toBe(429);
      expect(limited.body).toEqual({
        success: false,
        error: 'Too many health check requests',
      });
    });
  });

  describe('GET /metrics', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/metrics')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Authentication required. No token provided.');
    });

    it('should return 403 for authenticated users without system:health permission', async () => {
      const token = mintToken({
        id: 1,
        username: 'operator',
        role_name: 'operator',
        is_system_role: false,
        permissions: [],
      });

      const res = await request(app)
        .get('/metrics')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Permission denied');
    });

    it('should return Prometheus metrics for users with system:health permission', async () => {
      const token = mintToken({
        id: 1,
        username: 'operator',
        role_name: 'operator',
        is_system_role: false,
        permissions: ['system:health'],
      });

      const res = await request(app)
        .get('/metrics')
        .set('Authorization', `Bearer ${token}`)
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
      // Mock DB for health check
      const mockQuery = vi.fn().mockResolvedValue({ rows: [{ result: 1 }] });
      const dbWithMock: DB = { 
        query: mockQuery,
        end: vi.fn()
      } as unknown as DB;
      app.set('db', dbWithMock);

      const res = await request(app)
        .get('/api/health')
        .expect(200);

      const cspHeader = res.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();
      
      // CSP should allow fonts.googleapis.com for loading stylesheets
      expect(cspHeader).toMatch(/style-src-elem[^;]*https:\/\/fonts\.googleapis\.com/);
    });

    it('should allow Google Fonts CDN in CSP font-src', async () => {
      // Mock DB for health check
      const mockQuery = vi.fn().mockResolvedValue({ rows: [{ result: 1 }] });
      const dbWithMock: DB = { 
        query: mockQuery,
        end: vi.fn()
      } as unknown as DB;
      app.set('db', dbWithMock);

      const res = await request(app)
        .get('/api/health')
        .expect(200);

      const cspHeader = res.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();
      
      // CSP should allow fonts.gstatic.com for loading font files
      expect(cspHeader).toMatch(/font-src[^;]*https:\/\/fonts\.gstatic\.com/);
    });

    it('should maintain existing CSP directives', async () => {
      // Mock DB for health check
      const mockQuery = vi.fn().mockResolvedValue({ rows: [{ result: 1 }] });
      const dbWithMock: DB = { 
        query: mockQuery,
        end: vi.fn()
      } as unknown as DB;
      app.set('db', dbWithMock);

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

describe('AppPlugin / applyPlugins', () => {
  let app: Express;
  const mockDb = {} as DB;
  const mockPool = {} as Pool;

  beforeEach(() => {
    app = createApp();
    app.set('db', mockDb);
    app.set('pool', mockPool);
    vi.clearAllMocks();
  });

  it('should call register on each plugin with app and options', async () => {
    const plugin1: AppPlugin = { name: 'p1', register: vi.fn() };
    const plugin2: AppPlugin = { name: 'p2', register: vi.fn() };

    await applyPlugins(app, [plugin1, plugin2], { pool: mockPool, db: mockDb });

    expect(plugin1.register).toHaveBeenCalledOnce();
    expect(plugin1.register).toHaveBeenCalledWith(app, { pool: mockPool, db: mockDb });
    expect(plugin2.register).toHaveBeenCalledOnce();
    expect(plugin2.register).toHaveBeenCalledWith(app, { pool: mockPool, db: mockDb });
  });

  it('should resolve without error when plugins array is empty', async () => {
    await expect(applyPlugins(app, [], { pool: mockPool, db: mockDb })).resolves.toBeUndefined();
  });

  it('should await async register functions before returning', async () => {
    const order: string[] = [];
    const asyncPlugin: AppPlugin = {
      name: 'async',
      register: vi.fn(async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 10));
        order.push('plugin-done');
      }),
    };

    await applyPlugins(app, [asyncPlugin], { pool: mockPool, db: mockDb });
    order.push('after-apply');

    expect(order).toEqual(['plugin-done', 'after-apply']);
  });

  it('should call plugins in order', async () => {
    const callOrder: string[] = [];
    const pluginA: AppPlugin = { name: 'A', register: vi.fn(() => { callOrder.push('A'); }) };
    const pluginB: AppPlugin = { name: 'B', register: vi.fn(() => { callOrder.push('B'); }) };
    const pluginC: AppPlugin = { name: 'C', register: vi.fn(() => { callOrder.push('C'); }) };

    await applyPlugins(app, [pluginA, pluginB, pluginC], { pool: mockPool, db: mockDb });

    expect(callOrder).toEqual(['A', 'B', 'C']);
  });

  it('createApp() still works with no arguments (backward compat)', () => {
    expect(() => createApp()).not.toThrow();
    const a = createApp();
    expect(a).toBeDefined();
  });

  it('keeps /test/* returning 404 instead of SPA fallback in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const appWithPlugin = createApp();
      const pool = {} as Pool;
      const db = {} as DB;

      appWithPlugin.set('db', db);
      appWithPlugin.set('pool', pool);

      const { createTestFixturesNotFoundRouter } = await import('../../packages/saas/src/routes/test-fixtures.js');
      const saasPlugin: AppPlugin = {
        name: '@allo-scrapper/saas',
        register: async (app) => {
          app.use('/test', createTestFixturesNotFoundRouter());
        },
      };

      await applyPlugins(appWithPlugin, [saasPlugin], { pool, db });
      registerFallbackHandlers(appWithPlugin);

      const res = await request(appWithPlugin)
        .post('/test/seed-org')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('serializes plugin route errors with the shared JSON error handler', async () => {
    const appWithPlugin = createApp();
    const pool = {} as Pool;
    const db = {} as DB;

    appWithPlugin.set('db', db);
    appWithPlugin.set('pool', pool);

    const failingPlugin: AppPlugin = {
      name: 'failing-plugin',
      register: async (registeredApp) => {
        registeredApp.get('/api/plugin-error', (_req, _res, next) => {
          next(new AuthError('Plugin denied', 403));
        });
      },
    };

    await applyPlugins(appWithPlugin, [failingPlugin], { pool, db });
    registerFallbackHandlers(appWithPlugin);

    const res = await request(appWithPlugin)
      .get('/api/plugin-error')
      .expect(403);

    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toEqual({
      success: false,
      error: 'Plugin denied',
    });
  });
});
