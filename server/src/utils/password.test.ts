import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { comparePassword, hashPassword, MAX_VERIFIABLE_PASSWORD_LENGTH } from './password.js';

vi.mock('./logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe('comparePassword', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts the right password and refuses a wrong one', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await comparePassword('correct horse battery', hash)).toBe(true);
    expect(await comparePassword('correct horse staple', hash)).toBe(false);
  });

  it('still verifies a password longer than the policy maximum, up to the bound', async () => {
    // Set before the 128-character policy maximum existed: still verifiable.
    const longPassword = 'p'.repeat(MAX_VERIFIABLE_PASSWORD_LENGTH);
    const hash = await hashPassword(longPassword);
    expect(await comparePassword(longPassword, hash)).toBe(true);
  });

  it('refuses a password above the bound without running scrypt', async () => {
    const hash = await hashPassword('correct horse battery');
    const scrypt = vi.spyOn(crypto, 'scrypt');

    expect(await comparePassword('p'.repeat(MAX_VERIFIABLE_PASSWORD_LENGTH + 1), hash)).toBe(false);
    expect(scrypt).not.toHaveBeenCalled();
  });

  it('keeps the bound far above the 128-character policy maximum', () => {
    expect(MAX_VERIFIABLE_PASSWORD_LENGTH).toBeGreaterThanOrEqual(4096);
  });
});
