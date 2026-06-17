const USERNAME_REGEX = /^[a-zA-Z0-9]{3,15}$/;

export function validateUsername(username: string): string | null {
  if (!username) return 'Username is required';
  if (!USERNAME_REGEX.test(username)) {
    if (username.length < 3 || username.length > 15) return 'Username must be 3-15 characters';
    return 'Username must be alphanumeric';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one digit';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character';
  return null;
}

export interface UserFormErrors {
  username?: string;
  password?: string;
}

export function validateUserForm(username: string, password: string): UserFormErrors {
  const errors: UserFormErrors = {};
  const usernameError = validateUsername(username);
  const passwordError = validatePassword(password);
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