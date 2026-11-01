import { describe, it, expect, afterEach } from 'vitest';
import { parseJwtExpiration, getJwtExpiresIn, getAccessTokenMaxAgeMs } from './jwt-config.js';

describe('parseJwtExpiration', () => {
  describe('human-readable formats', () => {
    it('should accept hours format: 24h', () => {
      expect(parseJwtExpiration('24h')).toBe('24h');
    });

    it('should accept hours format: 1h', () => {
      expect(parseJwtExpiration('1h')).toBe('1h');
    });

    it('should accept days format: 7d', () => {
      expect(parseJwtExpiration('7d')).toBe('7d');
    });

    it('should accept days format: 1d', () => {
      expect(parseJwtExpiration('1d')).toBe('1d');
    });

    it('should accept minutes format: 30m', () => {
      expect(parseJwtExpiration('30m')).toBe('30m');
    });

    it('should accept seconds format: 3600s', () => {
      expect(parseJwtExpiration('3600s')).toBe('3600s');
    });
  });

  describe('numeric formats', () => {
    it('should parse seconds as number: 86400', () => {
      expect(parseJwtExpiration('86400')).toBe(86400);
    });

    it('should parse seconds as number: 3600', () => {
      expect(parseJwtExpiration('3600')).toBe(3600);
    });

    it('should parse large numbers', () => {
      expect(parseJwtExpiration('604800')).toBe(604800);
    });
  });

  describe('invalid formats', () => {
    it('should throw on invalid format: 25x', () => {
      expect(() => parseJwtExpiration('25x')).toThrow('Invalid JWT_EXPIRES_IN format');
    });

    it('should throw on invalid format: abc', () => {
      expect(() => parseJwtExpiration('abc')).toThrow('Invalid JWT_EXPIRES_IN format');
    });

    it('should throw on empty string', () => {
      expect(() => parseJwtExpiration('')).toThrow('Invalid JWT_EXPIRES_IN format');
    });

    it('should throw on negative numbers', () => {
      expect(() => parseJwtExpiration('-100')).toThrow('Invalid JWT_EXPIRES_IN format');
    });

    it('should throw on zero', () => {
      expect(() => parseJwtExpiration('0')).toThrow('Invalid JWT_EXPIRES_IN format');
    });

    it('should throw on a zero human-readable duration: 0m', () => {
      expect(() => parseJwtExpiration('0m')).toThrow('Invalid JWT_EXPIRES_IN format');
    });

    it('should throw on decimal numbers', () => {
      expect(() => parseJwtExpiration('3.14')).toThrow('Invalid JWT_EXPIRES_IN format');
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace-trimmed input', () => {
      expect(parseJwtExpiration('  24h  ')).toBe('24h');
    });

    it('should throw on mixed format: 24hours', () => {
      expect(() => parseJwtExpiration('24hours')).toThrow('Invalid JWT_EXPIRES_IN format');
    });
  });
});

describe('access-token lifetime', () => {
  const originalEnv = process.env.JWT_EXPIRES_IN;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.JWT_EXPIRES_IN;
    } else {
      process.env.JWT_EXPIRES_IN = originalEnv;
    }
  });

  it('defaults to 15 minutes when JWT_EXPIRES_IN is unset', () => {
    delete process.env.JWT_EXPIRES_IN;
    expect(getJwtExpiresIn()).toBe('15m');
    expect(getAccessTokenMaxAgeMs()).toBe(15 * 60 * 1000);
  });

  it('follows a human-readable JWT_EXPIRES_IN', () => {
    process.env.JWT_EXPIRES_IN = '2h';
    expect(getJwtExpiresIn()).toBe('2h');
    expect(getAccessTokenMaxAgeMs()).toBe(2 * 60 * 60 * 1000);
  });

  it('treats a numeric JWT_EXPIRES_IN as seconds, like jwt.sign', () => {
    process.env.JWT_EXPIRES_IN = '600';
    expect(getAccessTokenMaxAgeMs()).toBe(600 * 1000);
  });

  it('converts every unit, trimming whitespace', () => {
    process.env.JWT_EXPIRES_IN = ' 90s ';
    expect(getAccessTokenMaxAgeMs()).toBe(90 * 1000);
    process.env.JWT_EXPIRES_IN = '1d';
    expect(getAccessTokenMaxAgeMs()).toBe(24 * 60 * 60 * 1000);
  });

  it('throws on an invalid JWT_EXPIRES_IN', () => {
    process.env.JWT_EXPIRES_IN = 'abc';
    expect(() => getAccessTokenMaxAgeMs()).toThrow('Invalid JWT_EXPIRES_IN format');
  });
});
