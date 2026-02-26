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
      ip: '127.0.0.1'
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
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

    // 3rd request should be blocked
    limiter(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Too many requests, please try again later.'
    }));
  });

  it('should reset the count after the window expires', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });

    limiter(req as Request, res as Response, next); // 1
    limiter(req as Request, res as Response, next); // 2

    // Advance time past the window
    vi.advanceTimersByTime(1001);

    limiter(req as Request, res as Response, next); // 3 (should be allowed now)

    expect(next).toHaveBeenCalledTimes(3);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should track different IPs independently', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });

    // Request from IP 1
    req.ip = '127.0.0.1';
    limiter(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Request from IP 2
    const req2 = { ...req, ip: '192.168.1.1' } as Partial<Request>;
    const next2 = vi.fn();

    limiter(req2 as Request, res as Response, next2);
    expect(next2).toHaveBeenCalledTimes(1); // IP 2 should be allowed

    // Second request from IP 1 should be blocked
    limiter(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1); // Still 1 call
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
