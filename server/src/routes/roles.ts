import express from 'express';
import type { DB } from '../db/client.js';
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  getAllPermissions,
  setRolePermissions,
} from '../db/role-queries.js';
import type { ApiResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { protectedLimiter } from '../middleware/rate-limit.js';

const router = express.Router();

/**
 * GET /api/permissions
 * List all available permissions (requires roles:read)
 * Registered before /:id to avoid conflict
 */
router.get(
  '/permissions',
  protectedLimiter,
  requireAuth,
  requirePermission('roles:read'),
  async (req, res) => {
    try {
      const db: DB = req.app.get('db');
      const permissions = await getAllPermissions(db);
      const response: ApiResponse = { success: true, data: permissions };
      return res.json(response);
    } catch (error) {
      logger.error('Error fetching permissions:', error);
      const response: ApiResponse = { success: false, error: 'Failed to fetch permissions' };
      return res.status(500).json(response);
    }
  }
);

/**
 * GET /api/roles
 * List all roles with their permissions (requires roles:read)
 */
router.get(
  '/',
  protectedLimiter,
  requireAuth,
  requirePermission('roles:read'),
  async (req, res) => {
    try {
      const db: DB = req.app.get('db');
      const roles = await getAllRoles(db);
      const response: ApiResponse = { success: true, data: roles };
      return res.json(response);
    } catch (error) {
      logger.error('Error fetching roles:', error);
      const response: ApiResponse = { success: false, error: 'Failed to fetch roles' };
      return res.status(500).json(response);
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
  async (req, res) => {
    try {
      const db: DB = req.app.get('db');
      const roleId = parseInt(req.params.id as string, 10);

      if (isNaN(roleId)) {
        const response: ApiResponse = { success: false, error: 'Invalid role ID' };
        return res.status(400).json(response);
      }

      const role = await getRoleById(db, roleId);
      if (!role) {
        const response: ApiResponse = { success: false, error: 'Role not found' };
        return res.status(404).json(response);
      }

      const response: ApiResponse = { success: true, data: role };
      return res.json(response);
    } catch (error) {
      logger.error('Error fetching role:', error);
      const response: ApiResponse = { success: false, error: 'Failed to fetch role' };
      return res.status(500).json(response);
    }
  }
);

/**
 * POST /api/roles
 * Create a new role (requires users:create)
 */
router.post(
  '/',
  protectedLimiter,
  requireAuth,
  requirePermission('users:create'),
  async (req, res) => {
    try {
      const db: DB = req.app.get('db');
      const { name, description } = req.body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        const response: ApiResponse = { success: false, error: 'Role name is required' };
        return res.status(400).json(response);
      }

      const created = await createRole(db, { name: name.trim(), description });
      // Fetch with permissions
      const role = await getRoleById(db, created.id);

      logger.info('Role created', { roleId: created.id, name: created.name });

      const response: ApiResponse = { success: true, data: role };
      return res.status(201).json(response);
    } catch (error: any) {
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        const response: ApiResponse = { success: false, error: 'Role name already exists' };
        return res.status(409).json(response);
      }
      logger.error('Error creating role:', error);
      const response: ApiResponse = { success: false, error: 'Failed to create role' };
      return res.status(500).json(response);
    }
  }
);

/**
 * PUT /api/roles/:id
 * Update a role's name/description (requires users:update)
 */
router.put(
  '/:id',
  protectedLimiter,
  requireAuth,
  requirePermission('users:update'),
  async (req, res) => {
    try {
      const db: DB = req.app.get('db');
      const roleId = parseInt(req.params.id as string, 10);

      if (isNaN(roleId)) {
        const response: ApiResponse = { success: false, error: 'Invalid role ID' };
        return res.status(400).json(response);
      }

      const { name, description } = req.body;
      const updated = await updateRole(db, roleId, { name, description });

      if (!updated) {
        const response: ApiResponse = { success: false, error: 'Role not found' };
        return res.status(404).json(response);
      }

      const role = await getRoleById(db, roleId);
      const response: ApiResponse = { success: true, data: role };
      return res.json(response);
    } catch (error) {
      logger.error('Error updating role:', error);
      const response: ApiResponse = { success: false, error: 'Failed to update role' };
      return res.status(500).json(response);
    }
  }
);

/**
 * DELETE /api/roles/:id
 * Delete a role (requires users:delete)
 * - 403 if is_system=true
 * - 409 if users are assigned to this role
 */
router.delete(
  '/:id',
  protectedLimiter,
  requireAuth,
  requirePermission('users:delete'),
  async (req, res) => {
    try {
      const db: DB = req.app.get('db');
      const roleId = parseInt(req.params.id as string, 10);

      if (isNaN(roleId)) {
        const response: ApiResponse = { success: false, error: 'Invalid role ID' };
        return res.status(400).json(response);
      }

      const role = await getRoleById(db, roleId);
      if (!role) {
        const response: ApiResponse = { success: false, error: 'Role not found' };
        return res.status(404).json(response);
      }

      if (role.is_system) {
        const response: ApiResponse = { success: false, error: 'Cannot delete a system role' };
        return res.status(403).json(response);
      }

      // Check if any users have this role
      const userCountResult = await db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM users WHERE role_id = $1',
        [roleId]
      );
      const userCount = parseInt(userCountResult.rows[0]?.count ?? '0', 10);
      if (userCount > 0) {
        const response: ApiResponse = {
          success: false,
          error: `Role is assigned to ${userCount} user(s)`,
        };
        return res.status(409).json(response);
      }

      await db.query('DELETE FROM roles WHERE id = $1', [roleId]);

      logger.info('Role deleted', { roleId, name: role.name });

      return res.status(204).send();
    } catch (error) {
      logger.error('Error deleting role:', error);
      const response: ApiResponse = { success: false, error: 'Failed to delete role' };
      return res.status(500).json(response);
    }
  }
);

/**
 * PUT /api/roles/:id/permissions
 * Replace all permissions for a role (requires users:update)
 * Body: { permission_ids: number[] }
 */
router.put(
  '/:id/permissions',
  protectedLimiter,
  requireAuth,
  requirePermission('users:update'),
  async (req, res) => {
    try {
      const db: DB = req.app.get('db');
      const roleId = parseInt(req.params.id as string, 10);

      if (isNaN(roleId)) {
        const response: ApiResponse = { success: false, error: 'Invalid role ID' };
        return res.status(400).json(response);
      }

      const { permission_ids } = req.body;
      if (!Array.isArray(permission_ids)) {
        const response: ApiResponse = { success: false, error: 'permission_ids must be an array' };
        return res.status(400).json(response);
      }

      const role = await getRoleById(db, roleId);
      if (!role) {
        const response: ApiResponse = { success: false, error: 'Role not found' };
        return res.status(404).json(response);
      }

      await setRolePermissions(db, roleId, permission_ids);

      const updated = await getRoleById(db, roleId);
      const response: ApiResponse = { success: true, data: updated };
      return res.json(response);
    } catch (error) {
      logger.error('Error updating role permissions:', error);
      const response: ApiResponse = { success: false, error: 'Failed to update permissions' };
      return res.status(500).json(response);
    }
  }
);

export default router;
