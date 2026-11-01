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
  return parseExpiry(getJwtExpiresIn()).ms;
}

const UNIT_MS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 } as const;

/**
 * The one grammar for `JWT_EXPIRES_IN`: returns both the value handed to
 * `jwt.sign` and the same duration in milliseconds.
 */
function parseExpiry(value: string): { jwtValue: string | number; ms: number } {
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
  return { jwtValue: match[2] ? trimmed : num, ms: num * UNIT_MS[unit] };
}

/**
 * Parses and validates JWT expiration time from environment variable.
 * 
 * Supports two formats:
 * 1. Human-readable: '1h', '7d', '30m', '3600s' (passed to jwt.sign as-is)
 * 2. Numeric: '86400' (converted to number for jwt.sign)
 * 
 * @param value - The JWT_EXPIRES_IN value from environment variable
 * @returns The parsed expiration value (string for human-readable, number for seconds)
 * @throws Error if the format is invalid
 * 
 * @example
 * parseJwtExpiration('1h')    // returns '1h'
 * parseJwtExpiration('86400')  // returns 86400
 * parseJwtExpiration('abc')    // throws Error
 */
export function parseJwtExpiration(value: string): string | number {
  return parseExpiry(value).jwtValue;
}
