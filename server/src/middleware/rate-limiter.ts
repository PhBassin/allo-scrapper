import type { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  statusCode?: number;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

/**
 * Creates a simple in-memory rate limiter middleware.
 *
 * @param options Configuration options for the rate limiter
 * @returns Express middleware function
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    statusCode = 429
  } = options;

  const hits = new Map<string, ClientRecord>();

  // Cleanup mechanism to prevent memory leaks
  // Runs every windowMs to remove expired entries
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(ip);
      }
    }
  }, windowMs);

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    // Use req.ip which handles proxy trust via app settings
    // Default is req.socket.remoteAddress
    const ip = req.ip || 'unknown-ip';
    const now = Date.now();

    let record = hits.get(ip);

    // If no record or window expired, start new window
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      hits.set(ip, record);
      return next();
    }

    // Increment count
    record.count++;

    // Check limit
    if (record.count > max) {
      // Set Retry-After header
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);

      return res.status(statusCode).json({
        success: false,
        error: message
      });
    }

    next();
  };
}
