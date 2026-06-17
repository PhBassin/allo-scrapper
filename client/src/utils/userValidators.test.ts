import { describe, it, expect } from 'vitest';
import {
  validateUsername,
  validatePassword,
  validateUserForm,
  validateChangePasswordForm,
} from './userValidators.js';

describe('validateUsername', () => {
  it('rejects empty', () => {
    expect(validateUsername('')).toBe('Username is required');
  });

  it('rejects too short', () => {
    expect(validateUsername('ab')).toBe('Username must be 3-15 characters');
  });

  it('rejects too long', () => {
    expect(validateUsername('a'.repeat(16))).toBe('Username must be 3-15 characters');
  });

  it('rejects non-alphanumeric', () => {
    expect(validateUsername('user-name')).toBe('Username must be alphanumeric');
  });

  it('accepts valid', () => {
    expect(validateUsername('alice42')).toBeNull();
  });
});

describe('validatePassword', () => {
  it('rejects empty', () => {
    expect(validatePassword('')).toBe('Password is required');
  });

  it('rejects too short', () => {
    expect(validatePassword('Aa1!')).toMatch(/at least 8/);
  });

  it('rejects missing uppercase', () => {
    expect(validatePassword('aa1!aaaa')).toMatch(/uppercase/);
  });

  it('rejects missing lowercase', () => {
    expect(validatePassword('AA1!AAAA')).toMatch(/lowercase/);
  });

  it('rejects missing digit', () => {
    expect(validatePassword('AAa!aaaa')).toMatch(/digit/);
  });

  it('rejects missing special', () => {
    expect(validatePassword('AA1aaaaa')).toMatch(/special/);
  });

  it('accepts valid', () => {
    expect(validatePassword('Aa1!aaaa')).toBeNull();
  });
});

describe('validateUserForm', () => {
  it('returns both errors when both fields invalid', () => {
    expect(validateUserForm('', '')).toEqual({
      username: 'Username is required',
      password: 'Password is required',
    });
  });

  it('returns empty object when both fields valid', () => {
    expect(validateUserForm('alice42', 'Aa1!aaaa')).toEqual({});
  });
});

describe('validateChangePasswordForm', () => {
  it('rejects when any field is empty', () => {
    expect(validateChangePasswordForm('', 'Aa1!aaaa', 'Aa1!aaaa')).toBe('All fields are required');
    expect(validateChangePasswordForm('old', '', 'Aa1!aaaa')).toBe('All fields are required');
    expect(validateChangePasswordForm('old', 'Aa1!aaaa', '')).toBe('All fields are required');
  });

  it('rejects mismatched confirmation', () => {
    expect(validateChangePasswordForm('old', 'Aa1!aaaa', 'Aa1!bbbb')).toBe('Passwords do not match');
  });

  it('delegates to password complexity check', () => {
    expect(validateChangePasswordForm('old', 'weak', 'weak')).toMatch(/at least 8/);
  });

  it('accepts valid submission', () => {
    expect(validateChangePasswordForm('oldPass1!', 'Aa1!aaaa', 'Aa1!aaaa')).toBeNull();
  });
});