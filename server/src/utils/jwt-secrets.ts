import jwt from 'jsonwebtoken';
import { validateJWTSecret, FORBIDDEN_SECRETS } from './jwt-secret-validator.js';
import { logger } from './logger.js';

function validateSecret(secret: string, label: string): string {
  const trimmed = secret.trim();
  if (trimmed.length < 32) {
    throw new Error(`FATAL: ${label} is too short. Minimum 32 characters required.`);
  }
  const lower = trimmed.toLowerCase();
  for (const forbidden of FORBIDDEN_SECRETS) {
    if (lower.includes(forbidden)) {
      throw new Error(`FATAL: ${label} contains forbidden default value.`);
    }
  }
  return trimmed;
}

export function getSecrets(): string[] {
  const current = validateJWTSecret();
  const previousRaw = process.env.JWT_PREVIOUS_SECRETS?.trim();
  const secrets: string[] = [current];

  if (previousRaw) {
    const parsed = previousRaw.split(',').map(s => s.trim()).filter(Boolean);
    for (const secret of parsed) {
      secrets.push(validateSecret(secret, 'JWT_PREVIOUS_SECRETS entry'));
    }
  }

  return secrets;
}

export function getCurrentSecret(): string {
  return validateJWTSecret();
}

export function verifyWithMultipleSecrets(token: string, secrets: string[]): jwt.JwtPayload {
  const errors: Error[] = [];
  for (let i = 0; i < secrets.length; i++) {
    try {
      const decoded = jwt.verify(token, secrets[i]) as jwt.JwtPayload;
      if (i > 0) {
        logger.debug(`JWT verified with previous secret (index ${i})`);
      }
      return decoded;
    } catch (err) {
      const jwtErr = err as any;
      if (jwtErr.name !== 'JsonWebTokenError' && jwtErr.name !== 'TokenExpiredError') {
        throw err;
      }
      errors.push(err as Error);
    }
  }
  throw errors[0];
}
