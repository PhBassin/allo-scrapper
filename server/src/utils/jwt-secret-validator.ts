import { logger } from './logger.js';

/**
 * List of forbidden JWT secret values that must never be used in production.
 * These are common defaults or weak values that pose a critical security risk.
 */
export const FORBIDDEN_SECRETS = [
  'dev-secret-key-change-in-prod',
  'your-super-secret-key-change-this-in-production',
  'change-me',
  'secret',
  'test-secret',
  'jwt-secret',
];

/**
 * Validates JWT_SECRET environment variable on application startup.
 * 
 * **Security Requirements:**
 * - JWT_SECRET must be set (not undefined/empty)
 * - Minimum length: 32 characters (256 bits recommended)
 * - Must NOT match any forbidden default values
 * 
 * **Throws Error if:**
 * - JWT_SECRET is missing or empty
 * - JWT_SECRET is shorter than 32 characters
 * - JWT_SECRET matches a known insecure default
 * 
 * @returns The validated JWT secret (trimmed)
 * @throws Error with actionable remediation guidance
 * 
 * @example
 * // Called during server startup (server/src/index.ts)
 * const jwtSecret = validateJWTSecret();
 */
export function validateJWTSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  // Check if JWT_SECRET is missing or empty
  if (!secret) {
    logger.error('❌ JWT_SECRET environment variable is not set');
    throw new Error(
      'FATAL: JWT_SECRET environment variable is not set. ' +
      'Generate a secure secret with: openssl rand -base64 64'
    );
  }

  // Enforce minimum length (32 characters = 256 bits)
  if (secret.length < 32) {
    logger.error(`❌ JWT_SECRET is too short: ${secret.length} characters`);
    throw new Error(
      `FATAL: JWT_SECRET is too short (${secret.length} chars). Minimum 32 characters required.`
    );
  }

  // Check against forbidden default values (case-insensitive)
  const secretLower = secret.toLowerCase();
  for (const forbidden of FORBIDDEN_SECRETS) {
    if (secretLower.includes(forbidden)) {
      logger.error(`❌ JWT_SECRET contains forbidden value: ${forbidden}`);
      throw new Error(
        'FATAL: JWT_SECRET is set to a default/forbidden value. ' +
        'Generate a secure secret with: openssl rand -base64 64'
      );
    }
  }

  logger.info('✅ JWT_SECRET validated successfully');
  return secret;
}
