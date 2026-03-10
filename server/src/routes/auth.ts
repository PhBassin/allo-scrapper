import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUserByUsername, createUser, updateUserPassword } from '../db/queries.js';
import { getPermissionNamesByRoleId } from '../db/role-queries.js';
import type { DB } from '../db/client.js';
import type { ApiResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';
import { authLimiter, registerLimiter } from '../middleware/rate-limit.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { validatePasswordStrength } from '../utils/security.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
const JWT_EXPIRES_IN = '24h';

// Pre-computed hash for 'dummy' (cost 10) to prevent timing attacks
const DUMMY_HASH = '$2b$10$OjIEvY.r8hZtkpA2kEa0EeIJoxe2tgk/ANQghcJfuj5QA7h/lDEb2';

export interface AuthResponse {
    token: string;
    user: {
        id: number;
        username: string;
        role_id: number;
        role_name: string;
    };
}

// POST /api/auth/login - Login user
router.post('/login', authLimiter, async (req, res) => {
    try {
        const db: DB = req.app.get('db');
        const { username, password } = req.body;

        if (!username || !password) {
            const response: ApiResponse = {
                success: false,
                error: 'Username and password are required',
            };
            return res.status(400).json(response);
        }

        const user = await getUserByUsername(db, username);

        // Use user's hash or dummy hash to ensure constant time comparison
        const hashToCompare = user ? user.password_hash : DUMMY_HASH;

        const isMatch = await bcrypt.compare(password, hashToCompare);

        if (!user || !isMatch) {
            const response: ApiResponse = {
                success: false,
                error: 'Invalid credentials',
            };
            return res.status(401).json(response);
        }

        // Load permissions for this role
        const permissions = await getPermissionNamesByRoleId(db, user.role_id);

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role_name: user.role_name,
                is_system_role: user.is_system_role,
                permissions,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        const response: ApiResponse<AuthResponse> = {
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role_id: user.role_id,
                    role_name: user.role_name,
                }
            }
        };

        return res.json(response);
    } catch (error) {
        logger.error('Login error:', error);
        const response: ApiResponse = {
            success: false,
            error: 'Authentication failed',
        };
        return res.status(500).json(response);
    }
});

// POST /api/auth/register - Register a new user (requires users:create permission)
router.post('/register', registerLimiter, requireAuth, requirePermission('users:create'), async (req, res) => {
    try {
        const db: DB = req.app.get('db');
        const { username, password } = req.body;

        if (!username || !password) {
            const response: ApiResponse = {
                success: false,
                error: 'Username and password are required',
            };
            return res.status(400).json(response);
        }

        const existingUser = await getUserByUsername(db, username);
        if (existingUser) {
            const response: ApiResponse = {
                success: false,
                error: 'Username already exists',
            };
            return res.status(409).json(response);
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const user = await createUser(db, username, passwordHash);

        const response: ApiResponse = {
            success: true,
            data: {
                message: 'User registered successfully',
                user: {
                    id: user.id,
                    username: user.username,
                    role_id: user.role_id,
                    role_name: user.role_name,
                }
            }
        };

        return res.status(201).json(response);
    } catch (error) {
        logger.error('Registration error:', error);
        const response: ApiResponse = {
            success: false,
            error: 'Registration failed',
        };
        return res.status(500).json(response);
    }
});

// POST /api/auth/change-password - Change user password (protected)
router.post('/change-password', requireAuth, authLimiter, async (req: AuthRequest, res) => {
    try {
        const db: DB = req.app.get('db');
        const { currentPassword, newPassword } = req.body;

        // Validate required fields
        if (!currentPassword || !newPassword) {
            const response: ApiResponse = {
                success: false,
                error: 'Current password and new password are required',
            };
            return res.status(400).json(response);
        }

        // Validate password strength (OWASP/NIST best practices)
        const passwordError = validatePasswordStrength(newPassword);
        if (passwordError) {
            const response: ApiResponse = {
                success: false,
                error: passwordError,
            };
            return res.status(400).json(response);
        }

        // Get user from database (req.user is set by requireAuth middleware)
        const user = await getUserByUsername(db, req.user!.username);

        if (!user) {
            const response: ApiResponse = {
                success: false,
                error: 'User not found',
            };
            return res.status(404).json(response);
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            const response: ApiResponse = {
                success: false,
                error: 'Current password is incorrect',
            };
            return res.status(401).json(response);
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        // Update password in database
        await updateUserPassword(db, user.id, newPasswordHash);

        logger.info(`Password changed for user: ${user.username}`);

        const response: ApiResponse = {
            success: true,
            data: {
                message: 'Password changed successfully',
            },
        };

        return res.json(response);
    } catch (error) {
        logger.error('Change password error:', error);
        const response: ApiResponse = {
            success: false,
            error: 'Failed to change password',
        };
        return res.status(500).json(response);
    }
});

export default router;
