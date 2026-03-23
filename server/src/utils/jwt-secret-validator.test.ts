import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateJWTSecret, FORBIDDEN_SECRETS } from './jwt-secret-validator.js';

describe('validateJWTSecret', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.JWT_SECRET;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.JWT_SECRET = originalEnv;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  describe('missing JWT_SECRET', () => {
    it('should throw error when JWT_SECRET is undefined', () => {
      delete process.env.JWT_SECRET;
      expect(() => validateJWTSecret()).toThrow('JWT_SECRET environment variable is not set');
      expect(() => validateJWTSecret()).toThrow('openssl rand -base64 64');
    });

    it('should throw error when JWT_SECRET is empty string', () => {
      process.env.JWT_SECRET = '';
      expect(() => validateJWTSecret()).toThrow('JWT_SECRET environment variable is not set');
    });

    it('should throw error when JWT_SECRET is only whitespace', () => {
      process.env.JWT_SECRET = '   ';
      expect(() => validateJWTSecret()).toThrow('JWT_SECRET environment variable is not set');
    });
  });

  describe('minimum length enforcement', () => {
    it('should throw error when JWT_SECRET is less than 32 characters', () => {
      process.env.JWT_SECRET = 'short';
      expect(() => validateJWTSecret()).toThrow('JWT_SECRET is too short (5 chars). Minimum 32 characters required');
    });

    it('should throw error for 31 character secret', () => {
      process.env.JWT_SECRET = 'a'.repeat(31);
      expect(() => validateJWTSecret()).toThrow('JWT_SECRET is too short (31 chars)');
    });

    it('should accept 32 character secret (minimum)', () => {
      process.env.JWT_SECRET = 'a'.repeat(32);
      expect(() => validateJWTSecret()).not.toThrow();
    });

    it('should accept 64 character secret (recommended)', () => {
      process.env.JWT_SECRET = 'a'.repeat(64);
      expect(() => validateJWTSecret()).not.toThrow();
    });
  });

  describe('forbidden default values', () => {
    it('should reject dev-secret-key-change-in-prod (current .env.example default)', () => {
      process.env.JWT_SECRET = 'dev-secret-key-change-in-prod';
      expect(() => validateJWTSecret()).toThrow('JWT_SECRET is set to a default/forbidden value');
      expect(() => validateJWTSecret()).toThrow('openssl rand -base64 64');
    });

    it('should reject your-super-secret-key-change-this-in-production', () => {
      process.env.JWT_SECRET = 'your-super-secret-key-change-this-in-production';
      expect(() => validateJWTSecret()).toThrow('JWT_SECRET is set to a default/forbidden value');
    });

    it('should reject change-me', () => {
      process.env.JWT_SECRET = 'change-me-this-is-long-enough-but-forbidden';
      expect(() => validateJWTSecret()).toThrow('JWT_SECRET is set to a default/forbidden value');
    });

    it('should reject secret', () => {
      process.env.JWT_SECRET = 'secret-but-make-it-long-enough-minimum';
      expect(() => validateJWTSecret()).toThrow('JWT_SECRET is set to a default/forbidden value');
    });

    it('should reject test-secret', () => {
      process.env.JWT_SECRET = 'test-secret-long-enough-to-pass-length';
      expect(() => validateJWTSecret()).toThrow('JWT_SECRET is set to a default/forbidden value');
    });

    it('should reject jwt-secret', () => {
      process.env.JWT_SECRET = 'jwt-secret-long-enough-for-validation';
      expect(() => validateJWTSecret()).toThrow('JWT_SECRET is set to a default/forbidden value');
    });
  });

  describe('case sensitivity in forbidden checks', () => {
    it('should reject case variations of forbidden values (uppercase)', () => {
      process.env.JWT_SECRET = 'DEV-SECRET-KEY-CHANGE-IN-PROD';
      expect(() => validateJWTSecret()).toThrow('JWT_SECRET is set to a default/forbidden value');
    });

    it('should reject case variations of forbidden values (mixed case)', () => {
      process.env.JWT_SECRET = 'Dev-Secret-Key-Change-In-Prod';
      expect(() => validateJWTSecret()).toThrow('JWT_SECRET is set to a default/forbidden value');
    });
  });

  describe('valid secrets', () => {
    it('should accept cryptographically secure base64 secret', () => {
      process.env.JWT_SECRET = 'K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=';
      const result = validateJWTSecret();
      expect(result).toBe('K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=');
    });

    it('should accept long random alphanumeric secret', () => {
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
      const result = validateJWTSecret();
      expect(result).toBe('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6');
    });

    it('should accept hex-encoded secret', () => {
      process.env.JWT_SECRET = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
      expect(() => validateJWTSecret()).not.toThrow();
    });

    it('should trim whitespace from valid secret', () => {
      process.env.JWT_SECRET = '  K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=  ';
      const result = validateJWTSecret();
      expect(result).toBe('K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=');
    });
  });

  describe('return value', () => {
    it('should return the validated secret (trimmed)', () => {
      const secret = 'valid-secret-that-is-long-enough-and-secure';
      process.env.JWT_SECRET = secret;
      expect(validateJWTSecret()).toBe(secret);
    });
  });

  describe('error messages contain helpful guidance', () => {
    it('should include generation command in error message', () => {
      delete process.env.JWT_SECRET;
      expect(() => validateJWTSecret()).toThrow('openssl rand -base64 64');
    });

    it('should mark errors as FATAL for visibility', () => {
      delete process.env.JWT_SECRET;
      expect(() => validateJWTSecret()).toThrow('FATAL:');
    });
  });
});
