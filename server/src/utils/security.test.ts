import { describe, it, expect } from 'vitest';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordStrength,
} from './security.js';

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
});
