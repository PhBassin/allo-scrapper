import { Response, NextFunction } from 'express';
import type { DB } from '../db/client.js';
import type { ApiResponse } from '../types/api.js';
import type { AuthRequest } from './auth.js';
import { logger } from '../utils/logger.js';

/**
 * @deprecated Use requirePermission() from './permission.js' instead.
 * This middleware queries the old `role` TEXT column which no longer exists after migration 008.
 * Kept temporarily while references are migrated; will be removed in a future cleanup.
 *
 * Middleware to require admin role
 * Must be used after requireAuth middleware
 */
export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  // Check if user is authenticated
  if (!req.user) {
    const response: ApiResponse = {
      success: false,
      error: 'Authentication required',
    };
    return res.status(401).json(response);
  }

  try {
    // Get database connection
    const db: DB | undefined = req.app.get('db');
    if (!db) {
      logger.error('Database connection not found in app context');
      const response: ApiResponse = {
        success: false,
        error: 'Internal server error',
      };
      return res.status(500).json(response);
    }

    // Query user role from database
    const result = await db.query<{ id: number; username: string; role: string }>(
      'SELECT id, username, role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      logger.warn(`User not found in database: ${req.user.id}`);
      const response: ApiResponse = {
        success: false,
        error: 'Admin access required',
      };
      return res.status(403).json(response);
    }

    const user = result.rows[0];

    // Check if user has admin role
    if (user.role !== 'admin') {
      logger.warn(`Non-admin user attempted admin action: ${user.username} (role: ${user.role})`);
      const response: ApiResponse = {
        success: false,
        error: 'Admin access required',
      };
      return res.status(403).json(response);
    }

    // User is admin, proceed
    next();
  } catch (error) {
    logger.error('Error checking admin role:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
    };
    return res.status(500).json(response);
  }
}

// Re-export AuthRequest for convenience
export type { AuthRequest };
