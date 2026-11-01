import { logger } from './logger.js';

function parseExpiryToMs(value: string): number {
  const trimmed = value.trim();
  const humanReadablePattern = /^(\d+)([hdms])$/;
  const match = trimmed.match(humanReadablePattern);
  if (match) {
    const num = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return num * 1000;
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      case 'd': return num * 24 * 60 * 60 * 1000;
    }
  }
  const numericPattern = /^(\d+)$/;
  if (numericPattern.test(trimmed)) {
    return parseInt(trimmed, 10) * 1000;
  }
  return -1;
}

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
  const expiresIn = getJwtExpiresIn();
  parseJwtExpiration(expiresIn);
  return parseExpiryToMs(expiresIn);
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
  // Trim whitespace
  const trimmed = value.trim();

  // Check for empty string
  if (!trimmed) {
    logger.error('JWT_EXPIRES_IN cannot be empty');
    throw new Error('Invalid JWT_EXPIRES_IN format: value cannot be empty');
  }

  // Check for human-readable format: ends with h, d, m, or s
  const humanReadablePattern = /^(\d+)([hdms])$/;
  const match = trimmed.match(humanReadablePattern);

  if (match) {
    // Valid human-readable format
    return trimmed;
  }

  // Check for numeric format (pure digits)
  const numericPattern = /^(\d+)$/;
  if (numericPattern.test(trimmed)) {
    const numValue = parseInt(trimmed, 10);

    // Validate positive non-zero integer
    if (numValue <= 0) {
      logger.error(`JWT_EXPIRES_IN must be positive: ${trimmed}`);
      throw new Error('Invalid JWT_EXPIRES_IN format: value must be positive');
    }

    // Return as number for jwt.sign
    return numValue;
  }

  // Invalid format
  logger.error(`Invalid JWT_EXPIRES_IN format: ${trimmed}`);
  throw new Error(
    `Invalid JWT_EXPIRES_IN format: "${trimmed}". ` +
    `Expected human-readable (e.g., '24h', '7d') or seconds as number (e.g., '86400')`
  );
}
