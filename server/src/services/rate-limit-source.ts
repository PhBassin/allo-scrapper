import type { DB } from '../db/index.js';

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

export interface RateLimitConfigRow {
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
  updated_at: string;
  updated_by: number | null;
  environment: string;
}

export interface RateLimitAuditInfo {
  config: RateLimitConfig;
  source: 'database' | 'env' | 'default';
  updatedAt: string | null;
  updatedBy: { id: number; username: string } | null;
  environment: string | null;
}

export const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  generalMax: 100,
  authMax: 5,
  registerMax: 3,
  registerWindowMs: 60 * 60 * 1000,
  protectedMax: 60,
  scraperMax: 10,
  publicMax: 100,
  healthMax: 10,
  healthWindowMs: 60 * 1000,
};

const RATE_LIMIT_ENV_KEYS = [
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_GENERAL_MAX',
  'RATE_LIMIT_AUTH_MAX',
  'RATE_LIMIT_REGISTER_MAX',
  'RATE_LIMIT_REGISTER_WINDOW_MS',
  'RATE_LIMIT_PROTECTED_MAX',
  'RATE_LIMIT_SCRAPER_MAX',
  'RATE_LIMIT_PUBLIC_MAX',
  'RATE_LIMIT_HEALTH_MAX',
  'RATE_LIMIT_HEALTH_WINDOW_MS',
] as const;

function parseEnvInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (!val) return defaultValue;
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function readFromEnv(): RateLimitConfig {
  return {
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
}

let current: RateLimitConfig = readFromEnv();

export function getCurrentConfig(): RateLimitConfig {
  return current;
}

function rowToConfig(row: RateLimitConfigRow): RateLimitConfig {
  return {
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
}

function sameConfig(a: RateLimitConfig, b: RateLimitConfig): boolean {
  return (Object.keys(a) as (keyof RateLimitConfig)[]).every((key) => a[key] === b[key]);
}

export async function loadFromDb(db: DB): Promise<boolean> {
  try {
    const result = await db.query<RateLimitConfigRow>(
      'SELECT * FROM rate_limit_configs WHERE id = 1'
    );
    if (result.rows.length === 0) {
      return false;
    }
    const loaded = rowToConfig(result.rows[0]);
    // Subscribers rebuild the limiters, which empties their counters, so the
    // periodic reload of an unchanged row must not notify them.
    if (!sameConfig(current, loaded)) {
      current = loaded;
      notify();
    }
    return true;
  } catch {
    return false;
  }
}

const subscribers = new Set<() => void>();

export function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function notify(): void {
  for (const cb of subscribers) {
    try {
      cb();
    } catch {
      // isolate subscriber failures so one bad listener cannot block refresh
    }
  }
}

function hasAnyEnvOverride(): boolean {
  for (const key of RATE_LIMIT_ENV_KEYS) {
    if (process.env[key] !== undefined && process.env[key] !== '') return true;
  }
  return false;
}

export async function getAuditInfo(db: DB): Promise<RateLimitAuditInfo> {
  try {
    const result = await db.query<RateLimitConfigRow>(
      'SELECT * FROM rate_limit_configs WHERE id = 1'
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      let updatedBy: { id: number; username: string } | null = null;
      if (row.updated_by !== null) {
        try {
          const userResult = await db.query<{ username: string }>(
            'SELECT username FROM users WHERE id = $1',
            [row.updated_by]
          );
          updatedBy = {
            id: row.updated_by,
            username: userResult.rows[0]?.username ?? '',
          };
        } catch {
          updatedBy = { id: row.updated_by, username: '' };
        }
      }
      return {
        config: rowToConfig(row),
        source: 'database',
        updatedAt: row.updated_at,
        updatedBy,
        environment: row.environment,
      };
    }
  } catch {
    // fall through to env / default audit shape
  }

  return {
    config: getCurrentConfig(),
    source: hasAnyEnvOverride() ? 'env' : 'default',
    updatedAt: null,
    updatedBy: null,
    environment: null,
  };
}
