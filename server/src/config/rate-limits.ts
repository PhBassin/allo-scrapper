import type { DB } from '../db/client.js';

export interface RateLimitConfig {
  windowMs: number;
  generalMax: number;
  authMax: number;
  registerMax: number;
  registerWindowMs: number;
  protectedMax: number;
  scraperMax: number;
  publicMax: number;
  healthMax: number;
  healthWindowMs: number;
}

// Default values (fallback)
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  generalMax: 100,
  authMax: 5,
  registerMax: 3,
  registerWindowMs: 60 * 60 * 1000, // 1 hour
  protectedMax: 60,
  scraperMax: 10,
  publicMax: 100,
  healthMax: 10,
  healthWindowMs: 60 * 1000, // 1 minute
};

// In-memory cache with timestamp for hot reload
let cachedConfig: RateLimitConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Get rate limit configuration with priority:
 * 1. Database (cached for 30s)
 * 2. Environment variables
 * 3. Default values
 */
export async function getRateLimitConfig(db?: DB): Promise<RateLimitConfig> {
  const now = Date.now();
  
  // Return cached config if still valid
  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedConfig;
  }
  
  // Try to load from database
  if (db) {
    try {
      const result = await db.query<{
        window_ms: number;
        general_max: number;
        auth_max: number;
        register_max: number;
        register_window_ms: number;
        protected_max: number;
        scraper_max: number;
        public_max: number;
        health_max: number;
        health_window_ms: number;
      }>('SELECT * FROM rate_limit_configs WHERE id = 1');
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        cachedConfig = {
          windowMs: row.window_ms,
          generalMax: row.general_max,
          authMax: row.auth_max,
          registerMax: row.register_max,
          registerWindowMs: row.register_window_ms,
          protectedMax: row.protected_max,
          scraperMax: row.scraper_max,
          publicMax: row.public_max,
          healthMax: row.health_max,
          healthWindowMs: row.health_window_ms,
        };
        cacheTimestamp = now;
        return cachedConfig;
      }
    } catch (error) {
      console.warn('Failed to load rate limit config from database, falling back to env vars', error);
    }
  }
  
  // Fallback to environment variables or defaults
  const parseEnvInt = (key: string, defaultValue: number): number => {
    const val = process.env[key];
    return val ? parseInt(val, 10) : defaultValue;
  };
  
  cachedConfig = {
    windowMs: parseEnvInt('RATE_LIMIT_WINDOW_MS', DEFAULT_CONFIG.windowMs),
    generalMax: parseEnvInt('RATE_LIMIT_GENERAL_MAX', DEFAULT_CONFIG.generalMax),
    authMax: parseEnvInt('RATE_LIMIT_AUTH_MAX', DEFAULT_CONFIG.authMax),
    registerMax: parseEnvInt('RATE_LIMIT_REGISTER_MAX', DEFAULT_CONFIG.registerMax),
    registerWindowMs: parseEnvInt('RATE_LIMIT_REGISTER_WINDOW_MS', DEFAULT_CONFIG.registerWindowMs),
    protectedMax: parseEnvInt('RATE_LIMIT_PROTECTED_MAX', DEFAULT_CONFIG.protectedMax),
    scraperMax: parseEnvInt('RATE_LIMIT_SCRAPER_MAX', DEFAULT_CONFIG.scraperMax),
    publicMax: parseEnvInt('RATE_LIMIT_PUBLIC_MAX', DEFAULT_CONFIG.publicMax),
    healthMax: parseEnvInt('RATE_LIMIT_HEALTH_MAX', DEFAULT_CONFIG.healthMax),
    healthWindowMs: parseEnvInt('RATE_LIMIT_HEALTH_WINDOW_MS', DEFAULT_CONFIG.healthWindowMs),
  };
  
  cacheTimestamp = now;
  return cachedConfig;
}

/**
 * Invalidate cache to force reload from database on next request
 * Called after updating rate limit configs via admin API
 */
export function invalidateRateLimitCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

/**
 * Get default configuration values
 */
export function getDefaultConfig(): RateLimitConfig {
  return { ...DEFAULT_CONFIG };
}
