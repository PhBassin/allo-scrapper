import crypto from 'crypto';
import type { Response } from 'express';
import type { DB } from '../db/index.js';
import { AuthService, toSessionUser } from './auth-service.js';
import {
  generateRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
  parseRefreshTokenExpiry,
} from '../repositories/refresh-token-repository.js';
import { getUserWithRoleById } from '../db/user-queries.js';
import { getPermissionNamesByRoleId } from '../db/role-queries.js';
import type { PermissionName } from '../types/role.js';
import { logger } from '../utils/logger.js';

/**
 * Session — the user-auth credential lifecycle for one request.
 *
 * Owns, end to end: access-token minting, refresh-token issue/rotate/revoke,
 * the httpOnly cookie + double-submit CSRF surface, and permission
 * resolution. Route handlers (`routes/auth.ts`) are thin shims over this
 * seam — no cookie, refresh-token, or CSRF logic lives inline in a route.
 *
 * The refresh-token lifetime is declared in exactly one place —
 * `parseRefreshTokenExpiry` (driven by `REFRESH_TOKEN_EXPIRY`) — and both the
 * persisted token expiry and the refresh cookie's `maxAge` read from it.
 *
 * See `CONTEXT.md` → *Session*.
 */

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
/** Single source of truth for the refresh-token lifetime (token + cookie). */
const REFRESH_TOKEN_MAX_AGE_MS = parseRefreshTokenExpiry();
const isSecureCookies = process.env.COOKIE_SECURE !== 'false';

export class SessionService {
  private readonly auth: AuthService;

  constructor(
    private readonly db: DB,
    private readonly res: Response,
  ) {
    this.auth = new AuthService(db);
  }

  // -------------------------------------------------------------------------
  // Cookie + CSRF surface (private)
  // -------------------------------------------------------------------------

  private setRefreshTokenCookie(token: string): void {
    this.res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isSecureCookies,
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
      path: '/api/auth',
    });
  }

  private clearRefreshTokenCookie(): void {
    this.res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isSecureCookies,
      sameSite: 'strict',
      path: '/api/auth',
    });
  }

  private setAccessTokenCookie(token: string): void {
    this.res.cookie('access_token', token, {
      httpOnly: true,
      secure: isSecureCookies,
      sameSite: 'lax',
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
      path: '/',
    });
  }

  private clearAccessTokenCookie(): void {
    this.res.clearCookie('access_token', {
      httpOnly: true,
      secure: isSecureCookies,
      sameSite: 'lax',
      path: '/',
    });
  }

  /** Mint and plant a CSRF token cookie (readable by JS for double-submit). */
  private setCsrfCookie(): string {
    const token = crypto.randomBytes(32).toString('hex');
    this.res.cookie('csrf_token', token, {
      httpOnly: false,
      secure: isSecureCookies,
      sameSite: 'strict',
      path: '/',
    });
    return token;
  }

  private clearCsrfCookie(): void {
    this.res.clearCookie('csrf_token', {
      httpOnly: false,
      secure: isSecureCookies,
      sameSite: 'strict',
      path: '/',
    });
  }

  // -------------------------------------------------------------------------
  // Response envelope (private). Every lifecycle method that touches the
  // cookie surface owns its full HTTP response through these two helpers, so
  // the routes are uniform void shims; `register` (no cookie surface) is the
  // sole exception and returns the created user.
  // -------------------------------------------------------------------------

  private sendSuccess(data: unknown, status: number = 200): void {
    this.res.status(status).json({ success: true, data });
  }

  private rejectUnauthorized(message: string): void {
    this.clearRefreshTokenCookie();
    this.clearAccessTokenCookie();
    this.res.status(401).json({ success: false, error: message });
  }

  // -------------------------------------------------------------------------
  // Lifecycle (public)
  // -------------------------------------------------------------------------

  /**
   * Authenticate, issue access + refresh tokens, plant the cookie surface
   * (refresh + access + CSRF), and write the success response. Returns
   * nothing — the route is a void shim.
   */
  async login(username: string, password: string): Promise<void> {
    const authData = await this.auth.login(username, password);

    const refreshToken = await generateRefreshToken(this.db, authData.user.id);
    this.setRefreshTokenCookie(refreshToken);

    this.setAccessTokenCookie(authData.token);

    this.setCsrfCookie();

    this.sendSuccess(authData);
  }

  /**
   * Register a new user. No session is created — registration is an admin
   * action (`users:create`); the new user obtains a session by logging in.
   */
  async register(username: string, password: string) {
    return this.auth.register(username, password);
  }

  /**
   * Rotate a refresh token and issue a fresh access token. Writes the full
   * response to `res` — the success JSON + cookies, or a 401 — so the route
   * is a void shim.
   *
   * 401 cases (missing / invalid / unknown-user / concurrently-consumed
   * token) clear the cookie surface rather than throwing, matching the prior
   * handler's behavior.
   */
  async refresh(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      this.rejectUnauthorized('No refresh token provided.');
      return;
    }

    const userId = await validateRefreshToken(this.db, refreshToken);
    if (userId === null) {
      this.rejectUnauthorized('Invalid or expired refresh token.');
      return;
    }

    const user = await getUserWithRoleById(this.db, userId);
    if (!user) {
      this.rejectUnauthorized('User not found.');
      return;
    }

    // Atomically rotate the refresh token, then mint a fresh access token via
    // the canonical AuthService seam (same payload shape as login).
    const newRefreshToken = await rotateRefreshToken(this.db, userId, refreshToken);
    if (newRefreshToken === null) {
      // Lost the rotation race to a concurrent request presenting the same token.
      this.rejectUnauthorized('Invalid or expired refresh token.');
      return;
    }
    const accessToken = await this.auth.mintAccessToken(user, this.db);
    const permissions = (await getPermissionNamesByRoleId(
      this.db,
      user.role_id,
    )) as PermissionName[];

    this.setRefreshTokenCookie(newRefreshToken);
    this.setAccessTokenCookie(accessToken);
    this.setCsrfCookie();

    this.sendSuccess({ token: accessToken, user: toSessionUser(user, permissions) });
  }

  /**
   * Revoke the refresh token (best-effort) and clear the whole cookie
   * surface. Writes the success response; never throws — a revocation
   * failure is logged, not propagated.
   */
  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      try {
        await revokeRefreshToken(this.db, refreshToken);
      } catch (err) {
        logger.warn('Failed to revoke refresh token during logout:', err);
      }
    }

    this.clearRefreshTokenCookie();
    this.clearAccessTokenCookie();
    this.clearCsrfCookie();

    this.sendSuccess({ message: 'Logged out successfully' });
  }

  /**
   * Change the user's password, revoke every refresh token (forces re-login
   * on all devices), clear the local cookie surface, and write the success
   * response. Throws on auth/db failure so the route forwards to the error
   * handler — the revocation, cookie clear, and response only run on a
   * successful password change.
   */
  async changePassword(
    userId: number,
    username: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.auth.changePassword(username, currentPassword, newPassword);

    await revokeAllUserTokens(this.db, userId);

    this.clearRefreshTokenCookie();
    this.clearAccessTokenCookie();

    this.sendSuccess({ message: 'Password changed successfully' });
  }
}
