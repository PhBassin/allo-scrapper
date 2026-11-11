import crypto from 'crypto';
import util from 'util';
import { logger } from './logger.js';

const randomBytes = util.promisify(crypto.randomBytes);

const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keyLen: 64,
  saltLen: 16
};

/**
 * Longest password `comparePassword` will run through scrypt. The password
 * policy (`validatePasswordStrength`) caps what can be *set* at 128
 * characters, but login and the current-password check in changePassword
 * verify whatever the request carries, without applying the policy. This
 * bound stops those unauthenticated inputs (up to the body-parser limit)
 * from reaching scrypt.
 *
 * It sits far above the policy maximum because passwords set before the
 * policy had no maximum: any of those up to this length keeps working.
 * Trade-off: an account whose password is longer than this (only possible
 * under the old rules) can no longer log in and needs an admin reset.
 * Measured in UTF-16 code units (cheap, and at least the code point count).
 */
export const MAX_VERIFIABLE_PASSWORD_LENGTH = 4096;

export async function hashPassword(password: string): Promise<string> {
  const salt = await randomBytes(SCRYPT_PARAMS.saltLen);
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_PARAMS.keyLen, SCRYPT_PARAMS, (err, key) => {
      if (err) reject(err);
      else resolve(key as Buffer);
    });
  });
  return `scrypt:${SCRYPT_PARAMS.N}:${SCRYPT_PARAMS.r}:${SCRYPT_PARAMS.p}:${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (password.length > MAX_VERIFIABLE_PASSWORD_LENGTH) {
    // Same `false` as a wrong password: callers answer with their generic 401.
    logger.warn('Refused to verify a password above the verifiable length bound');
    return false;
  }
  try {
    // If it's a bcrypt hash (e.g. from existing DB), it fails to compare since we removed bcrypt.
    // In a real migration, we would keep bcrypt to verify old hashes, but per requirements we remove it entirely.
    if (!hash.startsWith('scrypt:')) {
      logger.warn('Attempted to verify non-scrypt hash (likely legacy bcrypt). Denied.');
      return false;
    }

    const parts = hash.split(':');
    
    // Support new format: scrypt:N:r:p:salt:key
    // Support old format (during this branch's migration): scrypt:salt:key
    let N, r, p, saltHex, keyHex;
    
    if (parts.length === 6) {
      N = parseInt(parts[1], 10);
      r = parseInt(parts[2], 10);
      p = parseInt(parts[3], 10);
      saltHex = parts[4];
      keyHex = parts[5];
    } else if (parts.length === 3) {
      // Fallback for hashes generated earlier in this branch
      N = SCRYPT_PARAMS.N;
      r = SCRYPT_PARAMS.r;
      p = SCRYPT_PARAMS.p;
      saltHex = parts[1];
      keyHex = parts[2];
    } else {
      return false;
    }

    const keyBuffer = Buffer.from(keyHex, 'hex');
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, Buffer.from(saltHex, 'hex'), keyBuffer.length, { N, r, p }, (err, key) => {
        if (err) reject(err);
        else resolve(key as Buffer);
      });
    });

    if (keyBuffer.length !== derivedKey.length) {
      return false;
    }

    // Use timingSafeEqual to prevent timing attacks
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (err) {
    logger.error('Error comparing passwords', err);
    return false;
  }
}
