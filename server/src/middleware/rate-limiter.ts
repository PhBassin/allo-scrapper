import type { Request, Response, NextFunction } from 'express';

export interface MutableConfig {
  max: number;
  windowMs: number;
}

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  config?: MutableConfig;
  message?: string | object;
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
    config,
    message = 'Too many requests, please try again later.',
    statusCode = 429,
    skip,
    keyGenerator,
    skipSuccessfulRequests = false,
    standardHeaders = false,
  } = options;

  function getMax(): number {
    return config ? config.max : (options.max ?? 100);
  }

  function getWindowMs(): number {
    return config ? config.windowMs : (options.windowMs ?? 60_000);
  }

  const hits = new Map<string, ClientRecord>();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(ip);
      }
    }
  }, getWindowMs());

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    if (skip && skip(req)) {
      return next();
    }

    const key = keyGenerator ? keyGenerator(req) : (req.ip || 'unknown-ip');
    const now = Date.now();
    const currentWindowMs = getWindowMs();
    const currentMax = getMax();

    let record = hits.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + currentWindowMs };
      hits.set(key, record);
    }

    record.count++;

    if (standardHeaders) {
      const remaining = Math.max(0, currentMax - record.count);
      const resetSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('RateLimit-Limit', currentMax);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', resetSeconds);
    }

    if (record.count > currentMax) {
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
