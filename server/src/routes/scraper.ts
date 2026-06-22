import { parseStrictInt } from '../utils/number.js';
import express, { Response, NextFunction } from 'express';
import type { ApiResponse } from '../types/api.js';
import type { DB } from '../db/index.js';
import { requireAuth, isAdminUser, type AuthRequest } from '../middleware/auth.js';
import { scraperLimiter } from '../middleware/rate-limit.js';
import { ScraperService } from '../services/scraper-service.js';
import { AuthError, NotFoundError, ValidationError } from '../utils/errors.js';
import { getScrapeReport } from '../db/report-queries.js';
import { getPendingScrapeAttempts } from '../db/scrape-attempt-queries.js';
import type { PermissionName } from '../types/role.js';

/**
 * Scraper lifecycle routes: trigger / resume / status / progress.
 * Schedule CRUD lives in `routes/scraper-schedules.ts` and shares the same
 * `/api/scraper` mount prefix in `app.ts`.
 */
const router = express.Router();

/**
 * Build a {@link ScraperService} from the request's app-bound DB connection.
 * Every route in this file needs the same one-liner.
 */
function scraperServiceFromRequest(req: AuthRequest): ScraperService {
  const dbConn: DB = req.app.get('db');
  return new ScraperService(dbConn);
}

/**
 * Throw an AuthError if the request user is not an admin AND lacks the
 * required permission. Returns true when the check passes.
 */
function ensureScraperPermission(
  req: AuthRequest,
  permission: PermissionName
): boolean {
  if (isAdminUser(req.user)) return true;
  const userPermissions = new Set(req.user?.permissions || []);
  if (!userPermissions.has(permission)) {
    throw new AuthError('Permission denied', 403);
  }
  return true;
}

// POST /api/scraper/trigger - Start a manual scrape (delegates to Redis microservice)
router.post('/trigger', scraperLimiter, requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const scraperService = scraperServiceFromRequest(req);

    // Extract and validate theaterId and movieId from request body
    const { theaterId, movieId } = (req.body ?? {}) as { theaterId?: string; movieId?: number };

    // Permission check: scraper:trigger for all-theater scrape, scraper:trigger_single for single-theater
    // scraper:trigger is a superset (allows both all-theater and single-theater)
    const requiredPermission = theaterId ? 'scraper:trigger_single' : 'scraper:trigger';

    try {
      if (
        !ensureScraperPermission(req, requiredPermission) &&
        !ensureScraperPermission(req, 'scraper:trigger')
      ) {
        return next(new AuthError('Permission denied', 403));
      }
    } catch (err) {
      return next(err);
    }

    const { reportId, queueDepth } = await scraperService.triggerScrape({ theaterId, movieId });

    const response: ApiResponse = {
      success: true,
      data: {
        reportId,
        message: 'Scrape job queued for microservice',
        queueDepth,
      },
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/scraper/resume/:reportId - Resume a failed or rate-limited scrape
router.post('/resume/:reportId', scraperLimiter, requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const scraperService = scraperServiceFromRequest(req);
    const dbConn: DB = req.app.get('db');

    const reportId = parseStrictInt(req.params.reportId);

    if (isNaN(reportId)) {
      return next(new ValidationError('Invalid report ID'));
    }

    // Permission check: resuming requires scraper:trigger permission
    try {
      ensureScraperPermission(req, 'scraper:trigger');
    } catch (err) {
      return next(err);
    }

    // Get the parent report to verify it exists
    const parentReport = await getScrapeReport(dbConn, reportId);
    if (!parentReport) {
      return next(new NotFoundError('Report not found'));
    }

    // Get pending attempts (failed, rate_limited, or not_attempted)
    const pendingAttempts = await getPendingScrapeAttempts(dbConn, reportId);

    if (pendingAttempts.length === 0) {
      return next(new ValidationError('No pending attempts to resume'));
    }

    // Trigger a new scrape in resume mode
    const { reportId: newReportId, queueDepth } = await scraperService.triggerResume(
      reportId,
      pendingAttempts
    );

    const response: ApiResponse = {
      success: true,
      data: {
        reportId: newReportId,
        parentReportId: reportId,
        pendingAttempts: pendingAttempts.length,
        message: 'Resume job queued for microservice',
        queueDepth,
      },
    };
    res.json(response);
  } catch (error: any) {
    next(error);
  }
});

// GET /api/scraper/status - Get current scrape status
router.get('/status', scraperLimiter, requireAuth, async (req, res, next) => {
  try {
    const scraperService = scraperServiceFromRequest(req as AuthRequest);

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
router.get('/progress', scraperLimiter, (req, res, next) => {
  try {
    const scraperService = scraperServiceFromRequest(req as AuthRequest);

    const cleanup = scraperService.subscribeToProgress(res, () => {
      // Optional additional cleanup on route level if needed
    });

    req.on('close', cleanup);
  } catch (error) {
    next(error);
  }
});

export default router;