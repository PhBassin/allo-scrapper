import express from 'express';
import type { DB } from '../db/index.js';
import { TheaterService } from '../services/theater-service.js';
import { getWeekStart } from '../utils/date.js';
import type { ApiResponse } from '../types/api.js';
import { publicLimiter, protectedLimiter } from '../middleware/rate-limit.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { ValidationError } from '../utils/errors.js';

const router = express.Router();

// GET /api/theaters - Get all theaters
router.get('/', publicLimiter, async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const theaterService = new TheaterService(db);
    const theaters = await theaterService.getAllTheaters();

    const response: ApiResponse = {
      success: true,
      data: theaters,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/theaters - Add a new theater
router.post('/', protectedLimiter, requireAuth, requirePermission('theaters:create'), async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const theaterService = new TheaterService(db);
    const { id, name, url } = req.body;

    // Smart add via URL only
    if (url && !id && !name) {
      try {
        const theater = await theaterService.addTheaterViaUrl(url);
        const response: ApiResponse = {
          success: true,
          data: theater,
        };
        return res.status(201).json(response);
      } catch (error) {
        return next(error);
      }
    }

    if (!id || !name || !url) {
      return next(new ValidationError('Missing required fields: id, name, url'));
    }

    try {
      const theater = await theaterService.addTheaterManual(id, name, url);
      const response: ApiResponse = {
        success: true,
        data: theater,
      };
      return res.status(201).json(response);
    } catch (error) {
      return next(error);
    }
  } catch (error) {
    return next(error);
  }
});

// PUT /api/theaters/:id - Update a theater's configuration
router.put('/:id', protectedLimiter, requireAuth, requirePermission('theaters:update'), async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const theaterService = new TheaterService(db);
    const theaterId = req.params.id as string;
    
    try {
      const theater = await theaterService.updateTheater(theaterId, req.body);
      const response: ApiResponse = {
        success: true,
        data: theater,
      };
      return res.json(response);
    } catch (error) {
      return next(error);
    }
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/theaters/:id - Delete a theater (cascades to showtimes and weekly_programs)
router.delete('/:id', protectedLimiter, requireAuth, requirePermission('theaters:delete'), async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const theaterService = new TheaterService(db);
    const theaterId = req.params.id as string;
    
    try {
      await theaterService.deleteTheater(theaterId);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  } catch (error) {
    return next(error);
  }
});

// GET /api/theaters/:id - Get theater schedule
router.get('/:id', publicLimiter, async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const theaterService = new TheaterService(db);
    const theaterId = req.params.id as string;
    const weekStart = getWeekStart();

    const showtimes = await theaterService.getTheaterShowtimes(theaterId, weekStart);

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
