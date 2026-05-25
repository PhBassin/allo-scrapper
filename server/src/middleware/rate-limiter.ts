import type { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  statusCode?: number;
  skip?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  standardHeaders?: boolean;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    statusCode = 429,
    skip,
    keyGenerator,
    skipSuccessfulRequests = false,
    standardHeaders = false,
  } = options;

  const hits = new Map<string, ClientRecord>();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(ip);
      }
    }
  }, windowMs);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    if (skip && skip(req)) {
      return next();
    }

    const key = keyGenerator ? keyGenerator(req) : (req.ip || 'unknown-ip');
    const now = Date.now();

    let record = hits.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      hits.set(key, record);
    }

    record.count++;

    if (standardHeaders) {
      const remaining = Math.max(0, max - record.count);
      const resetSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('RateLimit-Limit', max);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', resetSeconds);
    }

    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      const body = typeof message === 'string'
        ? { success: false, error: message }
        : message;
      return res.status(statusCode).json(body);
    }

    if (skipSuccessfulRequests) {
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          record.count = Math.max(0, record.count - 1);
        }
        return originalJson(body);
      };
    }

    next();
  };
}

export function ipKeyGenerator(ip: string): string {
  return ip;
}
