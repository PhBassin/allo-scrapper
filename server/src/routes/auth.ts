import express, { Request, Response, NextFunction } from 'express';
import type { DB } from '../db/client.js';
import type { ApiResponse } from '../types/api.js';
import { authLimiter, registerLimiter } from '../middleware/rate-limit.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { AuthService } from '../services/auth-service.js';
import { RefreshTokenService } from '../services/refresh-token-service.js';
import type { PermissionName } from '../types/role.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

const router = express.Router();

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

interface AuthResponse {
    token: string;
    user: {
        id: number;
        username: string;
        role_id: number;
        role_name: string;
        is_system_role: boolean;
        permissions: PermissionName[];
    };
}

const isSecureCookie = process.env.COOKIE_SECURE !== 'false';

/**
 * Set refresh token as httpOnly cookie (7 days).
 */
function setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
        httpOnly: true,
        secure: isSecureCookie,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/auth',
    });
}

/**
 * Clear refresh token cookie.
 */
function clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: isSecureCookie,
        sameSite: 'strict',
        path: '/api/auth',
    });
}

/**
 * Set access token as httpOnly cookie (15 min expiration).
 */
function setAccessTokenCookie(res: Response, token: string): void {
    res.cookie('access_token', token, {
        httpOnly: true,
        secure: isSecureCookie,
        sameSite: 'lax',
        maxAge: ACCESS_TOKEN_MAX_AGE_MS, // 15 minutes
        path: '/',
    });
}

/**
 * Clear access token cookie.
 */
function clearAccessTokenCookie(res: Response): void {
    res.clearCookie('access_token', {
        httpOnly: true,
        secure: isSecureCookie,
        sameSite: 'lax',
        path: '/',
    });
}

/**
 * Set CSRF token cookie (readable by JS for double-submit pattern).
 */
function setCsrfCookie(res: Response): string {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie('csrf_token', token, {
        httpOnly: false,
        secure: isSecureCookie,
        sameSite: 'strict',
        path: '/',
    });
    return token;
}

/**
 * Clear CSRF token cookie.
 */
function clearCsrfCookie(res: Response): void {
    res.clearCookie('csrf_token', {
        httpOnly: false,
        secure: isSecureCookie,
        sameSite: 'strict',
        path: '/',
    });
}

// POST /api/auth/login - Login user
router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const db: DB = req.app.get('db');
        const authService = new AuthService(db);
        const refreshTokenService = new RefreshTokenService(db);
        const { username, password } = req.body;

        const authData = await authService.login(username, password);

        // Generate and set refresh token cookie
        const refreshToken = await refreshTokenService.generate(authData.user.id);
        setRefreshTokenCookie(res, refreshToken);

        // Set access token as httpOnly cookie for protection against XSS
        setAccessTokenCookie(res, authData.token);

        // Set CSRF token for double-submit protection
        setCsrfCookie(res);

        const response: ApiResponse<AuthResponse> = {
            success: true,
            data: authData
        };

        res.json(response);
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/register - Register a new user (requires users:create permission)
router.post('/register', registerLimiter, requireAuth, requirePermission('users:create'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const db: DB = req.app.get('db');
        const authService = new AuthService(db);
        const { username, password } = req.body;

        const user = await authService.register(username, password);

        const response: ApiResponse = {
            success: true,
            data: {
                message: 'User registered successfully',
                user
            }
        };

        res.status(201).json(response);
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/change-password - Change user password (protected)
router.post('/change-password', authLimiter, requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db: DB = req.app.get('db');
        const authService = new AuthService(db);
        const { currentPassword, newPassword } = req.body;

        await authService.changePassword(req.user!.username, currentPassword, newPassword);

        const refreshTokenService = new RefreshTokenService(db);

        // Revoke all refresh tokens for this user — forces re-login on all devices
        await refreshTokenService.revokeAllForUser(req.user!.id);

        // Clear auth cookies to force a fresh login
        clearRefreshTokenCookie(res);
        clearAccessTokenCookie(res);

        const response: ApiResponse = {
            success: true,
            data: {
                message: 'Password changed successfully',
            },
        };

        res.json(response);
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/refresh - Refresh access token using refresh token cookie
router.post('/refresh', authLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const db: DB = req.app.get('db');
        const refreshTokenService = new RefreshTokenService(db);

        const refreshToken = req.cookies?.refresh_token;
        if (!refreshToken) {
            clearRefreshTokenCookie(res);
            clearAccessTokenCookie(res);
            res.status(401).json({
                success: false,
                error: 'No refresh token provided.',
            });
            return;
        }

        const userId = await refreshTokenService.validate(refreshToken);
        if (userId === null) {
            clearRefreshTokenCookie(res);
            clearAccessTokenCookie(res);
            res.status(401).json({
                success: false,
                error: 'Invalid or expired refresh token.',
            });
            return;
        }

        // Get user info for new access token
        const userResult = await db.query<{
            id: number; username: string; role_id: number; role_name: string; is_system_role: boolean;
        }>(
            `SELECT u.id, u.username, r.id as role_id, r.name as role_name, r.is_system_role
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            clearRefreshTokenCookie(res);
            clearAccessTokenCookie(res);
            res.status(401).json({
                success: false,
                error: 'User not found.',
            });
            return;
        }

        const user = userResult.rows[0];

        // Atomically rotate: generate new token AND revoke old one in one transaction
        const newRefreshToken = await refreshTokenService.rotate(userId, refreshToken);

        // Generate new access token
        const jwt = await import('jsonwebtoken');
        const { getCurrentSecret } = await import('../utils/jwt-secrets.js');
        const { parseJwtExpiration } = await import('../utils/jwt-config.js');
        const { getPermissionNamesByRoleId } = await import('../db/role-queries.js');

        const secret = getCurrentSecret();
        const expiresIn = parseJwtExpiration(process.env.JWT_EXPIRES_IN || '1h');
        const permissions = await getPermissionNamesByRoleId(db, user.role_id);

        const accessToken = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role_name: user.role_name,
                is_system_role: user.is_system_role,
                permissions,
            },
            secret,
            { algorithm: 'HS256', expiresIn: expiresIn as any }
        );

        // Set new refresh token cookie
        setRefreshTokenCookie(res, newRefreshToken);

        // Set access token as httpOnly cookie for protection against XSS
        setAccessTokenCookie(res, accessToken);

        // Rotate CSRF token
        setCsrfCookie(res);

        res.json({
            success: true,
            data: {
                token: accessToken,
                user: {
                    id: user.id,
                    username: user.username,
                    role_id: user.role_id,
                    role_name: user.role_name,
                    is_system_role: user.is_system_role,
                    permissions,
                },
            },
        });
    } catch (error: any) {
        next(error);
    }
});

// POST /api/auth/logout - Logout and revoke refresh token
router.post('/logout', async (req: Request, res: Response) => {
    const db: DB = req.app.get('db');
    const refreshTokenService = new RefreshTokenService(db);

    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
        try {
            await refreshTokenService.revoke(refreshToken);
        } catch (err) {
            logger.warn('Failed to revoke refresh token during logout:', err);
        }
    }

    clearRefreshTokenCookie(res);
    clearAccessTokenCookie(res);
    clearCsrfCookie(res);

    res.json({ success: true, data: { message: 'Logged out successfully' } });
});

// GET /api/auth/me - Validate current session (cookie-based)
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
    res.json({
        success: true,
        data: {
            user: {
                id: req.user!.id,
                username: req.user!.username,
            },
        },
    });
});

export default router;
