import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { AppError } from '../utils/errors.js';

const { loggerErrorMock, loggerWarnMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    error: loggerErrorMock,
    warn: loggerWarnMock,
  },
}));

import { errorHandler } from './error-handler.js';

describe('errorHandler middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle SyntaxError from express.json() with 400 status', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', (req, res) => {
      res.status(200).json({ success: true });
    });
    app.use(errorHandler);

    // Send malformed JSON string directly
    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send('{"invalid": json}'); 

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: 'Invalid JSON payload'
    });
  });

  it('logs tenant context fields for AppError payloads', async () => {
    const app = express();

    app.get('/tenant', (req, _res, next) => {
      (req as express.Request & { user?: { id: number; org_id: number } }).user = {
        id: 11,
        org_id: 22,
      };
      next(new AppError('Forbidden', 403, { code: 'INSUFFICIENT_PRIVILEGES' }));
    });

    app.use(errorHandler);

    const res = await request(app).get('/tenant');

    expect(res.status).toBe(403);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'App Error [403]',
      expect.objectContaining({
        org_id: 22,
        user_id: 11,
        endpoint: '/tenant',
        error: 'Forbidden',
      })
    );
  });

  it('logs sanitized endpoint path without query string', async () => {
    const app = express();

    app.get('/tenant', (req, _res, next) => {
      (req as express.Request & { user?: { id: number; org_id: number } }).user = {
        id: 11,
        org_id: 22,
      };
      next(new AppError('Forbidden', 403));
    });

    app.use(errorHandler);

    const res = await request(app).get('/tenant?token=secret');

    expect(res.status).toBe(403);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'App Error [403]',
      expect.objectContaining({
        endpoint: '/tenant',
      })
    );
  });
});
