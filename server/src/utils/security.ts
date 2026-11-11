import { readFileSync } from 'node:fs';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * The common-password blocklist, read once when this module loads. The file
 * sits next to this module: `src/utils/` under tsx and vitest, `dist/utils/`
 * in a build (the server `build` script copies it there). Loading eagerly
 * makes a build that lost the file fail at startup instead of silently
 * accepting every password.
 */
const COMMON_PASSWORDS_FILE = new URL('./common-passwords.txt', import.meta.url);

function loadCommonPasswords(file: URL): ReadonlySet<string> {
  const entries = new Set<string>();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const entry = normalizeForComparison(line);
    if (entry && !entry.startsWith('#')) {
      entries.add(entry);
    }
  }
  return entries;
}

/** Trim and lowercase, so comparisons ignore case and surrounding spaces. */
function normalizeForComparison(value: string): string {
  return value.trim().toLowerCase();
}

const COMMON_PASSWORDS = loadCommonPasswords(COMMON_PASSWORDS_FILE);

/** True when the password is on the embedded common-password blocklist. */
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(normalizeForComparison(password));
}

function isSameAsUsername(password: string, username: string | undefined): boolean {
  const normalizedUsername = normalizeForComparison(username ?? '');
  return normalizedUsername !== '' && normalizeForComparison(password) === normalizedUsername;
}

/**
 * Check a password that is being set (account creation, self-service change,
 * admin reset). Never called on login: existing hashes are not re-checked.
 *
 * Follows NIST SP 800-63B: length, a blocklist of common passwords and a
 * ban on reusing the username (when given), no composition rules. Length
 * counts Unicode code points, so a passphrase in any script gets the same
 * budget; the maximum also caps the scrypt input size. The blocklist and
 * username comparisons ignore case and surrounding spaces.
 *
 * Returns a user-facing message, or null when the password is acceptable.
 */
export function validatePasswordStrength(password: string, username?: string): string | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  }
  if (isCommonPassword(password)) {
    return 'This password is too common, choose another one';
  }
  if (isSameAsUsername(password, username)) {
    return 'Password must not be the same as the username';
  }
  return null;
}
