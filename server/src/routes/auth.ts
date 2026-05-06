import { validateInputSize } from "../middleware/input-validation.js";
import express, { Request, Response, NextFunction } from 'express';
import type { DB } from '../db/client.js';
import type { ApiResponse } from '../types/api.js';
import { authLimiter, registerLimiter } from '../middleware/rate-limit.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { AuthService } from '../services/auth-service.js';
import type { PermissionName } from '../types/role.js';
import { ValidationError, AuthError, NotFoundError } from '../utils/errors.js';
import { parseJwtExpiration } from '../utils/jwt-config.js';
import { setCsrfCookie, clearCsrfCookie } from '../middleware/csrf.js';

const router = express.Router();

router.use(validateInputSize({ maxStringLength: 254 }));

/** Cookie name for JWT token storage (httpOnly, XSS-resistant). */
const AUTH_COOKIE = 'auth_token';

function setAuthCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

  // Convert JWT expiration to milliseconds for cookie maxAge
  let maxAgeMs: number;
  const parsed = parseJwtExpiration(expiresIn);
  if (typeof parsed === 'number') {
    maxAgeMs = parsed * 1000; // seconds → ms
  } else {
    // Human-readable format: '24h', '7d', '30m', '3600s'
    const match = parsed.match(/^(\d+)([hdms])$/);
    const value = match ? parseInt(match[1], 10) : 86400;
    const unit = (match?.[2] ?? 's') as string;
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    maxAgeMs = value * (multipliers[unit] ?? 3600) * 1000;
  }

  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: maxAgeMs,
    path: '/',
  });
}

export interface AuthResponse {
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

// POST /api/auth/login - Login user
router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const db: DB = req.app.get('db');
        const authService = new AuthService(db);
        const { username, password } = req.body;

        const authData = await authService.login(username, password);

        // Set httpOnly cookie (XSS-resistant) — also keep token in body for backward compat
        setAuthCookie(res, authData.token);
        setCsrfCookie(res);

        const response: ApiResponse<AuthResponse> = {
            success: true,
            data: authData
        };

        res.json(response);
    } catch (error: any) {
        if (error.message === 'Username and password are required') {
            return next(new ValidationError(error.message));
        }
        if (error.message === 'Invalid credentials') {
            return next(new AuthError(error.message));
        }
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
    } catch (error: any) {
        if (error.message === 'Username and password are required' || error.message.includes('Password must') || error.message.includes('Username must')) {
            return next(new ValidationError(error.message));
        }
        if (error.message === 'Username already exists') {
            return next(new ValidationError(error.message)); // Conflict mapped to validation for now
        }
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

        const response: ApiResponse = {
            success: true,
            data: {
                message: 'Password changed successfully',
            },
        };

        res.json(response);
    } catch (error: any) {
        if (error.message === 'Current password and new password are required' || 
            error.message.includes('Password must')) {
            return next(new ValidationError(error.message));
        }
        if (error.message === 'User not found') {
            return next(new NotFoundError(error.message));
        }
        if (error.message === 'Current password is incorrect') {
            return next(new AuthError(error.message));
        }
        next(error);
    }
});

// POST /api/auth/logout — Clear httpOnly auth cookie and CSRF cookie
router.post('/logout', (_req: Request, res: Response) => {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    clearCsrfCookie(res);
    res.json({ success: true, data: { message: 'Logged out' } });
});

// GET /api/auth/me — Return current user from cookie or Authorization header
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    res.json({
        success: true,
        data: {
            id: user.id,
            username: user.username,
            role_name: user.role_name,
            is_system_role: user.is_system_role,
            permissions: user.permissions,
            org_slug: user.org_slug,
            org_id: user.org_id,
        },
    });
});

export default router;
