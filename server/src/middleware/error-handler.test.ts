import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from './error-handler.js';
import { AppError, ValidationError, TheaterNotFoundError } from '../utils/errors.js';

describe('Error Handler Middleware', () => {
  let app: express.Application;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Non-production environment (development/test)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should pass through the original message and details for 5xx AppError', async () => {
      app.get('/error-500', (_req, _res, next) => {
        next(new AppError('Database connection failed', 500, [{ code: 'ECONNREFUSED' }]));
      });
      app.use(errorHandler);

      const response = await request(app).get('/error-500');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Database connection failed',
        details: [{ code: 'ECONNREFUSED' }],
      });
    });

    it('should pass through the original message for generic 500 error', async () => {
      app.get('/error-generic', (_req, _res, next) => {
        next(new Error('Something went horribly wrong internally'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/error-generic');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Something went horribly wrong internally',
      });
    });
  });

  describe('Production environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should sanitize 5xx AppError message and omit details', async () => {
      app.get('/error-500-prod', (_req, _res, next) => {
        next(new AppError('Database connection failed', 500, [{ code: 'ECONNREFUSED' }]));
      });
      app.use(errorHandler);

      const response = await request(app).get('/error-500-prod');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error',
      });
    });

    it('should sanitize generic unhandled 500 error message', async () => {
      app.get('/error-generic-prod', (_req, _res, next) => {
        next(new Error('System-level memory leak / stack overflow'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/error-generic-prod');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error',
      });
    });

    it('should return 404 and preserve message for TheaterNotFoundError', async () => {
      app.get('/error-theater', (_req, _res, next) => {
        next(new TheaterNotFoundError('C0153'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/error-theater');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Theater not found: C0153',
      });
    });

    it('should NOT sanitize or strip details from 4xx errors (e.g., Validation Errors)', async () => {
      app.get('/error-400-prod', (_req, _res, next) => {
        next(new ValidationError('Invalid user input', [{ field: 'email', message: 'Email must be valid' }]));
      });
      app.use(errorHandler);

      const response = await request(app).get('/error-400-prod');
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid user input',
        details: [{ field: 'email', message: 'Email must be valid' }],
      });
    });
  });
});
