import { logger } from './logger.js';

/** Access-token lifetime used when `JWT_EXPIRES_IN` is unset. */
export const DEFAULT_JWT_EXPIRES_IN = '15m';

/** The configured access-token lifetime, as written in `JWT_EXPIRES_IN`. */
export function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN;
}

/**
 * Access-token lifetime in milliseconds. Single source of truth shared by the
 * JWT `exp` claim and the `access_token` cookie `maxAge`, so a leaked copy of
 * the token never outlives its cookie. Throws on an invalid `JWT_EXPIRES_IN`.
 */
export function getAccessTokenMaxAgeMs(): number {
  return parseConfiguredExpiry().ms;
}

/** The configured access-token lifetime, in the form `jwt.sign` expects. */
export function getJwtSignExpiresIn(): string | number {
  return parseConfiguredExpiry().jwtValue;
}

const UNIT_MS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 } as const;

/**
 * Upper bound on the access-token lifetime. Far above any sane value, it keeps
 * the cookie `expires` a valid date, so a typo fails at startup rather than
 * on every login.
 */
export const MAX_JWT_EXPIRES_IN_MS = 365 * UNIT_MS.d;

type ParsedExpiry = { jwtValue: string | number; ms: number };

/** Last parse of `JWT_EXPIRES_IN`, re-done only when the variable changes. */
let parsedConfig: { raw: string; parsed: ParsedExpiry } | undefined;

function parseConfiguredExpiry(): ParsedExpiry {
  const raw = getJwtExpiresIn();
  if (parsedConfig?.raw !== raw) {
    parsedConfig = { raw, parsed: parseExpiry(raw) };
  }
  return parsedConfig.parsed;
}

/**
 * The one grammar for `JWT_EXPIRES_IN`: returns both the value handed to
 * `jwt.sign` and the same duration in milliseconds.
 */
function parseExpiry(value: string): ParsedExpiry {
  const trimmed = value.trim();

  if (!trimmed) {
    logger.error('JWT_EXPIRES_IN cannot be empty');
    throw new Error('Invalid JWT_EXPIRES_IN format: value cannot be empty');
  }

  // Human-readable (passed to jwt.sign as-is) or plain seconds (as a number)
  const match = trimmed.match(/^(\d+)([hdms])?$/);
  if (!match) {
    logger.error(`Invalid JWT_EXPIRES_IN format: ${trimmed}`);
    throw new Error(
      `Invalid JWT_EXPIRES_IN format: "${trimmed}". ` +
      `Expected human-readable (e.g., '24h', '7d') or seconds as number (e.g., '86400')`
    );
  }

  const num = parseInt(match[1], 10);
  if (num <= 0) {
    logger.error(`JWT_EXPIRES_IN must be positive: ${trimmed}`);
    throw new Error('Invalid JWT_EXPIRES_IN format: value must be positive');
  }

  const unit = (match[2] ?? 's') as keyof typeof UNIT_MS;
  const ms = num * UNIT_MS[unit];
  if (ms > MAX_JWT_EXPIRES_IN_MS) {
    logger.error(`JWT_EXPIRES_IN exceeds 365 days: ${trimmed}`);
    throw new Error('Invalid JWT_EXPIRES_IN format: value must not exceed 365 days');
  }

  return { jwtValue: match[2] ? trimmed : num, ms };
}

/**
 * Above this, a stolen access token stays usable for a long time unless a
 * credential change bumps the user's token version. Renewal is silent, so
 * there is rarely a reason to go beyond it.
 */
export const LONG_JWT_EXPIRES_IN_MS = UNIT_MS.h;

/**
 * Startup check: log a warning when `JWT_EXPIRES_IN` exceeds one hour (e.g. a
 * `24h` kept from the former compose default). Throws on an invalid value.
 */
export function warnIfLongJwtExpiresIn(): void {
  if (getAccessTokenMaxAgeMs() > LONG_JWT_EXPIRES_IN_MS) {
    logger.warn(
      `⚠️  JWT_EXPIRES_IN (${getJwtExpiresIn()}) exceeds 1h: a stolen access token stays usable that long ` +
      `unless a password or role change revokes it. Renewal is silent; keep it short (default ${DEFAULT_JWT_EXPIRES_IN}).`
    );
  }
}
