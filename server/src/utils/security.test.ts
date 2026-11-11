import { describe, it, expect } from 'vitest';
import {
  isCommonPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordStrength,
} from './security.js';

const COMMON_PASSWORD_MESSAGE = 'This password is too common, choose another one';

describe('validatePasswordStrength', () => {
  describe('length', () => {
    it('allows 12 to 128 characters', () => {
      expect(PASSWORD_MIN_LENGTH).toBe(12);
      expect(PASSWORD_MAX_LENGTH).toBe(128);
    });

    it('rejects an empty password', () => {
      expect(validatePasswordStrength('')).toBe('Password must be at least 12 characters');
    });

    it('rejects 11 characters', () => {
      expect(validatePasswordStrength('kq7vmz2xwtr')).toBe('Password must be at least 12 characters');
    });

    it('accepts exactly 12 characters', () => {
      expect(validatePasswordStrength('kq7vmz2xwtrb')).toBeNull();
    });

    it('accepts exactly 128 characters', () => {
      expect(validatePasswordStrength('kq7vmz2x'.repeat(16))).toBeNull();
    });

    it('rejects 129 characters', () => {
      expect(validatePasswordStrength('kq7vmz2x'.repeat(16) + 'a')).toBe(
        'Password must be at most 128 characters',
      );
    });

    it('counts Unicode code points, not UTF-16 units', () => {
      // 12 emoji are 24 UTF-16 units but 12 characters.
      expect(validatePasswordStrength('🎬'.repeat(12))).toBeNull();
      expect(validatePasswordStrength('🎬'.repeat(11))).toBe('Password must be at least 12 characters');
      // 128 emoji are 256 UTF-16 units: still within the 128-character cap.
      expect(validatePasswordStrength('🎬'.repeat(128))).toBeNull();
      expect(validatePasswordStrength('🎬'.repeat(129))).toBe('Password must be at most 128 characters');
    });

    it('accepts non-ASCII letters', () => {
      expect(validatePasswordStrength('séance du cinéma')).toBeNull();
    });
  });

  describe('composition', () => {
    it('accepts a passphrase without uppercase, digit or special character', () => {
      expect(validatePasswordStrength('correct horse battery')).toBeNull();
    });

    it('accepts an all-lowercase password', () => {
      expect(validatePasswordStrength('lowercaseonlyletters')).toBeNull();
    });

    it('accepts an all-digit password', () => {
      expect(validatePasswordStrength('804271395561')).toBeNull();
    });
  });

  describe('common-password blocklist', () => {
    it('rejects Password123!', () => {
      expect(validatePasswordStrength('Password123!')).toBe(COMMON_PASSWORD_MESSAGE);
    });

    it('rejects listed passwords whatever their case', () => {
      expect(validatePasswordStrength('qwerty123456')).toBe(COMMON_PASSWORD_MESSAGE);
      expect(validatePasswordStrength('QWERTY123456')).toBe(COMMON_PASSWORD_MESSAGE);
      expect(validatePasswordStrength('QwErTy123456')).toBe(COMMON_PASSWORD_MESSAGE);
    });

    it('rejects a listed password padded with spaces', () => {
      expect(validatePasswordStrength('  administrator  ')).toBe(COMMON_PASSWORD_MESSAGE);
    });

    it('rejects entries from each source', () => {
      // 10k-most-common, NCSC top-100k, and the hand-written supplement.
      expect(isCommonPassword('unbelievable')).toBe(true);
      expect(isCommonPassword('password1234')).toBe(true);
      expect(isCommonPassword('motdepasse123')).toBe(true);
    });

    it('does not reject an uncommon password', () => {
      expect(isCommonPassword('correct horse battery')).toBe(false);
      expect(validatePasswordStrength('correct horse battery')).toBeNull();
    });

    it('does not treat header comments as passwords', () => {
      expect(isCommonPassword('# --- supplement ---')).toBe(false);
      expect(isCommonPassword('')).toBe(false);
    });

    it('checks length before the blocklist', () => {
      expect(validatePasswordStrength('password')).toBe('Password must be at least 12 characters');
    });
  });
});
