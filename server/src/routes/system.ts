import express from 'express';
import type { DB } from '../db/client.js';
import {
  getAppliedMigrations,
  getPendingMigrations,
  getDatabaseStats,
} from '../db/system-queries.js';
import {
  getAppInfo,
  getServerHealth,
  getScraperStatus,
} from '../services/system-info.js';
import type { ApiResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { protectedLimiter } from '../middleware/rate-limit.js';

const router = express.Router();

/**
 * GET /api/system/info (admin only)
 * Returns complete system information including app, server, and database stats
 */
router.get('/info', protectedLimiter, requireAuth, requireAdmin, async (req, res) => {
  try {
    const db: DB = req.app.get('db');

    // Get app info (synchronous, no errors expected)
    const appInfo = getAppInfo();

    // Get server health (synchronous, no errors expected)
    const serverHealth = getServerHealth();

    // Get database stats (async, may throw)
    const databaseStats = await getDatabaseStats(db);

    const response: ApiResponse = {
      success: true,
      data: {
        app: appInfo,
        server: serverHealth,
        database: databaseStats,
      },
    };
    return res.json(response);
  } catch (error) {
    logger.error('Error fetching system info:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch system information',
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/system/migrations (admin only)
 * Returns applied and pending migrations
 */
router.get('/migrations', protectedLimiter, requireAuth, requireAdmin, async (req, res) => {
  try {
    const db: DB = req.app.get('db');

    // Get applied and pending migrations
    const applied = await getAppliedMigrations(db);
    const pending = await getPendingMigrations(db);

    const response: ApiResponse = {
      success: true,
      data: {
        applied,
        pending,
        total: applied.length + pending.length,
      },
    };
    return res.json(response);
  } catch (error) {
    logger.error('Error fetching migrations:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch migrations',
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/system/health (admin only)
 * Returns system health status with all checks
 */
router.get('/health', protectedLimiter, requireAuth, requireAdmin, async (req, res) => {
  try {
    const db: DB = req.app.get('db');

    // Get scraper status (async, may throw)
    const scraperStatus = await getScraperStatus(db);

    // Get server health (synchronous)
    const serverHealth = getServerHealth();

    // Check migrations status
    const pendingMigrations = await getPendingMigrations(db);
    const migrationsOk = pendingMigrations.length === 0;

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'error';
    if (migrationsOk) {
      status = 'healthy';
    } else {
      status = 'degraded';
    }

    const response: ApiResponse = {
      success: true,
      data: {
        status,
        checks: {
          database: true, // If we got here, DB is accessible
          migrations: migrationsOk,
        },
        scrapers: scraperStatus,
        uptime: serverHealth.uptime,
      },
    };
    return res.json(response);
  } catch (error) {
    logger.error('Error checking system health:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to check system health',
    };
    return res.status(500).json(response);
  }
});

export default router;
