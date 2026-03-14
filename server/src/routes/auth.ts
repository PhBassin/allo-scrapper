import express from 'express';
import type { DB } from '../db/client.js';
import type { ApiResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';
import { authLimiter, registerLimiter } from '../middleware/rate-limit.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { AuthService } from '../services/auth-service.js';
import type { PermissionName } from '../types/role.js';

const router = express.Router();

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
router.post('/login', authLimiter, async (req, res) => {
    try {
        const db: DB = req.app.get('db');
        const authService = new AuthService(db);
        const { username, password } = req.body;

        const authData = await authService.login(username, password);

        const response: ApiResponse<AuthResponse> = {
            success: true,
            data: authData
        };

        return res.json(response);
    } catch (error: any) {
        if (error.message === 'Username and password are required') {
            return res.status(400).json({ success: false, error: error.message });
        }
        if (error.message === 'Invalid credentials') {
            return res.status(401).json({ success: false, error: error.message });
        }
        logger.error('Login error:', error);
        return res.status(500).json({ success: false, error: 'Authentication failed' });
    }
});

// POST /api/auth/register - Register a new user (requires users:create permission)
router.post('/register', registerLimiter, requireAuth, requirePermission('users:create'), async (req, res) => {
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

        return res.status(201).json(response);
    } catch (error: any) {
        if (error.message === 'Username and password are required') {
            return res.status(400).json({ success: false, error: error.message });
        }
        if (error.message === 'Username already exists') {
            return res.status(409).json({ success: false, error: error.message });
        }
        logger.error('Registration error:', error);
        return res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

// POST /api/auth/change-password - Change user password (protected)
router.post('/change-password', authLimiter, requireAuth, async (req: AuthRequest, res) => {
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

        return res.json(response);
    } catch (error: any) {
        if (error.message === 'Current password and new password are required' || 
            error.message.includes('Password must')) {
            return res.status(400).json({ success: false, error: error.message });
        }
        if (error.message === 'User not found') {
            return res.status(404).json({ success: false, error: error.message });
        }
        if (error.message === 'Current password is incorrect') {
            return res.status(401).json({ success: false, error: error.message });
        }
        
        logger.error('Change password error:', error);
        return res.status(500).json({ success: false, error: 'Failed to change password' });
    }
});

export default router;
