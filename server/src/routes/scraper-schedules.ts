import express, { Response, NextFunction } from 'express';
import type { ApiResponse } from '../types/api.js';
import type { DB } from '../db/client.js';
import type { AuthRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { protectedLimiter } from '../middleware/rate-limit.js';
import { ScraperService } from '../services/scraper-service.js';
import { getRedisClient } from '../services/redis-client.js';
import { ValidationError } from '../utils/errors.js';
import {
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  type ScrapeSchedule,
  type ScrapeScheduleCreate,
  type ScrapeScheduleUpdate,
} from '../db/schedule-queries.js';
import {
  loadSchedule,
  requireUserId,
  handleUniqueConstraintError,
} from './_helpers/schedule-helpers.js';

const router = express.Router();

/**
 * Mounted at `/api/scraper` so its sub-paths (`/schedules`, `/schedules/:id`, …)
 * share the same prefix as the trigger/status routes in `routes/scraper.ts`.
 */

/**
 * Wrap a route handler that needs the DB + the loaded schedule so we don't
 * repeat the `try { loadSchedule } if (!schedule) return; }` boilerplate
 * across GET/DELETE/trigger.
 */
function withSchedule(
  db: DB,
  handler: (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
    schedule: ScrapeSchedule
  ) => void | Promise<void>
) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const schedule = await loadSchedule(db, req, next);
      if (!schedule) return;
      await handler(req, res, next, schedule);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Wrap a route handler that needs the authenticated user id.
 */
function withUser<T>(
  handler: (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
    userId: number
  ) => T | Promise<T>
) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req, next);
      if (!userId) return;
      await handler(req, res, next, userId);
    } catch (error) {
      next(error);
    }
  };
}

// GET /api/scraper/schedules - List all schedules
router.get(
  '/schedules',
  protectedLimiter,
  requireAuth,
  async (req, res, next) => {
    try {
      const db: DB = req.app.get('db');
      const schedules = await getAllSchedules(db);
      const response: ApiResponse = { success: true, data: schedules };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/scraper/schedules/:id - Get single schedule
router.get(
  '/schedules/:id',
  protectedLimiter,
  requireAuth,
  (req, res, next) => {
    const db: DB = req.app.get('db');
    withSchedule(db, (_req, res, _next, schedule) => {
      const response: ApiResponse = { success: true, data: schedule };
      res.json(response);
    })(req as AuthRequest, res, next);
  }
);

// POST /api/scraper/schedules - Create schedule
router.post(
  '/schedules',
  protectedLimiter,
  requireAuth,
  (req, res, next) => {
    withUser(async (req, res, _next, userId) => {
      const db: DB = req.app.get('db');
      const { name, description, cron_expression, enabled, target_theaters } = req.body as ScrapeScheduleCreate;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return next(new ValidationError('Schedule name is required'));
      }

      if (!cron_expression || typeof cron_expression !== 'string' || cron_expression.trim() === '') {
        return next(new ValidationError('Cron expression is required'));
      }

      const created = await createSchedule(db, {
        name: name.trim(),
        description,
        cron_expression: cron_expression.trim(),
        enabled,
        target_theaters,
      }, userId);

      await getRedisClient().publishScheduleChange({
        action: 'created',
        scheduleId: created.id,
        schedule: created,
      });

      const response: ApiResponse = { success: true, data: created };
      res.status(201).json(response);
    })(req as AuthRequest, res, next);
  }
);

// PUT /api/scraper/schedules/:id - Update schedule
router.put(
  '/schedules/:id',
  protectedLimiter,
  requireAuth,
  async (req, res, next) => {
    const db: DB = req.app.get('db');
    try {
      const userId = requireUserId(req, next);
      if (!userId) return;
      const schedule = await loadSchedule(db, req, next);
      if (!schedule) return;

      const { name, description, cron_expression, enabled, target_theaters } = req.body as ScrapeScheduleUpdate;

      const updated = await updateSchedule(db, schedule.id, {
        name,
        description,
        cron_expression,
        enabled,
        target_theaters,
      }, userId);

      await getRedisClient().publishScheduleChange({
        action: 'updated',
        scheduleId: schedule.id,
        schedule: updated ?? undefined,
      });

      const response: ApiResponse = { success: true, data: updated };
      res.json(response);
    } catch (error: any) {
      handleUniqueConstraintError(error, next, 'Schedule name already exists');
    }
  }
);

// DELETE /api/scraper/schedules/:id - Delete schedule
router.delete(
  '/schedules/:id',
  protectedLimiter,
  requireAuth,
  (req, res, next) => {
    const db: DB = req.app.get('db');
    withSchedule(db, async (_req, res, _next, schedule) => {
      await deleteSchedule(db, schedule.id);

      await getRedisClient().publishScheduleChange({
        action: 'deleted',
        scheduleId: schedule.id,
      });

      res.status(204).send();
    })(req as AuthRequest, res, next);
  }
);

// POST /api/scraper/schedules/:id/trigger - Trigger a schedule immediately
router.post(
  '/schedules/:id/trigger',
  protectedLimiter,
  requireAuth,
  (req, res, next) => {
    const db: DB = req.app.get('db');
    const scraperService = new ScraperService(db);
    withSchedule(db, async (_req, res, _next, schedule) => {
      const { reportId, queueDepth } = await scraperService.triggerScrape({
        theaterId: schedule.target_theaters?.[0],
      });

      const response: ApiResponse = {
        success: true,
        data: {
          reportId,
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          message: 'Schedule job queued for immediate execution',
          queueDepth,
        },
      };
      res.json(response);
    })(req as AuthRequest, res, next);
  }
);

export default router;