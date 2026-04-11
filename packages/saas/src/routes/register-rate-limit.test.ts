import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

function buildApp(dbOverride?: object) {
  const app = express();
  app.use(express.json());

  const db = dbOverride ?? {
    query: vi.fn().mockResolvedValue({ rows: [{ count: '0' }], rowCount: 1 }),
  };
  app.set('db', db);

  return app;
}

describe('GET /api/saas/orgs/:slug/available Rate Limiting', () => {
  beforeEach(() => {
    vi.stubEnv('RATE_LIMIT_SAAS_SLUG_MAX', '2');
    vi.resetModules();
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const app = buildApp();
    const { createRegisterRouter } = await import('./register.js');
    app.use('/api', createRegisterRouter());

    // First request
    await request(app).get('/api/saas/orgs/slug1/available').expect(200);
    // Second request
    await request(app).get('/api/saas/orgs/slug2/available').expect(200);
    // Third request - should be rate limited
    const res = await request(app).get('/api/saas/orgs/slug3/available');
    
    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Too many');
  });
});
