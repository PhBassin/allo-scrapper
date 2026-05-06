import { describe, it, expect } from 'vitest';
import { validateUsername, USERNAME_REGEX, validatePasswordStrength } from './security.js';

describe('validateUsername', () => {
  it('accepts valid alphanumeric usernames (3-15 chars)', () => {
    expect(validateUsername('abc')).toBeNull();
    expect(validateUsername('testuser')).toBeNull();
    expect(validateUsername('Test123')).toBeNull();
    expect(validateUsername('ABC')).toBeNull();
    expect(validateUsername('12345')).toBeNull();
    expect(validateUsername('a'.repeat(15))).toBeNull();
  });

  it('rejects usernames shorter than 3 characters', () => {
    const error = validateUsername('ab');
    expect(error).toBe('Username must be alphanumeric and 3-15 characters long');
  });

  it('rejects usernames longer than 15 characters', () => {
    const error = validateUsername('a'.repeat(16));
    expect(error).toBe('Username must be alphanumeric and 3-15 characters long');
  });

  it('rejects usernames with special characters', () => {
    expect(validateUsername('user@name')).not.toBeNull();
    expect(validateUsername('user name')).not.toBeNull();
    expect(validateUsername('user-name')).not.toBeNull();
    expect(validateUsername('user_name')).not.toBeNull();
    expect(validateUsername('user.name')).not.toBeNull();
  });

  it('rejects empty username', () => {
    const error = validateUsername('');
    expect(error).toBe('Username is required');
  });
});

describe('USERNAME_REGEX', () => {
  it('matches valid usernames', () => {
    expect(USERNAME_REGEX.test('abc')).toBe(true);
    expect(USERNAME_REGEX.test('TestUser')).toBe(true);
    expect(USERNAME_REGEX.test('user123')).toBe(true);
    expect(USERNAME_REGEX.test('ABC123')).toBe(true);
  });

  it('rejects invalid usernames', () => {
    expect(USERNAME_REGEX.test('ab')).toBe(false);
    expect(USERNAME_REGEX.test('user@name')).toBe(false);
    expect(USERNAME_REGEX.test('user name')).toBe(false);
    expect(USERNAME_REGEX.test('user-name')).toBe(false);
    expect(USERNAME_REGEX.test('verylongusername12345')).toBe(false);
  });
});

describe('validatePasswordStrength', () => {
  it('accepts strong passwords', () => {
    expect(validatePasswordStrength('ValidP@ss1')).toBeNull();
  });

  it('rejects short passwords', () => {
    expect(validatePasswordStrength('Ab1!')).toContain('at least');
  });

  it('rejects passwords without uppercase', () => {
    expect(validatePasswordStrength('nouppercase1!')).toBe(
      'Password must contain at least one uppercase letter'
    );
  });
});
