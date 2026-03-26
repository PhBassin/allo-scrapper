import { parseStrictInt } from '../utils/number.js';
import express from 'express';
import type { DB } from '../db/client.js';
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  getAllPermissions,
  getAllPermissionCategoryLabels,
  setRolePermissions,
} from '../db/role-queries.js';
import type { ApiResponse } from '../types/api.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { protectedLimiter } from '../middleware/rate-limit.js';
import { ValidationError, NotFoundError, AuthError, AppError } from '../utils/errors.js';

const router = express.Router();

/**
 * GET /api/permissions
 * List all available permissions (requires roles:list)
 * Registered before /:id to avoid conflict
 */
router.get(
  '/permissions',
  protectedLimiter,
  requireAuth,
  requirePermission('roles:list'),
  async (req, res, next) => {
    try {
      const db: DB = req.app.get('db');
      const permissions = await getAllPermissions(db);
      const response: ApiResponse = { success: true, data: permissions };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/roles/permission-categories
 * List all permission category labels (requires roles:list)
 * Returns categories with English and French display names
 * Registered before /:id to avoid conflict
 */
router.get(
  '/permission-categories',
  protectedLimiter,
  requireAuth,
  requirePermission('roles:list'),
  async (req, res, next) => {
    try {
      const db: DB = req.app.get('db');
      const categories = await getAllPermissionCategoryLabels(db);
      const response: ApiResponse = { success: true, data: categories };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/roles
 * List all roles with their permissions (requires roles:list)
 */
router.get(
  '/',
  protectedLimiter,
  requireAuth,
  requirePermission('roles:list'),
  async (req, res, next) => {
    try {
      const db: DB = req.app.get('db');
      const roles = await getAllRoles(db);
      const response: ApiResponse = { success: true, data: roles };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/roles/:id
 * Get a specific role with its permissions (requires roles:read)
 */
router.get(
  '/:id',
  protectedLimiter,
  requireAuth,
  requirePermission('roles:read'),
  async (req, res, next) => {
    try {
      const db: DB = req.app.get('db');
      const roleId = parseStrictInt(req.params.id);

      if (isNaN(roleId)) {
        return next(new ValidationError('Invalid role ID'));
      }

      const role = await getRoleById(db, roleId);
      if (!role) {
        return next(new NotFoundError('Role not found'));
      }

      const response: ApiResponse = { success: true, data: role };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/roles
 * Create a new role (requires roles:create)
 */
router.post(
  '/',
  protectedLimiter,
  requireAuth,
  requirePermission('roles:create'),
  async (req, res, next) => {
    try {
      const db: DB = req.app.get('db');
      const { name, description } = req.body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return next(new ValidationError('Role name is required'));
      }

      const created = await createRole(db, { name: name.trim(), description });
      // Fetch with permissions
      const role = await getRoleById(db, created.id);

      const response: ApiResponse = { success: true, data: role };
      res.status(201).json(response);
    } catch (error: any) {
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        return next(new ValidationError('Role name already exists'));
      }
      next(error);
    }
  }
);

/**
 * PUT /api/roles/:id
 * Update a role's name/description (requires roles:update)
 */
router.put(
  '/:id',
  protectedLimiter,
  requireAuth,
  requirePermission('roles:update'),
  async (req, res, next) => {
    try {
      const db: DB = req.app.get('db');
      const roleId = parseStrictInt(req.params.id);

      if (isNaN(roleId)) {
        return next(new ValidationError('Invalid role ID'));
      }

      const { name, description } = req.body;
      const updated = await updateRole(db, roleId, { name, description });

      if (!updated) {
        return next(new NotFoundError('Role not found'));
      }

      const role = await getRoleById(db, roleId);
      const response: ApiResponse = { success: true, data: role };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/roles/:id
 * Delete a role (requires roles:delete)
 * - 403 if is_system=true
 * - 409 if users are assigned to this role
 */
router.delete(
  '/:id',
  protectedLimiter,
  requireAuth,
  requirePermission('roles:delete'),
  async (req, res, next) => {
    try {
      const db: DB = req.app.get('db');
      const roleId = parseStrictInt(req.params.id);

      if (isNaN(roleId)) {
        return next(new ValidationError('Invalid role ID'));
      }

      const role = await getRoleById(db, roleId);
      if (!role) {
        return next(new NotFoundError('Role not found'));
      }

      if (role.is_system) {
        return next(new AuthError('Cannot delete a system role', 403));
      }

      // Check if any users have this role
      const userCountResult = await db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM users WHERE role_id = $1',
        [roleId]
      );
      const userCount = parseStrictInt(userCountResult.rows[0]?.count ?? '0');
      if (userCount > 0) {
        return next(new AppError(`Role is assigned to ${userCount} user(s)`, 409));
      }

      await db.query('DELETE FROM roles WHERE id = $1', [roleId]);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/roles/:id/permissions
 * Replace all permissions for a role (requires roles:update)
 * Body: { permission_ids: number[] }
 */
router.put(
  '/:id/permissions',
  protectedLimiter,
  requireAuth,
  requirePermission('roles:update'),
  async (req, res, next) => {
    try {
      const db: DB = req.app.get('db');
      const roleId = parseStrictInt(req.params.id);

      if (isNaN(roleId)) {
        return next(new ValidationError('Invalid role ID'));
      }

      const { permission_ids } = req.body;
      if (!Array.isArray(permission_ids)) {
        return next(new ValidationError('permission_ids must be an array'));
      }

      const role = await getRoleById(db, roleId);
      if (!role) {
        return next(new NotFoundError('Role not found'));
      }

      await setRolePermissions(db, roleId, permission_ids);

      const updated = await getRoleById(db, roleId);
      const response: ApiResponse = { success: true, data: updated };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
