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

const router = express.Router();

router.use(validateInputSize({ maxStringLength: 254 }));

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

export default router;
