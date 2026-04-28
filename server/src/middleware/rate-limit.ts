import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';

const LOCALHOST_IPS = new Set(['127.0.0.1', '::1']);

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
  /^fc/i,
  /^fd/i,
  /^fe80:/i,
];

// Helper to parse env var as number with fallback
const parseEnvInt = (key: string, defaultValue: number): number => {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
};

/**
 * Note: Rate limiters are currently initialized at module load time with values from environment variables.
 * 
 * Dynamic configuration via database (rate_limit_configs table) is available but requires server restart
 * to take effect on these middleware instances. This is acceptable for most use cases as rate limit
 * changes are infrequent and coordinated during maintenance windows.
 * 
 * The database configuration takes precedence during application initialization. After the server starts,
 * these limiters use the values that were loaded at startup time.
 * 
 * For more details on the dynamic configuration system, see:
 * - server/src/config/rate-limits.ts (config loader with caching)
 * - server/src/routes/admin/rate-limits.ts (admin API endpoints)
 * - migrations/017_add_rate_limit_configs.sql (database schema)
 */

// Skip rate limiting in test environment
const skipTest = (req: any) => process.env.NODE_ENV === 'test' || !req.ip;

// Window duration in milliseconds
const WINDOW_MS = parseEnvInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000); // 15 min

/**
 * Key generator for authenticated requests.
 *
 * Tenant users often reuse small integer ids within different org schemas, so
 * bucketing on `id` alone causes cross-tenant limiter collisions. Use the
 * decoded JWT identity fields together to derive a stable per-user bucket.
 * Falls back to req.ip for unauthenticated requests.
 */
export const authenticatedKeyGenerator = (req: Request): string => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.decode(token) as {
        id?: number | string;
        username?: string;
        org_slug?: string;
        scope?: string;
      } | null;

      if (decoded) {
        const parts: string[] = [];

        if (decoded.scope) {
          parts.push(`scope:${decoded.scope}`);
        }
        if (decoded.org_slug) {
          parts.push(`org:${decoded.org_slug}`);
        }
        if (decoded.username) {
          parts.push(`username:${decoded.username}`);
        }
        if (decoded.id != null) {
          parts.push(`id:${String(decoded.id)}`);
        }

        if (parts.length > 0) {
          return parts.join('|');
        }
      }
    }
  } catch {
    // fall through to IP fallback
  }
  return ipKeyGenerator(req.ip ?? 'unknown');
};

const normalizeIp = (value: string): string => value.replace(/^::ffff:/, '');

const isLoopbackIp = (value: string): boolean => LOCALHOST_IPS.has(normalizeIp(value));

const isPrivateIp = (value: string): boolean => PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(normalizeIp(value)));

export const isTrustedLocalHealthProbe = (req: Request): boolean => {
  const forwardedIp = normalizeIp(req.ip ?? '');
  const socketIp = normalizeIp(req.socket.remoteAddress ?? '');
  const rawForwardedFor = req.headers?.['x-forwarded-for'];

  const forwardedChain = (Array.isArray(rawForwardedFor) ? rawForwardedFor.join(',') : rawForwardedFor ?? '')
    .split(',')
    .map((value) => normalizeIp(value.trim()))
    .filter(Boolean);

  if (!isLoopbackIp(forwardedIp)) {
    return false;
  }

  if (!(isLoopbackIp(socketIp) || isPrivateIp(socketIp))) {
    return false;
  }

  return forwardedChain.every(isLoopbackIp);
};

const getRetryAfterSeconds = (req: Request): number | undefined => {
  const rateLimitState = (req as Request & { rateLimit?: { resetTime?: Date | number } }).rateLimit;
  const resetTime = rateLimitState?.resetTime;

  if (resetTime instanceof Date) {
    return Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
  }

  if (typeof resetTime === 'number') {
    return Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
  }

  return undefined;
};

const sendRateLimitedJson = (req: Request, res: Response, error: string): void => {
  const retryAfterSeconds = getRetryAfterSeconds(req);

  if (retryAfterSeconds !== undefined) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
  }

  res.status(429).json({
    success: false,
    error,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  });
};

// General API rate limiter (applies to all /api/* routes)
export const generalLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: parseEnvInt('RATE_LIMIT_GENERAL_MAX', 100),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipTest,
  keyGenerator: authenticatedKeyGenerator,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
});

// Strict limiter for authentication endpoints (login)
export const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: parseEnvInt('RATE_LIMIT_AUTH_MAX', 5),
  skipSuccessfulRequests: true, // Don't count successful logins
  skip: skipTest,
  message: {
    success: false,
    error: 'Too many login attempts, please try again after 15 minutes.',
  },
});

// Strict limiter for registration
export const registerLimiter = rateLimit({
  windowMs: parseEnvInt('RATE_LIMIT_REGISTER_WINDOW_MS', 60 * 60 * 1000), // 1 hour
  max: parseEnvInt('RATE_LIMIT_REGISTER_MAX', 3),
  skip: skipTest,
  message: {
    success: false,
    error: 'Too many registration attempts, please try again later.',
  },
});

// Moderate limiter for protected data endpoints (reports)
export const protectedLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: parseEnvInt('RATE_LIMIT_PROTECTED_MAX', 60),
  skip: skipTest,
  keyGenerator: authenticatedKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendRateLimitedJson(req, res, 'Too many requests to this resource, please try again later.');
  },
});

// Very strict limiter for expensive operations (scraping)
export const scraperLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: parseEnvInt('RATE_LIMIT_SCRAPER_MAX', 10),
  skip: skipTest,
  keyGenerator: authenticatedKeyGenerator,
  message: {
    success: false,
    error: 'Too many scrape requests, please try again later.',
  },
});

// Moderate limiter for public read endpoints (cinemas, films)
export const publicLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: parseEnvInt('RATE_LIMIT_PUBLIC_MAX', 100),
  skip: skipTest,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
});

// Aggressive limiter for health check endpoint
// Prevents resource exhaustion attacks on publicly accessible endpoint
export const healthCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseEnvInt('RATE_LIMIT_HEALTH_MAX', 10),
  skip: isTrustedLocalHealthProbe,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many health check requests',
  },
});
