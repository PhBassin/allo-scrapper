import express from 'express';
import type { DB } from '../../db/client.js';
import {
  getRateLimits,
  updateRateLimits,
  resetRateLimits,
  getRateLimitAuditLog,
  getValidationConstraints,
} from '../../db/rate-limit-queries.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { protectedLimiter } from '../../middleware/rate-limit.js';
import { invalidateRateLimitCache } from '../../config/rate-limits.js';
import type { ApiResponse } from '../../types/api.js';
import { ValidationError } from '../../utils/errors.js';
import { parseStrictInt } from '../../utils/number.js';

const router = express.Router();

/**
 * GET /api/admin/rate-limits
 * Get current rate limit configuration
 */
router.get('/', protectedLimiter, requireAuth, requirePermission('ratelimits:read'), async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const rateLimits = await getRateLimits(db);

    const response: ApiResponse = {
      success: true,
      data: rateLimits,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/rate-limits
 * Update rate limit configuration
 */
router.put('/', protectedLimiter, requireAuth, requirePermission('ratelimits:update'), async (req: AuthRequest, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const updates = req.body;
    const user = req.user!;
    
    // Extract IP and User-Agent for audit
    const userIp = req.ip ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    // Validate updates against constraints
    const constraints = getValidationConstraints();
    for (const [field, value] of Object.entries(updates)) {
      if (typeof value !== 'number') {
        return next(new ValidationError(`${field} must be a number`));
      }
      
      const constraint = constraints[field as keyof typeof constraints];
      if (!constraint) {
        return next(new ValidationError(`Unknown field: ${field}`));
      }
      
      if (value < constraint.min || value > constraint.max) {
        return next(new ValidationError(
          `${field} must be between ${constraint.min} and ${constraint.max} ${constraint.unit}`
        ));
      }
    }

    const updated = await updateRateLimits(db, updates, user.id, user.username, user.role_name, userIp, userAgent);
    
    // Invalidate cache to force reload
    invalidateRateLimitCache();

    const response: ApiResponse = {
      success: true,
      data: {
        ...updated,
        message: 'Rate limits updated. Changes will take effect within 30 seconds.',
      },
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/rate-limits/reset
 * Reset rate limits to default values
 */
router.post('/reset', protectedLimiter, requireAuth, requirePermission('ratelimits:reset'), async (req: AuthRequest, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const user = req.user!;
    const userIp = req.ip ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    const reset = await resetRateLimits(db, user.id, user.username, user.role_name, userIp, userAgent);
    
    invalidateRateLimitCache();

    const response: ApiResponse = {
      success: true,
      data: {
        ...reset,
        message: 'Rate limits reset to default values',
      },
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/rate-limits/audit
 * Get audit log of rate limit changes
 */
router.get('/audit', protectedLimiter, requireAuth, requirePermission('ratelimits:audit'), async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const parsedLimit = parseStrictInt(req.query.limit);
    const limit = Math.min(isNaN(parsedLimit) ? 50 : parsedLimit, 200);
    const parsedOffset = parseStrictInt(req.query.offset);
    const offset = isNaN(parsedOffset) ? 0 : parsedOffset;
    const parsedUserId = parseStrictInt(req.query.userId);
    const userId = isNaN(parsedUserId) ? undefined : parsedUserId;

    const auditLog = await getRateLimitAuditLog(db, { limit, offset, userId });

    const response: ApiResponse = {
      success: true,
      data: auditLog,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/rate-limits/constraints
 * Get validation constraints for rate limit fields
 */
router.get('/constraints', protectedLimiter, requireAuth, requirePermission('ratelimits:read'), async (_req, res, next) => {
  try {
    const constraints = getValidationConstraints();

    const response: ApiResponse = {
      success: true,
      data: constraints,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
