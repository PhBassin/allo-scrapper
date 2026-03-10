import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import type { ApiResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware factory — require one or more permissions.
 * Must be used AFTER requireAuth.
 *
 * Admin (is_system_role=true AND role_name='admin') bypasses all permission checks.
 *
 * Usage:
 *   router.post('/trigger', requireAuth, requirePermission('scraper:trigger'), handler)
 *   router.delete('/:id', requireAuth, requirePermission('cinemas:delete'), handler)
 */
export function requirePermission(...requiredPermissions: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response> => {
    if (!req.user) {
      const response: ApiResponse = { success: false, error: 'Authentication required' };
      return res.status(401).json(response);
    }

    // Admin bypass — system role with name 'admin' has all permissions
    if (req.user.role_name === 'admin' && req.user.is_system_role) {
      return next();
    }

    // Check each required permission is in user's permission list
    const userPermissions = new Set(req.user.permissions);
    const hasAll = requiredPermissions.every(p => userPermissions.has(p));

    if (!hasAll) {
      const missing = requiredPermissions.filter(p => !userPermissions.has(p));
      logger.warn('Permission denied', {
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role_name,
        required: requiredPermissions,
        missing,
      });
      const response: ApiResponse = { success: false, error: 'Permission denied' };
      return res.status(403).json(response);
    }

    return next();
  };
}
