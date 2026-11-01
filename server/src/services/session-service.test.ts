import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';
import type { DB } from '../db/index.js';

// ---------------------------------------------------------------------------
// Mocks. SessionService composes AuthService and the refresh-token repository,
// and reads user/permission queries. We stub all collaborators so we can drive
// each lifecycle method with plain function calls and assert on the orchestration
// (cookie writes, response shape, 401 paths) directly — no supertest, no HTTP.
// ---------------------------------------------------------------------------

const authMock = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  changePassword: vi.fn(),
  mintAccessToken: vi.fn(),
}));

vi.mock('./auth-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./auth-service.js')>();
  return {
    ...actual,
    AuthService: vi.fn(function () {
      return authMock;
    }),
  };
});

vi.mock('../repositories/refresh-token-repository.js', () => ({
  generateRefreshToken: vi.fn(),
  validateRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  rotateRefreshToken: vi.fn(),
  revokeAllUserTokens: vi.fn(),
  parseRefreshTokenExpiry: vi.fn(() => 7 * 24 * 60 * 60 * 1000),
}));

vi.mock('../db/user-queries.js', () => ({
  getUserWithRoleById: vi.fn(),
}));

vi.mock('../db/role-queries.js', () => ({
  getPermissionNamesByRoleId: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const { SessionService } = await import('./session-service.js');
const refreshTokenRepo = await import('../repositories/refresh-token-repository.js');
const userQueries = await import('../db/user-queries.js');
const roleQueries = await import('../db/role-queries.js');

const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function buildRes(): Response {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('SessionService', () => {
  const db = { sentinel: 'db' } as unknown as DB;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------
  describe('login', () => {
    it('authenticates, issues a refresh token, and plants all three cookies', async () => {
      const authData = {
        token: 'access-jwt',
        user: {
          id: 7,
          username: 'alice',
          role_id: 2,
          role_name: 'operator',
          is_system_role: false,
          permissions: ['scraper:trigger'],
        },
      };
      authMock.login.mockResolvedValue(authData);
      vi.mocked(refreshTokenRepo.generateRefreshToken).mockResolvedValue('refresh-raw');

      const res = buildRes();
      const session = new SessionService(db, res);

      await session.login('alice', 'pw');

      expect(authMock.login).toHaveBeenCalledWith('alice', 'pw');
      expect(refreshTokenRepo.generateRefreshToken).toHaveBeenCalledWith(db, 7);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: authData });

      expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'refresh-raw', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: REFRESH_MAX_AGE,
        path: '/api/auth',
      });
      expect(res.cookie).toHaveBeenCalledWith('access_token', 'access-jwt', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });
      expect(res.cookie).toHaveBeenCalledWith(
        'csrf_token',
        expect.any(String),
        expect.objectContaining({ httpOnly: false, path: '/' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------
  describe('register', () => {
    it('delegates to AuthService.register and creates no session', async () => {
      const created = { id: 9, username: 'bob', role_id: 3, role_name: 'user' };
      authMock.register.mockResolvedValue(created);

      const res = buildRes();
      const session = new SessionService(db, res);

      const result = await session.register('bob', 'StrongPw1!');

      expect(result).toBe(created);
      expect(authMock.register).toHaveBeenCalledWith('bob', 'StrongPw1!');
      expect(refreshTokenRepo.generateRefreshToken).not.toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // refresh
  // -------------------------------------------------------------------------
  describe('refresh', () => {
    it('writes a 401 and clears cookies when no refresh token is present', async () => {
      const res = buildRes();
      const session = new SessionService(db, res);

      await session.refresh(undefined);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No refresh token provided.',
      });
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object));
      expect(refreshTokenRepo.validateRefreshToken).not.toHaveBeenCalled();
    });

    it('writes a 401 when the refresh token is invalid/expired', async () => {
      vi.mocked(refreshTokenRepo.validateRefreshToken).mockResolvedValue(null);

      const res = buildRes();
      const session = new SessionService(db, res);

      await session.refresh('stale');

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired refresh token.',
      });
    });

    it('writes a 401 and does NOT rotate when the user no longer exists', async () => {
      vi.mocked(refreshTokenRepo.validateRefreshToken).mockResolvedValue(5);
      vi.mocked(userQueries.getUserWithRoleById).mockResolvedValue(undefined);

      const res = buildRes();
      const session = new SessionService(db, res);

      await session.refresh('valid-but-orphaned');

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found.',
      });
      expect(refreshTokenRepo.rotateRefreshToken).not.toHaveBeenCalled();
    });

    it('writes a 401 (not a 500) when the token is consumed concurrently during rotation', async () => {
      vi.mocked(refreshTokenRepo.validateRefreshToken).mockResolvedValue(5);
      vi.mocked(userQueries.getUserWithRoleById).mockResolvedValue({
        id: 5,
        username: 'alice',
        role_id: 2,
        role_name: 'operator',
        is_system_role: false,
      });
      vi.mocked(refreshTokenRepo.rotateRefreshToken).mockResolvedValue(null);

      const res = buildRes();
      const session = new SessionService(db, res);

      await session.refresh('raced-token');

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired refresh token.',
      });
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object));
      expect(authMock.mintAccessToken).not.toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('rotates the token, mints an access token, and writes the session on success', async () => {
      vi.mocked(refreshTokenRepo.validateRefreshToken).mockResolvedValue(5);
      vi.mocked(userQueries.getUserWithRoleById).mockResolvedValue({
        id: 5,
        username: 'alice',
        role_id: 2,
        role_name: 'operator',
        is_system_role: false,
      });
      vi.mocked(refreshTokenRepo.rotateRefreshToken).mockResolvedValue('new-refresh');
      authMock.mintAccessToken.mockResolvedValue('access-jwt');
      vi.mocked(roleQueries.getPermissionNamesByRoleId).mockResolvedValue(['scraper:trigger']);

      const res = buildRes();
      const session = new SessionService(db, res);

      await session.refresh('old-refresh');

      expect(refreshTokenRepo.rotateRefreshToken).toHaveBeenCalledWith(db, 5, 'old-refresh');
      expect(authMock.mintAccessToken).toHaveBeenCalledWith(expect.any(Object), db);
      expect(roleQueries.getPermissionNamesByRoleId).toHaveBeenCalledWith(db, 2);

      // Cookie surface (refresh + access + csrf) all planted
      expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'new-refresh', expect.any(Object));
      expect(res.cookie).toHaveBeenCalledWith('access_token', 'access-jwt', expect.any(Object));
      expect(res.cookie).toHaveBeenCalledWith('csrf_token', expect.any(String), expect.any(Object));

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          token: 'access-jwt',
          user: {
            id: 5,
            username: 'alice',
            role_id: 2,
            role_name: 'operator',
            is_system_role: false,
            permissions: ['scraper:trigger'],
          },
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------
  describe('logout', () => {
    it('revokes the token and clears all three cookies', async () => {
      vi.mocked(refreshTokenRepo.revokeRefreshToken).mockResolvedValue(undefined);

      const res = buildRes();
      const session = new SessionService(db, res);

      await session.logout('a-token');

      expect(refreshTokenRepo.revokeRefreshToken).toHaveBeenCalledWith(db, 'a-token');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith('csrf_token', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    });

    it('skips revocation but still clears cookies when no token is present', async () => {
      const res = buildRes();
      const session = new SessionService(db, res);

      await session.logout(undefined);

      expect(refreshTokenRepo.revokeRefreshToken).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledTimes(3);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    });

    it('swallows revocation failures and still logs out cleanly', async () => {
      vi.mocked(refreshTokenRepo.revokeRefreshToken).mockRejectedValue(new Error('db down'));

      const res = buildRes();
      const session = new SessionService(db, res);

      await expect(session.logout('a-token')).resolves.toBeUndefined();
      expect(res.clearCookie).toHaveBeenCalledTimes(3);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    });
  });

  // -------------------------------------------------------------------------
  // changePassword
  // -------------------------------------------------------------------------
  describe('changePassword', () => {
    it('changes the password, revokes all tokens, and clears the auth cookies', async () => {
      authMock.changePassword.mockResolvedValue(undefined);
      vi.mocked(refreshTokenRepo.revokeAllUserTokens).mockResolvedValue(undefined);

      const res = buildRes();
      const session = new SessionService(db, res);

      await session.changePassword(5, 'alice', 'old', 'NewPw1!');

      expect(authMock.changePassword).toHaveBeenCalledWith('alice', 'old', 'NewPw1!');
      expect(refreshTokenRepo.revokeAllUserTokens).toHaveBeenCalledWith(db, 5);
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object));
      // CSRF is not part of the change-password cookie clear
      expect(res.clearCookie).not.toHaveBeenCalledWith('csrf_token', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Password changed successfully' },
      });
    });

    it('does not revoke tokens or clear cookies when the password change fails', async () => {
      authMock.changePassword.mockRejectedValue(new Error('Current password is incorrect'));

      const res = buildRes();
      const session = new SessionService(db, res);

      await expect(
        session.changePassword(5, 'alice', 'wrong', 'NewPw1!'),
      ).rejects.toThrow('Current password is incorrect');

      expect(refreshTokenRepo.revokeAllUserTokens).not.toHaveBeenCalled();
      expect(res.clearCookie).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
