import type { Request } from 'express';
import { getSecrets, verifyWithMultipleSecrets } from '../utils/jwt-secrets.js';
import { createRateLimiter, ipKeyGenerator, type MutableConfig } from './rate-limiter.js';
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

export const generalLimiter = createRateLimiter({
  config: generalConfig,
  skip: skipTest,
  standardHeaders: true,
});

export const authLimiter = createRateLimiter({
  config: authConfig,
  skip: skipTest,
  skipSuccessfulRequests: true,
});

export const registerLimiter = createRateLimiter({
  config: registerConfig,
  skip: skipTest,
});

export const protectedLimiter = createRateLimiter({
  config: protectedConfig,
  skip: skipTest,
  keyGenerator: authenticatedKeyGenerator,
  standardHeaders: true,
});

export const scraperLimiter = createRateLimiter({
  config: scraperConfig,
  skip: skipTest,
  keyGenerator: authenticatedKeyGenerator,
});

export const publicLimiter = createRateLimiter({
  config: publicConfig,
  skip: skipTest,
});

export const healthCheckLimiter = createRateLimiter({
  config: healthCheckConfig,
  skip: skipInternal,
  standardHeaders: true,
  message: {
    success: false,
    error: 'Too many health check requests',
  },
});

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
}
