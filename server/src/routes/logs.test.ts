import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock logger BEFORE importing the router
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { logger } from '../utils/logger.js';
import logsRouter from './logs.js';

describe('POST /api/logs', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/logs', logsRouter);
    vi.clearAllMocks();
  });

  it('should accept a valid error log entry and re-log via logger.error', async () => {
    const payload = {
      level: 'error',
      message: 'Failed to parse SSE event',
      context: { component: 'client.ts', detail: 'Unexpected token' },
    };

    const res = await request(app).post('/api/logs').send(payload);

    expect(res.status).toBe(204);
    expect(vi.mocked(logger.error)).toHaveBeenCalledOnce();
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      payload.message,
      expect.objectContaining({ source: 'client', context: payload.context }),
    );
  });

  it('should accept a valid warn log entry and re-log via logger.warn', async () => {
    const payload = {
      level: 'warn',
      message: 'Failed to load font',
      context: { font: 'CustomFont' },
    };

    const res = await request(app).post('/api/logs').send(payload);

    expect(res.status).toBe(204);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledOnce();
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      payload.message,
      expect.objectContaining({ source: 'client', context: payload.context }),
    );
  });

  it('should return 400 when level is missing', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({ message: 'Something happened' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when message is missing', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({ level: 'error' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 for an unknown log level', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({ level: 'debug', message: 'Debug message' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should accept an entry without a context field', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({ level: 'error', message: 'Something broke' });

    expect(res.status).toBe(204);
    expect(vi.mocked(logger.error)).toHaveBeenCalledOnce();
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Something broke',
      expect.objectContaining({ source: 'client' }),
    );
  });

  it('should not call logger for non-string message values', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({ level: 'error', message: 12345 });

    expect(res.status).toBe(400);
    expect(vi.mocked(logger.error)).not.toHaveBeenCalled();
  });
});
