import express, { Response, NextFunction } from 'express';
import type { ApiResponse } from '../types/api.js';
import type { DB } from '../db/client.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { scraperLimiter, protectedLimiter } from '../middleware/rate-limit.js';
import { ScraperService } from '../services/scraper-service.js';
import { AuthError, NotFoundError, ValidationError } from '../utils/errors.js';
import {
  getAllSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  type ScrapeScheduleCreate,
  type ScrapeScheduleUpdate,
} from '../db/schedule-queries.js';

const router = express.Router();

// POST /api/scraper/trigger - Start a manual scrape (delegates to Redis microservice)
router.post('/trigger', scraperLimiter, requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const dbConn: DB = req.app.get('db');
  const scraperService = new ScraperService(dbConn);

  try {
    // Extract and validate cinemaId and filmId from request body
    const { cinemaId, filmId } = (req.body ?? {}) as { cinemaId?: string; filmId?: number };

    // Permission check: scraper:trigger for all-cinema scrape, scraper:trigger_single for single-cinema
    // scraper:trigger is a superset (allows both all-cinema and single-cinema)
    const requiredPermission = cinemaId ? 'scraper:trigger_single' : 'scraper:trigger';

    // Admin bypass
    if (!(req.user?.role_name === 'admin' && req.user?.is_system_role)) {
      const userPermissions = new Set(req.user?.permissions || []);
      
      // User needs the specific permission OR scraper:trigger (which grants both)
      if (!userPermissions.has(requiredPermission) && !userPermissions.has('scraper:trigger')) {
        return next(new AuthError('Permission denied', 403));
      }
    }

    const { reportId, queueDepth } = await scraperService.triggerScrape({ cinemaId, filmId });

    const response: ApiResponse = {
      success: true,
      data: {
        reportId,
        message: 'Scrape job queued for microservice',
        queueDepth,
      },
    };
    res.json(response);
  } catch (error: any) {
    if (error.message.startsWith('Cinema not found')) {
      return next(new NotFoundError(error.message));
    }
    next(error);
  }
});

// GET /api/scraper/status - Get current scrape status
router.get('/status', async (req, res, next) => {
  const dbConn: DB = req.app.get('db');
  const scraperService = new ScraperService(dbConn);

  try {
    const statusData = await scraperService.getStatus();

    const response: ApiResponse = {
      success: true,
      data: statusData,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/scraper/progress - SSE endpoint for real-time progress
router.get('/progress', (req, res, next) => {
  try {
    const dbConn: DB = req.app.get('db');
    const scraperService = new ScraperService(dbConn);
    
    const cleanup = scraperService.subscribeToProgress(res, () => {
      // Optional additional cleanup on route level if needed
    });

    req.on('close', cleanup);
  } catch (error) {
    next(error);
  }
});

// GET /api/scraper/schedules - List all schedules (requires scraper:schedules:list)
router.get(
  '/schedules',
  protectedLimiter,
  requireAuth,
  requirePermission('scraper:schedules:list'),
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

// GET /api/scraper/schedules/:id - Get single schedule (requires scraper:schedules:list)
router.get(
  '/schedules/:id',
  protectedLimiter,
  requireAuth,
  requirePermission('scraper:schedules:list'),
  async (req, res, next) => {
    try {
      const db: DB = req.app.get('db');
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id)) {
        return next(new ValidationError('Invalid schedule ID'));
      }

      const schedule = await getScheduleById(db, id);
      if (!schedule) {
        return next(new NotFoundError('Schedule not found'));
      }

      const response: ApiResponse = { success: true, data: schedule };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/scraper/schedules - Create schedule (requires scraper:schedules:create)
router.post(
  '/schedules',
  protectedLimiter,
  requireAuth,
  requirePermission('scraper:schedules:create'),
  async (req: AuthRequest, res, next) => {
    try {
      const db: DB = req.app.get('db');
      const userId = req.user?.id;

      if (!userId) {
        return next(new AuthError('User not authenticated'));
      }

      const { name, description, cron_expression, enabled, target_cinemas } = req.body as ScrapeScheduleCreate;

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
        target_cinemas,
      }, userId);

      const response: ApiResponse = { success: true, data: created };
      res.status(201).json(response);
    } catch (error: any) {
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        return next(new ValidationError('Schedule name already exists'));
      }
      next(error);
    }
  }
);

// PUT /api/scraper/schedules/:id - Update schedule (requires scraper:schedules:update)
router.put(
  '/schedules/:id',
  protectedLimiter,
  requireAuth,
  requirePermission('scraper:schedules:update'),
  async (req: AuthRequest, res, next) => {
    try {
      const db: DB = req.app.get('db');
      const userId = req.user?.id;

      if (!userId) {
        return next(new AuthError('User not authenticated'));
      }

      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        return next(new ValidationError('Invalid schedule ID'));
      }

      const existing = await getScheduleById(db, id);
      if (!existing) {
        return next(new NotFoundError('Schedule not found'));
      }

      const { name, description, cron_expression, enabled, target_cinemas } = req.body as ScrapeScheduleUpdate;

      const updated = await updateSchedule(db, id, {
        name,
        description,
        cron_expression,
        enabled,
        target_cinemas,
      }, userId);

      const response: ApiResponse = { success: true, data: updated };
      res.json(response);
    } catch (error: any) {
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        return next(new ValidationError('Schedule name already exists'));
      }
      next(error);
    }
  }
);

// DELETE /api/scraper/schedules/:id - Delete schedule (requires scraper:schedules:delete)
router.delete(
  '/schedules/:id',
  protectedLimiter,
  requireAuth,
  requirePermission('scraper:schedules:delete'),
  async (req, res, next) => {
    try {
      const db: DB = req.app.get('db');
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id)) {
        return next(new ValidationError('Invalid schedule ID'));
      }

      const existing = await getScheduleById(db, id);
      if (!existing) {
        return next(new NotFoundError('Schedule not found'));
      }

      await deleteSchedule(db, id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
