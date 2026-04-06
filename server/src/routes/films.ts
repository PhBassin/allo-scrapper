import { parseStrictInt } from '../utils/number.js';
import express from 'express';
import { FilmService } from '../services/film-service.js';
import { getWeekStart } from '../utils/date.js';
import type { ApiResponse } from '../types/api.js';
import { publicLimiter } from '../middleware/rate-limit.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { getDbFromRequest } from '../utils/db-from-request.js';

const router = express.Router();

// GET /api/films - Get weekly films or films by date
router.get('/', publicLimiter, async (req, res, next) => {
  try {
    const db = getDbFromRequest(req);
    const filmService = new FilmService(db);
    const weekStart = getWeekStart();
    const dateParam = req.query.date as string | undefined;

    // Validate date format if provided
    if (dateParam) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateParam)) {
        return next(new ValidationError('Invalid date format. Use YYYY-MM-DD'));
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

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/films/search - Search films with fuzzy matching
router.get('/search', publicLimiter, async (req, res, next) => {
  try {
    const db = getDbFromRequest(req);
    const filmService = new FilmService(db);
    const query = req.query.q as string | undefined;
    
    // Validate query parameter
    if (!query || query.trim().length < 2 || query.trim().length > 100) {
      return next(new ValidationError('Search query must be between 2 and 100 characters'));
    }
    
    const films = await filmService.search(query.trim(), 10);
    
    const response: ApiResponse = {
      success: true,
      data: { 
        films,
        query: query.trim()
      },
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/films/:id - Get film by ID
router.get('/:id', publicLimiter, async (req, res, next) => {
  try {
    const db = getDbFromRequest(req);
    const filmService = new FilmService(db);
    const filmId = parseStrictInt(req.params.id);
    const weekStart = getWeekStart();

    if (isNaN(filmId)) {
      return next(new ValidationError('Invalid film ID'));
    }

    const filmWithShowtimes = await filmService.getFilmById(filmId, weekStart);

    if (!filmWithShowtimes) {
      return next(new NotFoundError('Film not found'));
    }

    const response: ApiResponse = {
      success: true,
      data: filmWithShowtimes,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
