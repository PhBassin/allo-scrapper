import jwt from 'jsonwebtoken';
import { validateJWTSecret, FORBIDDEN_SECRETS } from './jwt-secret-validator.js';
import { logger } from './logger.js';

let cachedSecrets: string[] | null = null;

function validateSingle(secret: string, label: string): string {
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
  if (cachedSecrets) return cachedSecrets;

  const current = validateJWTSecret();
  const previousRaw = process.env.JWT_PREVIOUS_SECRETS?.trim();
  const secrets: string[] = [current];

  if (previousRaw) {
    const parsed = previousRaw.split(',').map(s => s.trim()).filter(Boolean);
    for (const entry of parsed) {
      const validated = validateSingle(entry, 'JWT_PREVIOUS_SECRETS entry');
      if (validated !== current) {
        secrets.push(validated);
      }
    }
  }

  cachedSecrets = secrets;
  return secrets;
}

export function invalidateSecretsCache(): void {
  cachedSecrets = null;
}

export function getCurrentSecret(): string {
  return validateJWTSecret();
}

export function verifyWithMultipleSecrets(token: string, secrets: string[]): jwt.JwtPayload {
  if (secrets.length === 0) {
    throw new jwt.JsonWebTokenError('No secrets configured for verification');
  }

  const errors: Error[] = [];
  let expiredToken = false;

  for (let i = 0; i < secrets.length; i++) {
    try {
      const decoded = jwt.verify(token, secrets[i], { algorithms: ['HS256'] }) as jwt.JwtPayload;
      if (i > 0) {
        logger.debug(`JWT verified with previous secret (index ${i + 1})`);
      }
      return decoded;
    } catch (err) {
      const jwtErr = err as any;
      if (jwtErr.name === 'TokenExpiredError') {
        expiredToken = true;
      }
      if (jwtErr.name !== 'JsonWebTokenError' && jwtErr.name !== 'TokenExpiredError' && jwtErr.name !== 'NotBeforeError') {
        throw err;
      }
      errors.push(err as Error);
    }
  }

  if (expiredToken) {
    throw new jwt.TokenExpiredError('jwt expired', new Date(0));
  }
  throw errors[0]!;
}
