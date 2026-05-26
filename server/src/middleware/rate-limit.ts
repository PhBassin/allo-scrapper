import type { Request } from 'express';
import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { getSecrets, verifyWithMultipleSecrets } from '../utils/jwt-secrets.js';
import { ipKeyGenerator, type MutableConfig } from './rate-limiter.js';
import { logger } from '../utils/logger.js';

// Fail-fast: validate secrets at module load
getSecrets();

const parseEnvInt = (key: string, defaultValue: number): number => {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
};

const defaultWindowMs = parseEnvInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);

const skipTest = (req: any) => !req.ip;

const generalConfig: MutableConfig = {
  windowMs: defaultWindowMs,
  max: parseEnvInt('RATE_LIMIT_GENERAL_MAX', 100),
};

const authConfig: MutableConfig = {
  windowMs: defaultWindowMs,
  max: parseEnvInt('RATE_LIMIT_AUTH_MAX', 5),
};

const registerConfig: MutableConfig = {
  windowMs: parseEnvInt('RATE_LIMIT_REGISTER_WINDOW_MS', 60 * 60 * 1000),
  max: parseEnvInt('RATE_LIMIT_REGISTER_MAX', 3),
};

const protectedConfig: MutableConfig = {
  windowMs: defaultWindowMs,
  max: parseEnvInt('RATE_LIMIT_PROTECTED_MAX', 60),
};

const scraperConfig: MutableConfig = {
  windowMs: defaultWindowMs,
  max: parseEnvInt('RATE_LIMIT_SCRAPER_MAX', 10),
};

const publicConfig: MutableConfig = {
  windowMs: defaultWindowMs,
  max: parseEnvInt('RATE_LIMIT_PUBLIC_MAX', 100),
};

const healthCheckConfig: MutableConfig = {
  windowMs: 60 * 1000,
  max: parseEnvInt('RATE_LIMIT_HEALTH_MAX', 10),
};

const internalIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
const skipInternal = (req: any) => internalIPs.includes(req.ip ?? '');

const createLimiterDelegate = (
  config: MutableConfig,
  options: {
    skip?: (req: Request) => boolean;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    standardHeaders?: boolean;
    message?: string | object;
  } = {}
): RequestHandler => rateLimit({
  windowMs: config.windowMs,
  limit: config.max,
  skip: options.skip,
  keyGenerator: options.keyGenerator,
  skipSuccessfulRequests: options.skipSuccessfulRequests,
  standardHeaders: options.standardHeaders,
  legacyHeaders: false,
  message: options.message,
  validate: false,
});

const createRefreshableLimiter = (
  config: MutableConfig,
  options: {
    skip?: (req: Request) => boolean;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    standardHeaders?: boolean;
    message?: string | object;
  } = {}
): { handler: RequestHandler; refresh: () => void } => {
  let delegate = createLimiterDelegate(config, options);

  return {
    handler(req, res, next) {
      return delegate(req, res, next);
    },
    refresh() {
      delegate = createLimiterDelegate(config, options);
    },
  };
};

export const authenticatedKeyGenerator = (req: Request): string => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const verified = verifyWithMultipleSecrets(token, getSecrets()) as { id?: number } | null;
      if (verified?.id) return `user:${verified.id}`;
    }
  } catch (err) {
    logger.warn('Authenticated key generator fallback to IP', { error: err instanceof Error ? err.message : String(err) });
    // fall through to IP fallback
  }
  return ipKeyGenerator(req.ip ?? 'unknown');
};

const generalLimiterMiddleware = createRefreshableLimiter(generalConfig, {
  skip: skipTest,
  standardHeaders: true,
});
export const generalLimiter = generalLimiterMiddleware.handler;

const authLimiterMiddleware = createRefreshableLimiter(authConfig, {
  skip: skipTest,
  skipSuccessfulRequests: true,
});
export const authLimiter = authLimiterMiddleware.handler;

const registerLimiterMiddleware = createRefreshableLimiter(registerConfig, {
  skip: skipTest,
});
export const registerLimiter = registerLimiterMiddleware.handler;

const protectedLimiterMiddleware = createRefreshableLimiter(protectedConfig, {
  skip: skipTest,
  keyGenerator: authenticatedKeyGenerator,
  standardHeaders: true,
});
export const protectedLimiter = protectedLimiterMiddleware.handler;

const scraperLimiterMiddleware = createRefreshableLimiter(scraperConfig, {
  skip: skipTest,
  keyGenerator: authenticatedKeyGenerator,
});
export const scraperLimiter = scraperLimiterMiddleware.handler;

const publicLimiterMiddleware = createRefreshableLimiter(publicConfig, {
  skip: skipTest,
});
export const publicLimiter = publicLimiterMiddleware.handler;

const healthCheckLimiterMiddleware = createRefreshableLimiter(healthCheckConfig, {
  skip: skipInternal,
  standardHeaders: true,
  message: {
    success: false,
    error: 'Too many health check requests',
  },
});
export const healthCheckLimiter = healthCheckLimiterMiddleware.handler;

interface RefreshConfig {
  windowMs?: number;
  generalMax?: number;
  authMax?: number;
  registerMax?: number;
  registerWindowMs?: number;
  protectedMax?: number;
  scraperMax?: number;
  publicMax?: number;
  healthMax?: number;
  healthWindowMs?: number;
}

export function refreshRateLimits(newConfig: RefreshConfig): void {
  if (newConfig.windowMs !== undefined) {
    const val = newConfig.windowMs;
    generalConfig.windowMs = val;
    authConfig.windowMs = val;
    protectedConfig.windowMs = val;
    scraperConfig.windowMs = val;
    publicConfig.windowMs = val;
  }
  if (newConfig.registerWindowMs !== undefined) {
    registerConfig.windowMs = newConfig.registerWindowMs;
  }
  if (newConfig.healthWindowMs !== undefined) {
    healthCheckConfig.windowMs = newConfig.healthWindowMs;
  }
  if (newConfig.generalMax !== undefined) generalConfig.max = newConfig.generalMax;
  if (newConfig.authMax !== undefined) authConfig.max = newConfig.authMax;
  if (newConfig.registerMax !== undefined) registerConfig.max = newConfig.registerMax;
  if (newConfig.protectedMax !== undefined) protectedConfig.max = newConfig.protectedMax;
  if (newConfig.scraperMax !== undefined) scraperConfig.max = newConfig.scraperMax;
  if (newConfig.publicMax !== undefined) publicConfig.max = newConfig.publicMax;
  if (newConfig.healthMax !== undefined) healthCheckConfig.max = newConfig.healthMax;

  generalLimiterMiddleware.refresh();
  authLimiterMiddleware.refresh();
  registerLimiterMiddleware.refresh();
  protectedLimiterMiddleware.refresh();
  scraperLimiterMiddleware.refresh();
  publicLimiterMiddleware.refresh();
  healthCheckLimiterMiddleware.refresh();
}
