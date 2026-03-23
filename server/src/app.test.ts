import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DB } from './db/client.js';
import { createApp } from './app.js';

// Mock dependencies
vi.mock('./services/theme-generator.js');
vi.mock('./utils/logger.js');

import * as themeGenerator from './services/theme-generator.js';

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
    it('should return Prometheus metrics', async () => {
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
      const res = await request(app)
        .get('/api/health')
        .expect(200);

      const cspHeader = res.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();
      
      // CSP should allow fonts.googleapis.com for loading stylesheets
      expect(cspHeader).toMatch(/style-src-elem[^;]*https:\/\/fonts\.googleapis\.com/);
    });

    it('should allow Google Fonts CDN in CSP font-src', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect(200);

      const cspHeader = res.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();
      
      // CSP should allow fonts.gstatic.com for loading font files
      expect(cspHeader).toMatch(/font-src[^;]*https:\/\/fonts\.gstatic\.com/);
    });

    it('should maintain existing CSP directives', async () => {
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
