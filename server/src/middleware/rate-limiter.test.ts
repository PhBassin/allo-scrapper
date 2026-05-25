import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from './rate-limiter.js';
import type { Request, Response, NextFunction } from 'express';

describe('Rate Limiter Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.useFakeTimers();
    req = {
      headers: {},
      socket: { remoteAddress: '127.0.0.1' } as any,
      ip: '127.0.0.1',
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      statusCode: 200,
    };
    next = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests under the limit', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });

    limiter(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);

    limiter(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('should block requests over the limit', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });

    limiter(req as Request, res as Response, next); // 1
    limiter(req as Request, res as Response, next); // 2

    limiter(req as Request, res as Response, next); // 3

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Too many requests, please try again later.',
    }));
  });

  it('should reset the count after the window expires', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });

    limiter(req as Request, res as Response, next); // 1
    limiter(req as Request, res as Response, next); // 2

    vi.advanceTimersByTime(1001);

    limiter(req as Request, res as Response, next); // 3

    expect(next).toHaveBeenCalledTimes(3);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should track different IPs independently', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });

    req.ip = '127.0.0.1';
    limiter(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);

    const req2 = { ...req, ip: '192.168.1.1' } as Partial<Request>;
    const next2 = vi.fn();

    limiter(req2 as Request, res as Response, next2);
    expect(next2).toHaveBeenCalledTimes(1);

    limiter(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  describe('skip option', () => {
    it('should skip rate limiting when skip function returns true', () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 1,
        skip: () => true,
      });

      limiter(req as Request, res as Response, next);
      limiter(req as Request, res as Response, next);
      limiter(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledTimes(3);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should apply rate limiting when skip function returns false', () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 1,
        skip: () => false,
      });

      limiter(req as Request, res as Response, next); // 1
      limiter(req as Request, res as Response, next); // 2

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should skip rate limiting for specific IPs', () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 1,
        skip: (r) => r.ip === '127.0.0.1',
      });

      limiter(req as Request, res as Response, next);
      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(2);

      const externalReq = { ...req, ip: '203.0.113.1' } as Partial<Request>;
      const externalNext = vi.fn();
      limiter(externalReq as Request, res as Response, externalNext);
      limiter(externalReq as Request, res as Response, externalNext);
      expect(externalNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('keyGenerator option', () => {
    it('should use custom key generator for rate limit bucketing', () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 1,
        keyGenerator: () => 'custom-key',
        skip: () => false,
      });

      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);

      const req2 = { ...req, ip: '192.168.1.1' } as Partial<Request>;
      const next2 = vi.fn();
      limiter(req2 as Request, res as Response, next2);
      expect(next2).not.toHaveBeenCalled();
    });
  });

  describe('skipSuccessfulRequests option', () => {
    it('should not count successful responses toward the limit', () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 2,
        skipSuccessfulRequests: true,
      });

      for (let i = 0; i < 3; i++) {
        res.statusCode = 200;
        limiter(req as Request, res as Response, next);
        (res.json as any)({ success: true });
      }

      expect(next).toHaveBeenCalledTimes(3);
      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should count failed responses toward the limit', () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 2,
        skipSuccessfulRequests: true,
      });

      res.statusCode = 401;
      limiter(req as Request, res as Response, next);
      (res.json as any)({ success: false });

      res.statusCode = 401;
      limiter(req as Request, res as Response, next);
      (res.json as any)({ success: false });

      limiter(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('standardHeaders option', () => {
    it('should set RateLimit-* headers when standardHeaders is true', () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 5,
        standardHeaders: true,
      });

      limiter(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Limit', 5);
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', expect.any(Number));
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Reset', expect.any(Number));
    });

    it('should not set RateLimit-* headers when standardHeaders is false', () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 5,
        standardHeaders: false,
      });

      limiter(req as Request, res as Response, next);

      expect(res.setHeader).not.toHaveBeenCalledWith('RateLimit-Limit', expect.anything());
    });

    it('should set correct remaining count', () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 5,
        standardHeaders: true,
      });

      limiter(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 4);
    });
  });

  describe('custom message', () => {
    it('should return custom message when rate limited', () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 1,
        message: { success: false, error: 'Custom error message' },
      });

      limiter(req as Request, res as Response, next);
      limiter(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Custom error message' });
    });
  });

  describe('custom status code', () => {
    it('should use custom status code when rate limited', () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 1,
        statusCode: 503,
      });

      limiter(req as Request, res as Response, next);
      limiter(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(503);
    });
  });
});
