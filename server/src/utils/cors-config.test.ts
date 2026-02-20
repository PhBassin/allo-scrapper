import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCorsOptions } from './cors-config';

describe('getCorsOptions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should allow requests from allowed origins defined in environment variable', () => {
    process.env.ALLOWED_ORIGINS = 'http://example.com,http://test.com';
    const options = getCorsOptions();

    const originCheck = options.origin;
    const callback = vi.fn();

    if (typeof originCheck === 'function') {
      // @ts-ignore - CORS types might mismatch slightly with test mocks
      originCheck('http://example.com', callback);
      expect(callback).toHaveBeenCalledWith(null, true);

      // @ts-ignore
      originCheck('http://test.com', callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    } else {
        throw new Error('origin should be a function');
    }
  });

  it('should block requests from disallowed origins', () => {
    process.env.ALLOWED_ORIGINS = 'http://example.com';
    const options = getCorsOptions();

    const originCheck = options.origin;
    const callback = vi.fn();

    if (typeof originCheck === 'function') {
      // @ts-ignore
      originCheck('http://hacker.com', callback);
      // Expect an error as the first argument
      expect(callback).toHaveBeenCalledWith(expect.any(Error));
    }
  });

  it('should allow requests with no origin (like mobile apps or curl)', () => {
    process.env.ALLOWED_ORIGINS = 'http://example.com';
    const options = getCorsOptions();

    const originCheck = options.origin;
    const callback = vi.fn();

    if (typeof originCheck === 'function') {
      // @ts-ignore
      originCheck(undefined, callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    }
  });

  it('should default to localhost:5173 if ALLOWED_ORIGINS is not set', () => {
    delete process.env.ALLOWED_ORIGINS;
    const options = getCorsOptions();

    const originCheck = options.origin;
    const callback = vi.fn();

    if (typeof originCheck === 'function') {
      // @ts-ignore
      originCheck('http://localhost:5173', callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    }
  });
});
