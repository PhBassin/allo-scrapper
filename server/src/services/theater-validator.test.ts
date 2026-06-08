import { describe, it, expect, vi } from 'vitest';
import {
  validateTheaterId,
  validateTheaterName,
  validateTheaterUrl,
  validateOptionalUrl,
  validateAddress,
  validatePostalCode,
  validateCity,
  validateScreenCount,
  validateAtLeastOneField,
} from './theater-validator.js';
import { isValidAllocineUrl } from '../utils/url.js';

vi.mock('../utils/url.js', () => ({
  isValidAllocineUrl: vi.fn(() => true),
}));

describe('theater-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isValidAllocineUrl).mockReturnValue(true);
  });

  describe('validateTheaterId', () => {
    it('should accept valid alphanumeric ID', () => {
      expect(() => validateTheaterId('C0013')).not.toThrow();
      expect(() => validateTheaterId('W7517')).not.toThrow();
    });

    it('should reject special characters', () => {
      expect(() => validateTheaterId('id!')).toThrow('Invalid ID format');
      expect(() => validateTheaterId('id space')).toThrow('Invalid ID format');
    });

    it('should reject ID longer than 20 chars', () => {
      expect(() => validateTheaterId('a'.repeat(21))).toThrow('too long');
    });

    it('should reject non-string', () => {
      expect(() => validateTheaterId(42 as any)).toThrow('Invalid ID format');
    });
  });

  describe('validateTheaterName', () => {
    it('should accept valid name', () => {
      expect(() => validateTheaterName('Grand Rex')).not.toThrow();
    });

    it('should reject empty string', () => {
      expect(() => validateTheaterName('')).toThrow('between 1 and 100');
    });

    it('should reject name longer than 100 chars', () => {
      expect(() => validateTheaterName('a'.repeat(101))).toThrow('between 1 and 100');
    });

    it('should reject non-string', () => {
      expect(() => validateTheaterName(123 as any)).toThrow('between 1 and 100');
    });
  });

  describe('validateTheaterUrl', () => {
    it('should accept valid URL', () => {
      expect(() => validateTheaterUrl('https://www.allocine.fr/test')).not.toThrow();
    });

    it('should reject URL longer than 2048 chars', () => {
      expect(() => validateTheaterUrl('a'.repeat(2049))).toThrow('too long');
    });

    it('should reject invalid Allocine URL', () => {
      vi.mocked(isValidAllocineUrl).mockReturnValue(false);
      expect(() => validateTheaterUrl('https://bad.com')).toThrow('Invalid Allocine URL');
    });

    it('should reject non-string', () => {
      expect(() => validateTheaterUrl(123 as any)).toThrow('too long');
    });
  });

  describe('validateOptionalUrl', () => {
    it('should accept undefined', () => {
      expect(() => validateOptionalUrl(undefined)).not.toThrow();
    });

    it('should validate when provided', () => {
      expect(() => validateOptionalUrl('https://www.allocine.fr/test')).not.toThrow();
    });

    it('should reject invalid when provided', () => {
      vi.mocked(isValidAllocineUrl).mockReturnValue(false);
      expect(() => validateOptionalUrl('https://bad.com')).toThrow('Invalid Allocine URL');
    });
  });

  describe('validateAddress', () => {
    it('should accept valid address', () => {
      expect(() => validateAddress('1 rue de Paris')).not.toThrow();
    });

    it('should accept undefined', () => {
      expect(() => validateAddress(undefined)).not.toThrow();
    });

    it('should reject address longer than 200 chars', () => {
      expect(() => validateAddress('a'.repeat(201))).toThrow('at most 200');
    });
  });

  describe('validatePostalCode', () => {
    it('should accept valid postal code', () => {
      expect(() => validatePostalCode('75001')).not.toThrow();
      expect(() => validatePostalCode('SW1A1AA')).not.toThrow();
    });

    it('should accept undefined', () => {
      expect(() => validatePostalCode(undefined)).not.toThrow();
    });

    it('should reject postal code longer than 10 chars', () => {
      expect(() => validatePostalCode('a'.repeat(11))).toThrow('at most 10');
    });

    it('should reject postal code with special chars', () => {
      expect(() => validatePostalCode('75001!')).toThrow('alphanumeric');
    });

    it('should accept empty string (reset)', () => {
      expect(() => validatePostalCode('')).not.toThrow();
    });
  });

  describe('validateCity', () => {
    it('should accept valid city', () => {
      expect(() => validateCity('Paris')).not.toThrow();
    });

    it('should accept undefined', () => {
      expect(() => validateCity(undefined)).not.toThrow();
    });

    it('should reject city longer than 100 chars', () => {
      expect(() => validateCity('a'.repeat(101))).toThrow('at most 100');
    });
  });

  describe('validateScreenCount', () => {
    it('should accept valid screen count', () => {
      expect(() => validateScreenCount(5)).not.toThrow();
      expect(() => validateScreenCount(1)).not.toThrow();
      expect(() => validateScreenCount(50)).not.toThrow();
    });

    it('should accept undefined and null', () => {
      expect(() => validateScreenCount(undefined)).not.toThrow();
      expect(() => validateScreenCount(null)).not.toThrow();
    });

    it('should reject non-integer', () => {
      expect(() => validateScreenCount(3.5)).toThrow('must be an integer');
    });

    it('should reject non-number', () => {
      expect(() => validateScreenCount('5' as any)).toThrow('must be a number');
    });

    it('should reject out of range', () => {
      expect(() => validateScreenCount(0)).toThrow('between 1 and 50');
      expect(() => validateScreenCount(51)).toThrow('between 1 and 50');
      expect(() => validateScreenCount(-1)).toThrow('between 1 and 50');
    });
  });

  describe('validateAtLeastOneField', () => {
    it('should pass when at least one field is present', () => {
      expect(() =>
        validateAtLeastOneField({ name: 'x' }, ['name', 'url', 'screen_count']),
      ).not.toThrow();
    });

    it('should pass when a non-string field is zero', () => {
      expect(() =>
        validateAtLeastOneField({ screen_count: 0 }, ['name', 'url', 'screen_count']),
      ).not.toThrow();
    });

    it('should reject when all fields are missing or empty', () => {
      expect(() =>
        validateAtLeastOneField({}, ['name', 'url', 'screen_count']),
      ).toThrow('At least one field must be provided');
      expect(() =>
        validateAtLeastOneField({ name: '', url: undefined }, ['name', 'url']),
      ).toThrow('At least one field must be provided');
    });
  });
});
