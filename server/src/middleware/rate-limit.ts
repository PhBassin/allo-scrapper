import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { validateJWTSecret } from '../utils/jwt-secret-validator.js';

const JWT_SECRET = validateJWTSecret();

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
 * Key generator that buckets authenticated requests by user id.
 * Falls back to req.ip for unauthenticated requests.
 * Uses jwt.verify to securely validate tokens before extracting the ID to prevent
 * DoS via quota exhaustion (unverified tokens allow spoofing IDs).
 */
export const authenticatedKeyGenerator = (req: Request): string => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as { id?: number };
      if (decoded?.id) return `user:${decoded.id}`;
    }
  } catch {
    // fall through to IP fallback
  }
  return ipKeyGenerator(req.ip ?? 'unknown');
};

// General API rate limiter (applies to all /api/* routes)
export const generalLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: parseEnvInt('RATE_LIMIT_GENERAL_MAX', 100),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipTest,
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
  message: {
    success: false,
    error: 'Too many requests to this resource, please try again later.',
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
  skip: (req) => {
    // Exempt internal IPs (localhost, Docker, Kubernetes health probes)
    const internalIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    return internalIPs.includes(req.ip ?? '');
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many health check requests',
  },
});

