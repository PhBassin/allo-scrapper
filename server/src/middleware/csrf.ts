import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

/** Generate a random CSRF token. */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Set the CSRF token cookie (NOT httpOnly — JS must be able to read it). */
export function setCsrfCookie(res: Response): string {
  const token = generateToken();
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  return token;
}

/** Clear the CSRF token cookie. */
export function clearCsrfCookie(res: Response): void {
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

/**
 * Middleware: validate CSRF token for state-changing requests.
 * Uses double-submit cookie pattern: the cookie value must match
 * the X-CSRF-Token header. Combined with sameSite=strict, this
 * prevents CSRF attacks without server-side token storage.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Only validate state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({ success: false, error: 'CSRF token missing or invalid' });
    return;
  }

  next();
}
