import { parseStrictInt } from '../utils/number.js';
import express, { NextFunction } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { protectedLimiter } from '../middleware/rate-limit.js';
import type { ApiResponse } from '../types/api.js';
import type { UserPublic } from '../types/user.js';
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
import { validatePasswordStrength } from '../utils/security.js';
import { ValidationError, NotFoundError, AuthError } from '../utils/errors.js';
import { getDbFromRequest } from '../utils/db-from-request.js';

const router = express.Router();

// Username validation regex: alphanumeric only, 3-15 characters
const USERNAME_REGEX = /^[a-zA-Z0-9]{3,15}$/;

/**
 * GET /api/users
 * List all users with pagination
 * Requires admin authentication
 */
router.get(
  '/',
  protectedLimiter,
  requireAuth,
  requirePermission('users:list'),
  async (req: AuthRequest, res: express.Response, next: NextFunction): Promise<void> => {
    try {
      const db = getDbFromRequest(req);

      // Parse pagination params
      let limit = req.query.limit ? parseStrictInt(req.query.limit) : 100;
      const offset = req.query.offset ? parseStrictInt(req.query.offset) : 0;

      // Validate pagination params
      if (isNaN(limit) || limit < 1) {
        return next(new ValidationError('Invalid limit parameter'));
      }
      if (isNaN(offset) || offset < 0) {
        return next(new ValidationError('Invalid offset parameter'));
      }

      // Security: Validate and clamp pagination parameters to prevent DoS
      if (limit > 100) limit = 100;

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
      next(error);
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
  requirePermission('users:list'),
  async (req: AuthRequest, res: express.Response, next: NextFunction): Promise<void> => {
    try {
      const db = getDbFromRequest(req);

      const userId = parseStrictInt(req.params.id);

      if (isNaN(userId)) {
        return next(new ValidationError('Invalid user ID'));
      }

      const user = await getUserById(db, userId);

      if (!user) {
        return next(new NotFoundError('User not found'));
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
      next(error);
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
  requirePermission('users:create'),
  async (req: AuthRequest, res: express.Response, next: NextFunction): Promise<void> => {
    try {
      const db = getDbFromRequest(req);

      const { username, password, role_id } = req.body;

      // Validate required fields
      if (!username || !password) {
        return next(new ValidationError('Username and password are required'));
      }

      // Validate username format
      if (!USERNAME_REGEX.test(username)) {
        return next(new ValidationError('Username must be alphanumeric and 3-15 characters long'));
      }

      // Validate password
      const passwordError = validatePasswordStrength(password);
      if (passwordError) {
        return next(new ValidationError(passwordError));
      }

      // Validate role_id (required)
      if (!role_id || isNaN(parseStrictInt(role_id))) {
        return next(new ValidationError('role_id is required and must be a valid integer'));
      }

      const roleId = parseStrictInt(role_id);

      // Verify role_id exists
      const roleCheck = await db.query<{ id: number }>(
        'SELECT id FROM roles WHERE id = $1',
        [roleId]
      );
      if (roleCheck.rows.length === 0) {
        return next(new ValidationError('Invalid role_id: role does not exist'));
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user with direct DB query
      const result = await db.query<UserPublic>(
        `INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3)
         RETURNING id, username, role_id,
           (SELECT name FROM roles WHERE id = $3) as role_name,
           created_at`,
        [username, passwordHash, roleId]
      );
      const newUser = result.rows[0];

      logger.info('Admin created new user', {
        adminId: req.user!.id,
        adminUsername: req.user!.username,
        newUserId: newUser.id,
        newUsername: newUser.username,
        newUserRoleId: newUser.role_id,
        newUserRoleName: newUser.role_name,
      });

      res.status(201).json({
        success: true,
        data: newUser,
      } as ApiResponse<UserPublic>);
    } catch (error: any) {
      // Handle duplicate username error
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        return next(new ValidationError('Username already exists'));
      }

      next(error);
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
  requirePermission('users:update'),
  async (req: AuthRequest, res: express.Response, next: NextFunction): Promise<void> => {
    try {
      const db = getDbFromRequest(req);

      const userId = parseStrictInt(req.params.id);
      const { role_id } = req.body;

      // Validate user ID
      if (isNaN(userId)) {
        return next(new ValidationError('Invalid user ID'));
      }

      // Validate role_id
      if (!role_id) {
        return next(new ValidationError('role_id is required'));
      }

      const roleId = parseStrictInt(role_id);
      if (isNaN(roleId)) {
        return next(new ValidationError('role_id must be a valid integer'));
      }

      // Verify role exists and get its name
      const roleCheck = await db.query<{ id: number; name: string }>(
        'SELECT id, name FROM roles WHERE id = $1',
        [roleId]
      );
      if (roleCheck.rows.length === 0) {
        return next(new ValidationError('Invalid role_id: role does not exist'));
      }

      // Check if user exists
      const targetUser = await getUserById(db, userId);
      if (!targetUser) {
        return next(new NotFoundError('User not found'));
      }

      // Safety guard: Prevent demoting the last admin
      if (targetUser.role_name === 'admin' && roleCheck.rows[0].name !== 'admin') {
        const adminCount = await getAdminCount(db);
        if (adminCount <= 1) {
          return next(new AuthError('Cannot demote the last admin user', 403));
        }
      }

      // Update role
      await updateUserRole(db, userId, roleId);

      // Fetch updated user
      const updatedUser = await getUserById(db, userId);

      logger.info('Admin updated user role', {
        adminId: req.user!.id,
        adminUsername: req.user!.username,
        targetUserId: userId,
        targetUsername: updatedUser!.username,
        oldRoleName: targetUser.role_name,
        newRoleId: roleId,
      });

      res.json({
        success: true,
        data: updatedUser,
      } as ApiResponse<UserPublic>);
    } catch (error) {
      next(error);
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
  requirePermission('users:update'),
  async (req: AuthRequest, res: express.Response, next: NextFunction): Promise<void> => {
    try {
      const db = getDbFromRequest(req);

      const userId = parseStrictInt(req.params.id);

      // Validate user ID
      if (isNaN(userId)) {
        return next(new ValidationError('Invalid user ID'));
      }

      // Check if user exists
      const targetUser = await getUserById(db, userId);
      if (!targetUser) {
        return next(new NotFoundError('User not found'));
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
      next(error);
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
  requirePermission('users:delete'),
  async (req: AuthRequest, res: express.Response, next: NextFunction): Promise<void> => {
    try {
      const db = getDbFromRequest(req);

      const userId = parseStrictInt(req.params.id);

      // Validate user ID
      if (isNaN(userId)) {
        return next(new ValidationError('Invalid user ID'));
      }

      // Safety guard: Prevent self-deletion
      if (userId === req.user!.id) {
        return next(new AuthError('Cannot delete your own account', 403));
      }

      // Check if user exists and get their role
      const targetUser = await getUserById(db, userId);
      if (!targetUser) {
        return next(new NotFoundError('User not found'));
      }

      // Safety guard: Prevent deleting the last admin
      if (targetUser.role_name === 'admin') {
        const adminCount = await getAdminCount(db);
        if (adminCount <= 1) {
          return next(new AuthError('Cannot delete the last admin user', 403));
        }
      }

      // Delete user
      const deleted = await deleteUser(db, userId);

      if (!deleted) {
        return next(new NotFoundError('User not found'));
      }

      logger.info('Admin deleted user', {
        adminId: req.user!.id,
        adminUsername: req.user!.username,
        deletedUserId: userId,
        deletedUsername: targetUser.username,
        deletedUserRoleName: targetUser.role_name,
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
