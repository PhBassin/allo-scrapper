export const PASSWORD_MIN_LENGTH = 8;

/** Username format: alphanumeric, 3-15 characters. Shared across core server and SaaS. */
export const USERNAME_REGEX = /^[a-zA-Z0-9]{3,15}$/;

export function validateUsername(username: string): string | null {
  if (!username || typeof username !== 'string') {
    return 'Username is required';
  }
  if (!USERNAME_REGEX.test(username)) {
    return 'Username must be alphanumeric and 3-15 characters long';
  }
  return null;
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one special character';
  }
  return null;
}
