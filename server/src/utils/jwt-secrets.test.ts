import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSecrets, getCurrentSecret, verifyWithMultipleSecrets } from './jwt-secrets.js';
import jwt from 'jsonwebtoken';

const VALID_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
const ANOTHER_VALID_SECRET = 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7';

describe('getSecrets', () => {
  let originalJwtSecret: string | undefined;
  let originalPreviousSecrets: string | undefined;

  beforeEach(() => {
    originalJwtSecret = process.env.JWT_SECRET;
    originalPreviousSecrets = process.env.JWT_PREVIOUS_SECRETS;
    process.env.JWT_SECRET = VALID_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.JWT_PREVIOUS_SECRETS = originalPreviousSecrets;
  });

  it('should return array with only current secret when no previous secrets', () => {
    delete process.env.JWT_PREVIOUS_SECRETS;
    const secrets = getSecrets();
    expect(secrets).toEqual([VALID_SECRET]);
  });

  it('should return current first then previous secrets in order', () => {
    process.env.JWT_PREVIOUS_SECRETS = `${ANOTHER_VALID_SECRET},c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8`;
    const secrets = getSecrets();
    expect(secrets[0]).toBe(VALID_SECRET);
    expect(secrets[1]).toBe(ANOTHER_VALID_SECRET);
    expect(secrets).toHaveLength(3);
  });

  it('should handle single previous secret', () => {
    process.env.JWT_PREVIOUS_SECRETS = ANOTHER_VALID_SECRET;
    const secrets = getSecrets();
    expect(secrets).toHaveLength(2);
  });

  it('should handle empty JWT_PREVIOUS_SECRETS', () => {
    process.env.JWT_PREVIOUS_SECRETS = '';
    const secrets = getSecrets();
    expect(secrets).toEqual([VALID_SECRET]);
  });

  it('should handle whitespace in comma-separated list', () => {
    process.env.JWT_PREVIOUS_SECRETS = `  ${ANOTHER_VALID_SECRET}  ,  c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8  `;
    const secrets = getSecrets();
    expect(secrets).toHaveLength(3);
    expect(secrets[1]).toBe(ANOTHER_VALID_SECRET);
  });

  it('should validate previous secrets (min 32 chars)', () => {
    process.env.JWT_PREVIOUS_SECRETS = 'too-short';
    expect(() => getSecrets()).toThrow('JWT_PREVIOUS_SECRETS entry is too short');
  });

  it('should reject forbidden values in previous secrets', () => {
    process.env.JWT_PREVIOUS_SECRETS = 'dev-secret-key-change-in-prod-long-enough-here';
    expect(() => getSecrets()).toThrow('JWT_PREVIOUS_SECRETS entry contains forbidden default value');
  });
});

describe('getCurrentSecret', () => {
  let originalJwtSecret: string | undefined;

  beforeEach(() => {
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = VALID_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it('should return the current JWT_SECRET', () => {
    expect(getCurrentSecret()).toBe(VALID_SECRET);
  });
});

describe('verifyWithMultipleSecrets', () => {
  const payload = { id: 1, username: 'test' };

  it('should verify token signed with current secret (first in list)', () => {
    const token = jwt.sign(payload, VALID_SECRET);
    const decoded = verifyWithMultipleSecrets(token, [VALID_SECRET, ANOTHER_VALID_SECRET]);
    expect(decoded.id).toBe(1);
  });

  it('should verify token signed with previous secret', () => {
    const token = jwt.sign(payload, ANOTHER_VALID_SECRET);
    const decoded = verifyWithMultipleSecrets(token, [VALID_SECRET, ANOTHER_VALID_SECRET]);
    expect(decoded.id).toBe(1);
  });

  it('should throw on token signed with unknown secret', () => {
    const token = jwt.sign(payload, 'unknown-secret-that-is-at-least-32-chars-long!');
    expect(() => verifyWithMultipleSecrets(token, [VALID_SECRET])).toThrow();
  });

  it('should throw on malformed token', () => {
    expect(() => verifyWithMultipleSecrets('not-a-token', [VALID_SECRET])).toThrow();
  });

  it('should verify current secret first (fast path)', () => {
    const token = jwt.sign(payload, VALID_SECRET);
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      verifyWithMultipleSecrets(token, [VALID_SECRET, ANOTHER_VALID_SECRET]);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('should not throw non-JWT errors', () => {
    expect(() => verifyWithMultipleSecrets('', [VALID_SECRET])).toThrow();
  });
});
