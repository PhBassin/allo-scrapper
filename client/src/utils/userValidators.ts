const USERNAME_REGEX = /^[a-zA-Z0-9]{3,15}$/;

export function validateUsername(username: string): string | null {
  if (!username) return 'Username is required';
  if (!USERNAME_REGEX.test(username)) {
    if (username.length < 3 || username.length > 15) return 'Username must be 3-15 characters';
    return 'Username must be alphanumeric';
  }
  return null;
}

/**
 * Mirror of the server password policy (`validatePasswordStrength` in
 * `server/src/utils/security.ts`): 12 to 128 characters, counted in Unicode
 * code points, and not the username. The common-password blocklist stays on
 * the server, whose message the forms display.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** Length in Unicode code points, as the server counts it. */
export function passwordLength(password: string): number {
  return [...password].length;
}

/** Same comparison as the server: case-insensitive, surrounding spaces ignored. */
export function isSameAsUsername(password: string, username: string | undefined): boolean {
  const normalizedUsername = username?.trim().toLowerCase();
  return !!normalizedUsername && password.trim().toLowerCase() === normalizedUsername;
}

export function validatePassword(password: string, username?: string): string | null {
  if (!password) return 'Password is required';
  const length = passwordLength(password);
  if (length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (length > PASSWORD_MAX_LENGTH) return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  if (isSameAsUsername(password, username)) return 'Password must not be the same as the username';
  return null;
}

export interface UserFormErrors {
  username?: string;
  password?: string;
}

export function validateUserForm(username: string, password: string): UserFormErrors {
  const errors: UserFormErrors = {};
  const usernameError = validateUsername(username);
  const passwordError = validatePassword(password, username);
  if (usernameError) errors.username = usernameError;
  if (passwordError) errors.password = passwordError;
  return errors;
}

export function validateChangePasswordForm(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): string | null {
  if (!currentPassword || !newPassword || !confirmPassword) {
    return 'All fields are required';
  }
  if (newPassword !== confirmPassword) {
    return 'Passwords do not match';
  }
  return validatePassword(newPassword);
}