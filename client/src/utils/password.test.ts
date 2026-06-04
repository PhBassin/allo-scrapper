import { describe, it, expect } from 'vitest';
import { generateRandomPassword } from './password';

describe('generateRandomPassword', () => {
  it('should generate a 16-character password', () => {
    const password = generateRandomPassword();
    expect(password).toHaveLength(16);
  });

  it('should generate unique passwords on each call', () => {
    const password1 = generateRandomPassword();
    const password2 = generateRandomPassword();
    const password3 = generateRandomPassword();

    expect(password1).not.toBe(password2);
    expect(password1).not.toBe(password3);
    expect(password2).not.toBe(password3);
  });

  it('should contain at least one uppercase letter', () => {
    const password = generateRandomPassword();
    expect(password).toMatch(/[A-Z]/);
  });

  it('should contain at least one lowercase letter', () => {
    const password = generateRandomPassword();
    expect(password).toMatch(/[a-z]/);
  });

  it('should contain at least one digit', () => {
    const password = generateRandomPassword();
    expect(password).toMatch(/[0-9]/);
  });

  it('should contain at least one special character', () => {
    const password = generateRandomPassword();
    expect(password).toMatch(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/);
  });

  it('should only contain valid characters', () => {
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const password = generateRandomPassword();
    for (const char of password) {
      expect(validChars).toContain(char);
    }
  });
});
