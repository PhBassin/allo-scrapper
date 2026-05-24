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
