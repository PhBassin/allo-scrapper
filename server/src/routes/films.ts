import express from 'express';
import type { DB } from '../db/client.js';
import { FilmService } from '../services/film-service.js';
import { getWeekStart } from '../utils/date.js';
import type { ApiResponse } from '../types/api.js';
import { publicLimiter } from '../middleware/rate-limit.js';

const router = express.Router();

// GET /api/films - Get weekly films or films by date
router.get('/', publicLimiter, async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const filmService = new FilmService(db);
    const weekStart = getWeekStart();
    const dateParam = req.query.date as string | undefined;

    // Validate date format if provided
    if (dateParam) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateParam)) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        };
        return res.status(400).json(response);
      }
    }

    let filmsWithShowtimes;

    if (dateParam) {
      filmsWithShowtimes = await filmService.getFilmsForDate(dateParam, weekStart);
    } else {
      filmsWithShowtimes = await filmService.getFilmsForWeek(weekStart);
    }

    const response: ApiResponse = {
      success: true,
      data: { 
        films: filmsWithShowtimes, 
        weekStart,
        ...(dateParam && { date: dateParam })
      },
    };

    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

// GET /api/films/search - Search films with fuzzy matching
router.get('/search', publicLimiter, async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const filmService = new FilmService(db);
    const query = req.query.q as string | undefined;
    
    // Validate query parameter
    if (!query || query.trim().length < 2) {
      const response: ApiResponse = {
        success: false,
        error: 'Search query must be at least 2 characters',
      };
      return res.status(400).json(response);
    }
    
    const films = await filmService.search(query.trim(), 10);
    
    const response: ApiResponse = {
      success: true,
      data: { 
        films,
        query: query.trim()
      },
    };
    
    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

// GET /api/films/:id - Get film by ID
router.get('/:id', publicLimiter, async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
    const filmService = new FilmService(db);
    const filmId = parseInt(req.params.id as string);
    const weekStart = getWeekStart();

    if (isNaN(filmId)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid film ID',
      };
      return res.status(400).json(response);
    }

    const filmWithShowtimes = await filmService.getFilmById(filmId, weekStart);

    if (!filmWithShowtimes) {
      const response: ApiResponse = {
        success: false,
        error: 'Film not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: filmWithShowtimes,
    };

    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

export default router;
