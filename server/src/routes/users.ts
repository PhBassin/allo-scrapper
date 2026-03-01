import express from 'express';
import { db } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
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
import { createUser } from '../db/queries.js';
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
  requireAuth,
  requireAdmin,
  async (req: express.Request, res: express.Response) => {
    try {


      // Parse pagination params
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      // Validate pagination params
      if (isNaN(limit) || limit < 1) {
        return res.status(400).json({
          success: false,
          error: 'Invalid limit parameter',
        } as ApiResponse);
      }
      if (isNaN(offset) || offset < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid offset parameter',
        } as ApiResponse);
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
  requireAuth,
  requireAdmin,
  async (req: express.Request, res: express.Response) => {
    try {

      const userId = parseInt(req.params.id, 10);

      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        } as ApiResponse);
      }

      const user = await getUserById(db, userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        } as ApiResponse);
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
  requireAuth,
  requireAdmin,
  async (req: express.Request, res: express.Response) => {
    try {

      const { username, password, role } = req.body;

      // Validate required fields
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required',
        } as ApiResponse);
      }

      // Validate username format
      if (!USERNAME_REGEX.test(username)) {
        return res.status(400).json({
          success: false,
          error: 'Username must be alphanumeric and 3-15 characters long',
        } as ApiResponse);
      }

      // Validate password
      const passwordError = validatePassword(password);
      if (passwordError) {
        return res.status(400).json({
          success: false,
          error: passwordError,
        } as ApiResponse);
      }

      // Validate role (default to 'user' if not provided)
      const userRole: UserRole = role || 'user';
      if (userRole !== 'admin' && userRole !== 'user') {
        return res.status(400).json({
          success: false,
          error: 'Invalid role. Must be "admin" or "user"',
        } as ApiResponse);
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const newUser = await createUser(db, {
        username,
        password_hash: passwordHash,
        role: userRole,
      });

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
        return res.status(409).json({
          success: false,
          error: 'Username already exists',
        } as ApiResponse);
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
  requireAuth,
  requireAdmin,
  async (req: express.Request, res: express.Response) => {
    try {

      const userId = parseInt(req.params.id, 10);
      const { role } = req.body;

      // Validate user ID
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        } as ApiResponse);
      }

      // Validate role
      if (!role) {
        return res.status(400).json({
          success: false,
          error: 'Role is required',
        } as ApiResponse);
      }
      if (role !== 'admin' && role !== 'user') {
        return res.status(400).json({
          success: false,
          error: 'Invalid role. Must be "admin" or "user"',
        } as ApiResponse);
      }

      // Check if user exists
      const targetUser = await getUserById(db, userId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        } as ApiResponse);
      }

      // Safety guard: Prevent demoting the last admin
      if (targetUser.role === 'admin' && role === 'user') {
        const adminCount = await getAdminCount(db);
        if (adminCount <= 1) {
          return res.status(403).json({
            success: false,
            error: 'Cannot demote the last admin user',
          } as ApiResponse);
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
  requireAuth,
  requireAdmin,
  async (req: express.Request, res: express.Response) => {
    try {

      const userId = parseInt(req.params.id, 10);

      // Validate user ID
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        } as ApiResponse);
      }

      // Check if user exists
      const targetUser = await getUserById(db, userId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        } as ApiResponse);
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
  requireAuth,
  requireAdmin,
  async (req: express.Request, res: express.Response) => {
    try {

      const userId = parseInt(req.params.id, 10);

      // Validate user ID
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        } as ApiResponse);
      }

      // Safety guard: Prevent self-deletion
      if (userId === req.user!.id) {
        return res.status(403).json({
          success: false,
          error: 'Cannot delete your own account',
        } as ApiResponse);
      }

      // Check if user exists and get their role
      const targetUser = await getUserById(db, userId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        } as ApiResponse);
      }

      // Safety guard: Prevent deleting the last admin
      if (targetUser.role === 'admin') {
        const adminCount = await getAdminCount(db);
        if (adminCount <= 1) {
          return res.status(403).json({
            success: false,
            error: 'Cannot delete the last admin user',
          } as ApiResponse);
        }
      }

      // Delete user
      const deleted = await deleteUser(db, userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        } as ApiResponse);
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
