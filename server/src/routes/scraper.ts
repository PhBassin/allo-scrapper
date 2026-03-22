import express, { Response, NextFunction } from 'express';
import type { ApiResponse } from '../types/api.js';
import type { DB } from '../db/client.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { scraperLimiter } from '../middleware/rate-limit.js';
import { ScraperService } from '../services/scraper-service.js';
import { AuthError, NotFoundError } from '../utils/errors.js';

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

export default router;
