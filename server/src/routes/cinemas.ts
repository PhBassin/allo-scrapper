import express from 'express';
import type { DB } from '../db/client.js';
import { getShowtimesByCinemaAndWeek } from '../db/showtime-queries.js';
import { createScrapeReport } from '../db/report-queries.js';
import { getCinemas, addCinema, updateCinemaConfig, deleteCinema } from '../db/cinema-queries.js';
import { getWeekStart } from '../utils/date.js';
import { isValidAllocineUrl, extractCinemaIdFromUrl, cleanCinemaUrl } from '../utils/url.js';
import { getRedisClient } from '../services/redis-client.js';
import type { ApiResponse } from '../types/api.js';
import { publicLimiter, protectedLimiter } from '../middleware/rate-limit.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET /api/cinemas - Get all cinemas
router.get('/', publicLimiter, async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const cinemas = await getCinemas(db);

    const response: ApiResponse = {
      success: true,
      data: cinemas,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/cinemas - Add a new cinema
router.post('/', protectedLimiter, requireAuth, requirePermission('cinemas:create'), async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const { id, name, url } = req.body;

    // Smart add via URL only
    if (url && !id && !name) {
      if (url.length > 2048) {
        const response: ApiResponse = {
          success: false,
          error: 'URL is too long (max 2048 characters)',
        };
        return res.status(400).json(response);
      }

      if (!isValidAllocineUrl(url)) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid Allocine URL. Must be https://www.allocine.fr/...',
        };
        return res.status(400).json(response);
      }

      // Extract cinema ID and clean URL for DB insertion
      const cinemaId = extractCinemaIdFromUrl(url);
      if (!cinemaId) {
        const response: ApiResponse = {
          success: false,
          error: 'Could not extract cinema ID from URL. URL format should be like https://www.allocine.fr/seance/salle_gen_csalle=C0013.html',
        };
        return res.status(400).json(response);
      }

      const cleanedUrl = cleanCinemaUrl(url);

      // Insert cinema into DB with minimal info (scraper will enrich it)
      const cinema = await addCinema(db, { id: cinemaId, name: cinemaId, url: cleanedUrl });

      // Publish add_cinema job to Redis — scraper handles fetching metadata and showtimes
      const reportId = await createScrapeReport(db, 'manual');
      await getRedisClient().publishAddCinemaJob(reportId, cleanedUrl);
      logger.info(`🎬 add_cinema job queued for ${cleanedUrl} (reportId=${reportId})`);

      const response: ApiResponse = {
        success: true,
        data: cinema,
      };
      return res.status(201).json(response);
    }

    if (!id || !name || !url) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing required fields: id, name, url',
      };
      return res.status(400).json(response);
    }

    // Input validation
    if (typeof id !== 'string' || !/^[A-Za-z0-9]+$/.test(id)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid ID format. Must be alphanumeric string.',
      };
      return res.status(400).json(response);
    }

    if (id.length > 20) {
      const response: ApiResponse = {
        success: false,
        error: 'ID is too long (max 20 characters)',
      };
      return res.status(400).json(response);
    }

    if (typeof name !== 'string' || name.length > 100) {
      const response: ApiResponse = {
        success: false,
        error: 'Name must be a string between 1 and 100 characters',
      };
      return res.status(400).json(response);
    }

    if (typeof url !== 'string' || url.length > 2048) {
      const response: ApiResponse = {
        success: false,
        error: 'URL is too long (max 2048 characters)',
      };
      return res.status(400).json(response);
    }

    if (!isValidAllocineUrl(url)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid Allocine URL. Must be https://www.allocine.fr/...',
      };
      return res.status(400).json(response);
    }

    const cinema = await addCinema(db, { id, name, url });

    const response: ApiResponse = {
      success: true,
      data: cinema,
    };

    return res.status(201).json(response);
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate key')) {
      const response: ApiResponse = {
        success: false,
        error: `Cinema with this ID already exists`,
      };
      return res.status(409).json(response);
    }
    return next(error);
  }
});

// PUT /api/cinemas/:id - Update a cinema's configuration
router.put('/:id', protectedLimiter, requireAuth, requirePermission('cinemas:update'), async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const cinemaId = req.params.id as string;
    const { name, url, address, postal_code, city, screen_count } = req.body;

    // At least one field must be provided
    if (!name && !url && !address && postal_code === undefined && !city && screen_count === undefined) {
      const response: ApiResponse = {
        success: false,
        error: 'At least one field must be provided: name, url, address, postal_code, city, screen_count',
      };
      return res.status(400).json(response);
    }

    // Validate name
    if (name && (typeof name !== 'string' || name.length > 100)) {
      const response: ApiResponse = {
        success: false,
        error: 'Name must be a string between 1 and 100 characters',
      };
      return res.status(400).json(response);
    }

    // Validate url
    if (url && (typeof url !== 'string' || url.length > 2048)) {
      const response: ApiResponse = {
        success: false,
        error: 'URL is too long (max 2048 characters)',
      };
      return res.status(400).json(response);
    }

    if (url && !isValidAllocineUrl(url)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid Allocine URL. Must be https://www.allocine.fr/...',
      };
      return res.status(400).json(response);
    }

    // Validate address
    if (address !== undefined && (typeof address !== 'string' || address.length > 200)) {
      const response: ApiResponse = {
        success: false,
        error: 'Address must be at most 200 characters',
      };
      return res.status(400).json(response);
    }

    // Validate postal_code
    if (postal_code !== undefined) {
      if (typeof postal_code !== 'string' || postal_code.length > 10) {
        const response: ApiResponse = {
          success: false,
          error: 'Postal code must be at most 10 characters',
        };
        return res.status(400).json(response);
      }
      // Alphanumeric validation
      if (postal_code && !/^[a-zA-Z0-9]+$/.test(postal_code)) {
        const response: ApiResponse = {
          success: false,
          error: 'Postal code must be alphanumeric',
        };
        return res.status(400).json(response);
      }
    }

    // Validate city
    if (city !== undefined && (typeof city !== 'string' || city.length > 100)) {
      const response: ApiResponse = {
        success: false,
        error: 'City must be at most 100 characters',
      };
      return res.status(400).json(response);
    }

    // Validate screen_count
    if (screen_count !== undefined && screen_count !== null) {
      if (typeof screen_count !== 'number') {
        const response: ApiResponse = {
          success: false,
          error: 'Screen count must be a number',
        };
        return res.status(400).json(response);
      }
      if (!Number.isInteger(screen_count)) {
        const response: ApiResponse = {
          success: false,
          error: 'Screen count must be an integer',
        };
        return res.status(400).json(response);
      }
      if (screen_count < 1 || screen_count > 50) {
        const response: ApiResponse = {
          success: false,
          error: 'Screen count must be between 1 and 50',
        };
        return res.status(400).json(response);
      }
    }

    // Build updates object
    const updates: {
      name?: string;
      url?: string;
      address?: string;
      postal_code?: string;
      city?: string;
      screen_count?: number;
    } = {};

    if (name) updates.name = name;
    if (url) updates.url = url;
    if (address !== undefined) updates.address = address || undefined;
    if (postal_code !== undefined) updates.postal_code = postal_code || undefined;
    if (city !== undefined) updates.city = city || undefined;
    if (screen_count !== undefined) updates.screen_count = screen_count ?? undefined;

    const cinema = await updateCinemaConfig(db, cinemaId, updates);

    if (!cinema) {
      const response: ApiResponse = {
        success: false,
        error: `Cinema ${cinemaId} not found`,
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: cinema,
    };

    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/cinemas/:id - Delete a cinema (cascades to showtimes and weekly_programs)
router.delete('/:id', protectedLimiter, requireAuth, requirePermission('cinemas:delete'), async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const cinemaId = req.params.id as string;
    const deleted = await deleteCinema(db, cinemaId);

    if (!deleted) {
      const response: ApiResponse = {
        success: false,
        error: `Cinema ${cinemaId} not found`,
      };
      return res.status(404).json(response);
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

// GET /api/cinemas/:id - Get cinema schedule
router.get('/:id', publicLimiter, async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const cinemaId = req.params.id as string;
    const weekStart = getWeekStart();

    const showtimes = await getShowtimesByCinemaAndWeek(db, cinemaId, weekStart);

    const response: ApiResponse = {
      success: true,
      data: { showtimes, weekStart },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
