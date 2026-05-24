import crypto from 'crypto';
import util from 'util';
import { logger } from './logger.js';

const scrypt = util.promisify(crypto.scrypt);
const randomBytes = util.promisify(crypto.randomBytes);

export async function hashPassword(password: string): Promise<string> {
  const salt = await randomBytes(16);
  // Derived key length of 64 bytes
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString('hex')}:${derivedKey.toString('hex')}`;
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
    if (parts.length !== 3) return false;

    const salt = parts[1];
    const key = parts[2];

    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = (await scrypt(password, Buffer.from(salt, 'hex'), 64)) as Buffer;

    // Use timingSafeEqual to prevent timing attacks
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (err) {
    logger.error('Error comparing passwords', err);
    return false;
  }
}
