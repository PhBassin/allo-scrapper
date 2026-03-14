import { logger } from './logger.js';

/**
 * Parses and validates JWT expiration time from environment variable.
 * 
 * Supports two formats:
 * 1. Human-readable: '24h', '7d', '30m', '3600s' (passed to jwt.sign as-is)
 * 2. Numeric: '86400' (converted to number for jwt.sign)
 * 
 * @param value - The JWT_EXPIRES_IN value from environment variable
 * @returns The parsed expiration value (string for human-readable, number for seconds)
 * @throws Error if the format is invalid
 * 
 * @example
 * parseJwtExpiration('24h')    // returns '24h'
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
