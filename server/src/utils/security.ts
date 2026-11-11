export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Check a password that is being set (account creation, self-service change,
 * admin reset). Never called on login: existing hashes are not re-checked.
 *
 * Follows NIST SP 800-63B: length only, no composition rules. Length counts
 * Unicode code points, so a passphrase in any script gets the same budget;
 * the maximum also caps the scrypt input size.
 *
 * Returns a user-facing message, or null when the password is acceptable.
 */
export function validatePasswordStrength(password: string): string | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  }
  return null;
}
