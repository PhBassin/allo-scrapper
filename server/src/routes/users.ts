import express from 'express';
import type { DB } from '../db/client.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { protectedLimiter } from '../middleware/rate-limit.js';
import type { ApiResponse } from '../types/api.js';
import type { UserPublic, UserRole } from '../types/user.js';
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  getAdminCount,
  generateRandomPassword,
} from '../db/user-queries.js';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Username validation regex: alphanumeric only, 3-15 characters
const USERNAME_REGEX = /^[a-zA-Z0-9]{3,15}$/;

// Password validation: min 8 chars, uppercase, lowercase, digit, special char
const PASSWORD_MIN_LENGTH = 8;
function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one special character';
  }
  return null;
}

/**
 * GET /api/users
 * List all users with pagination
 * Requires admin authentication
 */
router.get(
  '/',
  protectedLimiter,
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: express.Response): Promise<void> => {
    try {
      const db: DB = req.app.get('db');

      // Parse pagination params
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      // Validate pagination params
      if (isNaN(limit) || limit < 1) {
        res.status(400).json({
          success: false,
          error: 'Invalid limit parameter',
        } as ApiResponse);
        return;
      }
      if (isNaN(offset) || offset < 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid offset parameter',
        } as ApiResponse);
        return;
      }

      const users = await getAllUsers(db, { limit, offset });

      logger.info('Admin listed users', {
        adminId: req.user!.id,
        adminUsername: req.user!.username,
        count: users.length,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: users,
      } as ApiResponse<UserPublic[]>);
    } catch (error) {
      logger.error('Failed to list users', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to list users',
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/users/:id
 * Get a specific user by ID
 * Requires admin authentication
 */
router.get(
  '/:id',
  protectedLimiter,
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: express.Response): Promise<void> => {
    try {
      const db: DB = req.app.get('db');

      const userId = parseInt(req.params.id, 10);

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        } as ApiResponse);
        return;
      }

      const user = await getUserById(db, userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        } as ApiResponse);
        return;
      }

      logger.info('Admin retrieved user details', {
        adminId: req.user!.id,
        adminUsername: req.user!.username,
        targetUserId: userId,
        targetUsername: user.username,
      });

      res.json({
        success: true,
        data: user,
      } as ApiResponse<UserPublic>);
    } catch (error) {
      logger.error('Failed to get user', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get user',
      } as ApiResponse);
    }
  }
);

/**
 * POST /api/users
 * Create a new user
 * Requires admin authentication
 */
router.post(
  '/',
  protectedLimiter,
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: express.Response): Promise<void> => {
    try {
      const db: DB = req.app.get('db');

      const { username, password, role } = req.body;

      // Validate required fields
      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: 'Username and password are required',
        } as ApiResponse);
        return;
      }

      // Validate username format
      if (!USERNAME_REGEX.test(username)) {
        res.status(400).json({
          success: false,
          error: 'Username must be alphanumeric and 3-15 characters long',
        } as ApiResponse);
        return;
      }

      // Validate password
      const passwordError = validatePassword(password);
      if (passwordError) {
        res.status(400).json({
          success: false,
          error: passwordError,
        } as ApiResponse);
        return;
      }

      // Validate role (default to 'user' if not provided)
      const userRole: UserRole = role || 'user';
      if (userRole !== 'admin' && userRole !== 'user') {
        res.status(400).json({
          success: false,
          error: 'Invalid role. Must be "admin" or "user"',
        } as ApiResponse);
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user with direct DB query
      const result = await db.query<UserPublic>(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
        [username, passwordHash, userRole]
      );
      const newUser = result.rows[0];

      logger.info('Admin created new user', {
        adminId: req.user!.id,
        adminUsername: req.user!.username,
        newUserId: newUser.id,
        newUsername: newUser.username,
        newUserRole: newUser.role,
      });

      res.status(201).json({
        success: true,
        data: newUser,
      } as ApiResponse<UserPublic>);
    } catch (error: any) {
      // Handle duplicate username error
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        res.status(409).json({
          success: false,
          error: 'Username already exists',
        } as ApiResponse);
        return;
      }

      logger.error('Failed to create user', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create user',
      } as ApiResponse);
    }
  }
);

/**
 * PUT /api/users/:id/role
 * Update user's role
 * Requires admin authentication
 * Safety guard: Prevent demoting the last admin
 */
router.put(
  '/:id/role',
  protectedLimiter,
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: express.Response): Promise<void> => {
    try {
      const db: DB = req.app.get('db');

      const userId = parseInt(req.params.id, 10);
      const { role } = req.body;

      // Validate user ID
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        } as ApiResponse);
        return;
      }

      // Validate role
      if (!role) {
        res.status(400).json({
          success: false,
          error: 'Role is required',
        } as ApiResponse);
        return;
      }
      if (role !== 'admin' && role !== 'user') {
        res.status(400).json({
          success: false,
          error: 'Invalid role. Must be "admin" or "user"',
        } as ApiResponse);
        return;
      }

      // Check if user exists
      const targetUser = await getUserById(db, userId);
      if (!targetUser) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        } as ApiResponse);
        return;
      }

      // Safety guard: Prevent demoting the last admin
      if (targetUser.role === 'admin' && role === 'user') {
        const adminCount = await getAdminCount(db);
        if (adminCount <= 1) {
          res.status(403).json({
            success: false,
            error: 'Cannot demote the last admin user',
          } as ApiResponse);
          return;
        }
      }

      // Update role
      await updateUserRole(db, userId, role);

      // Fetch updated user
      const updatedUser = await getUserById(db, userId);

      logger.info('Admin updated user role', {
        adminId: req.user!.id,
        adminUsername: req.user!.username,
        targetUserId: userId,
        targetUsername: updatedUser!.username,
        oldRole: targetUser.role,
        newRole: role,
      });

      res.json({
        success: true,
        data: updatedUser,
      } as ApiResponse<UserPublic>);
    } catch (error) {
      logger.error('Failed to update user role', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update user role',
      } as ApiResponse);
    }
  }
);

/**
 * POST /api/users/:id/reset-password
 * Reset user's password to a randomly generated one
 * Requires admin authentication
 */
router.post(
  '/:id/reset-password',
  protectedLimiter,
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: express.Response): Promise<void> => {
    try {
      const db: DB = req.app.get('db');

      const userId = parseInt(req.params.id, 10);

      // Validate user ID
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        } as ApiResponse);
        return;
      }

      // Check if user exists
      const targetUser = await getUserById(db, userId);
      if (!targetUser) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        } as ApiResponse);
        return;
      }

      // Generate new password
      const newPassword = generateRandomPassword();

      // Hash password
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Update password in database
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
        passwordHash,
        userId,
      ]);

      logger.info('Admin reset user password', {
        adminId: req.user!.id,
        adminUsername: req.user!.username,
        targetUserId: userId,
        targetUsername: targetUser.username,
      });

      res.json({
        success: true,
        data: {
          user: targetUser,
          newPassword,
        },
      } as ApiResponse<{ user: UserPublic; newPassword: string }>);
    } catch (error) {
      logger.error('Failed to reset password', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to reset password',
      } as ApiResponse);
    }
  }
);

/**
 * DELETE /api/users/:id
 * Delete a user
 * Requires admin authentication
 * Safety guards:
 * - Prevent deleting the last admin
 * - Prevent self-deletion
 */
router.delete(
  '/:id',
  protectedLimiter,
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: express.Response): Promise<void> => {
    try {
      const db: DB = req.app.get('db');

      const userId = parseInt(req.params.id, 10);

      // Validate user ID
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        } as ApiResponse);
        return;
      }

      // Safety guard: Prevent self-deletion
      if (userId === req.user!.id) {
        res.status(403).json({
          success: false,
          error: 'Cannot delete your own account',
        } as ApiResponse);
        return;
      }

      // Check if user exists and get their role
      const targetUser = await getUserById(db, userId);
      if (!targetUser) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        } as ApiResponse);
        return;
      }

      // Safety guard: Prevent deleting the last admin
      if (targetUser.role === 'admin') {
        const adminCount = await getAdminCount(db);
        if (adminCount <= 1) {
          res.status(403).json({
            success: false,
            error: 'Cannot delete the last admin user',
          } as ApiResponse);
          return;
        }
      }

      // Delete user
      const deleted = await deleteUser(db, userId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        } as ApiResponse);
        return;
      }

      logger.info('Admin deleted user', {
        adminId: req.user!.id,
        adminUsername: req.user!.username,
        deletedUserId: userId,
        deletedUsername: targetUser.username,
        deletedUserRole: targetUser.role,
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete user', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to delete user',
      } as ApiResponse);
    }
  }
);

export default router;
