import { describe, it, expect, afterEach, vi } from 'vitest';
import { getJwtExpiresIn, getAccessTokenMaxAgeMs, getJwtSignExpiresIn, warnIfLongJwtExpiresIn } from './jwt-config.js';
import { logger } from './logger.js';

describe('JWT_EXPIRES_IN grammar (jwt.sign value)', () => {
  const originalEnv = process.env.JWT_EXPIRES_IN;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.JWT_EXPIRES_IN;
    } else {
      process.env.JWT_EXPIRES_IN = originalEnv;
    }
  });

  /** The value handed to `jwt.sign` for a given `JWT_EXPIRES_IN`. */
  const parseJwtExpiration = (value: string) => {
    process.env.JWT_EXPIRES_IN = value;
    return getJwtSignExpiresIn();
  };

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
      expect(() => parseJwtExpiration('   ')).toThrow('Invalid JWT_EXPIRES_IN format');
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

  it('accepts up to 365 days', () => {
    process.env.JWT_EXPIRES_IN = '365d';
    expect(getAccessTokenMaxAgeMs()).toBe(365 * 24 * 60 * 60 * 1000);
  });

  it('rejects a lifetime beyond 365 days, so a typo fails at startup rather than on every login', () => {
    for (const value of ['366d', '8761h', '100000000d', '99999999999999999999']) {
      process.env.JWT_EXPIRES_IN = value;
      expect(() => getAccessTokenMaxAgeMs()).toThrow('must not exceed 365 days');
    }
  });

  it('hands jwt.sign the same lifetime, following JWT_EXPIRES_IN changes', () => {
    process.env.JWT_EXPIRES_IN = '2h';
    expect(getJwtSignExpiresIn()).toBe('2h');
    process.env.JWT_EXPIRES_IN = '600';
    expect(getJwtSignExpiresIn()).toBe(600);
    expect(getAccessTokenMaxAgeMs()).toBe(600 * 1000);
  });
});

describe('warnIfLongJwtExpiresIn', () => {
  const originalEnv = process.env.JWT_EXPIRES_IN;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnv === undefined) {
      delete process.env.JWT_EXPIRES_IN;
    } else {
      process.env.JWT_EXPIRES_IN = originalEnv;
    }
  });

  it('stays quiet up to one hour', () => {
    const warn = vi.spyOn(logger, 'warn');
    for (const value of ['15m', '1h', '3600']) {
      process.env.JWT_EXPIRES_IN = value;
      warnIfLongJwtExpiresIn();
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns beyond one hour, naming the configured value', () => {
    const warn = vi.spyOn(logger, 'warn');
    process.env.JWT_EXPIRES_IN = '24h';
    warnIfLongJwtExpiresIn();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('JWT_EXPIRES_IN (24h)');
  });
});
