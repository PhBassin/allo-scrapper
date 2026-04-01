/**
 * Minimal validator for SUPERADMIN_JWT_SECRET.
 * Mirrors the pattern used by the core jwt-secret-validator.
 */
export function validateSuperadminJWTSecret(): void {
  const secret = process.env.SUPERADMIN_JWT_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      'FATAL: SUPERADMIN_JWT_SECRET is missing or too short. ' +
        'Generate a secure secret with: openssl rand -base64 64',
    );
  }
}
