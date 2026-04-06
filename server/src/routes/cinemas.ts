import express from 'express';
import { CinemaService } from '../services/cinema-service.js';
import { getWeekStart } from '../utils/date.js';
import type { ApiResponse } from '../types/api.js';
import { publicLimiter, protectedLimiter } from '../middleware/rate-limit.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { getDbFromRequest } from '../utils/db-from-request.js';

const router = express.Router();

// GET /api/cinemas - Get all cinemas
router.get('/', publicLimiter, async (req, res, next) => {
  try {
    const db = getDbFromRequest(req);
    const cinemaService = new CinemaService(db);
    const cinemas = await cinemaService.getAllCinemas();

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
    const db = getDbFromRequest(req);
    const cinemaService = new CinemaService(db);
    const { id, name, url } = req.body;

    // Smart add via URL only
    if (url && !id && !name) {
      try {
        const cinema = await cinemaService.addCinemaViaUrl(url);
        const response: ApiResponse = {
          success: true,
          data: cinema,
        };
        return res.status(201).json(response);
      } catch (error: any) {
        return next(new ValidationError(error.message));
      }
    }

    if (!id || !name || !url) {
      return next(new ValidationError('Missing required fields: id, name, url'));
    }

    try {
      const cinema = await cinemaService.addCinemaManual(id, name, url);
      const response: ApiResponse = {
        success: true,
        data: cinema,
      };
      return res.status(201).json(response);
    } catch (error: any) {
      if (
        error.message.includes('Invalid') || 
        error.message.includes('too long') || 
        error.message.includes('Missing') ||
        error.message.includes('Name must be a string between') ||
        error.message.includes('already exists')
      ) {
        return next(new ValidationError(error.message));
      }
      return next(error);
    }
  } catch (error) {
    return next(error);
  }
});

// PUT /api/cinemas/:id - Update a cinema's configuration
router.put('/:id', protectedLimiter, requireAuth, requirePermission('cinemas:update'), async (req, res, next) => {
  try {
    const db = getDbFromRequest(req);
    const cinemaService = new CinemaService(db);
    const cinemaId = req.params.id as string;
    
    try {
      const cinema = await cinemaService.updateCinema(cinemaId, req.body);
      const response: ApiResponse = {
        success: true,
        data: cinema,
      };
      return res.json(response);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return next(new NotFoundError(error.message));
      }
      return next(new ValidationError(error.message));
    }
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/cinemas/:id - Delete a cinema (cascades to showtimes and weekly_programs)
router.delete('/:id', protectedLimiter, requireAuth, requirePermission('cinemas:delete'), async (req, res, next) => {
  try {
    const db = getDbFromRequest(req);
    const cinemaService = new CinemaService(db);
    const cinemaId = req.params.id as string;
    
    try {
      await cinemaService.deleteCinema(cinemaId);
      return res.status(204).send();
    } catch (error: any) {
      return next(new NotFoundError(error.message));
    }
  } catch (error) {
    return next(error);
  }
});

// GET /api/cinemas/:id - Get cinema schedule
router.get('/:id', publicLimiter, async (req, res, next) => {
  try {
    const db = getDbFromRequest(req);
    const cinemaService = new CinemaService(db);
    const cinemaId = req.params.id as string;
    const weekStart = getWeekStart();

    const showtimes = await cinemaService.getCinemaShowtimes(cinemaId, weekStart);

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
