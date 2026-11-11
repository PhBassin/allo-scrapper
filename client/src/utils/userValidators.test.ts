import { describe, it, expect } from 'vitest';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
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
  it('mirrors the server length bounds', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
  });

  it('rejects empty', () => {
    expect(validatePassword('')).toBe('Password is required');
  });

  it('rejects 11 characters', () => {
    expect(validatePassword('kq7vmz2xwtr')).toBe('Password must be at least 12 characters');
  });

  it('accepts exactly 12 characters', () => {
    expect(validatePassword('kq7vmz2xwtrb')).toBeNull();
  });

  it('accepts exactly 128 characters', () => {
    expect(validatePassword('kq7vmz2x'.repeat(16))).toBeNull();
  });

  it('rejects 129 characters', () => {
    expect(validatePassword('kq7vmz2x'.repeat(16) + 'a')).toBe('Password must be at most 128 characters');
  });

  it('does not count surrounding spaces toward the minimum, like the server', () => {
    expect(validatePassword(' '.repeat(12))).toBe('Password must be at least 12 characters');
    expect(validatePassword(`  ${'a'.repeat(11)}  `)).toBe('Password must be at least 12 characters');
    expect(validatePassword('a          b')).toBeNull();
  });

  it('counts Unicode code points like the server', () => {
    expect(validatePassword('🎬'.repeat(12))).toBeNull();
    expect(validatePassword('🎬'.repeat(11))).toBe('Password must be at least 12 characters');
    expect(validatePassword('🎬'.repeat(128))).toBeNull();
    expect(validatePassword('🎬'.repeat(129))).toBe('Password must be at most 128 characters');
  });

  it('has no composition rules: a passphrase is accepted', () => {
    expect(validatePassword('correct horse battery')).toBeNull();
    expect(validatePassword('lowercaseonlyletters')).toBeNull();
  });

  it('leaves the common-password check to the server', () => {
    expect(validatePassword('Password123!')).toBeNull();
  });

  it('rejects a password equal to the username, ignoring case and surrounding spaces', () => {
    expect(validatePassword('CinemaLover42', 'cinemalover42')).toBe('Password must not be the same as the username');
    expect(validatePassword(' cinemalover42 ', 'CINEMALOVER42')).toBe('Password must not be the same as the username');
  });

  it('skips the username check when no username is given', () => {
    expect(validatePassword('cinemalover42', '')).toBeNull();
    expect(validatePassword('cinemalover42')).toBeNull();
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
    expect(validateUserForm('alice42', 'correct horse battery')).toEqual({});
  });

  it('rejects a password equal to the username', () => {
    expect(validateUserForm('cinemalover42', 'cinemalover42')).toEqual({
      password: 'Password must not be the same as the username',
    });
  });
});

describe('validateChangePasswordForm', () => {
  const NEW = 'correct horse battery';

  it('rejects when any field is empty', () => {
    expect(validateChangePasswordForm('', NEW, NEW)).toBe('All fields are required');
    expect(validateChangePasswordForm('old', '', NEW)).toBe('All fields are required');
    expect(validateChangePasswordForm('old', NEW, '')).toBe('All fields are required');
  });

  it('rejects mismatched confirmation', () => {
    expect(validateChangePasswordForm('old', NEW, 'correct horse staple')).toBe('Passwords do not match');
  });

  it('delegates to the password length check', () => {
    expect(validateChangePasswordForm('old', 'weak', 'weak')).toBe('Password must be at least 12 characters');
  });

  it('accepts valid submission', () => {
    expect(validateChangePasswordForm('oldPass1!', NEW, NEW)).toBeNull();
  });
});
