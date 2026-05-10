import { parseStrictInt } from '../utils/number.js';
import express from 'express';
import { MovieService } from '../services/movie-service.js';
import { getWeekStart } from '../utils/date.js';
import type { ApiResponse } from '../types/api.js';
import { publicLimiter } from '../middleware/rate-limit.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { getDbFromRequest } from '../utils/db-from-request.js';

const router = express.Router();

// GET /api/movies - Get weekly movies or movies by date
router.get('/', publicLimiter, async (req, res, next) => {
  try {
    const db = getDbFromRequest(req);
    const movieService = new MovieService(db);
    const weekStart = getWeekStart();
    const dateParam = req.query.date as string | undefined;

    // Validate date format if provided
    if (dateParam) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateParam)) {
        return next(new ValidationError('Invalid date format. Use YYYY-MM-DD'));
      }
    }

    let moviesWithShowtimes;

    if (dateParam) {
      moviesWithShowtimes = await movieService.getMoviesForDate(dateParam, weekStart);
    } else {
      moviesWithShowtimes = await movieService.getMoviesForWeek(weekStart);
    }

    const response: ApiResponse = {
      success: true,
      data: { 
        movies: moviesWithShowtimes, 
        weekStart,
        ...(dateParam && { date: dateParam })
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/movies/search - Search movies with fuzzy matching
router.get('/search', publicLimiter, async (req, res, next) => {
  try {
    const db = getDbFromRequest(req);
    const movieService = new MovieService(db);
    const query = req.query.q as string | undefined;
    
    // Validate query parameter
    if (!query || query.trim().length < 2 || query.trim().length > 100) {
      return next(new ValidationError('Search query must be between 2 and 100 characters'));
    }
    
    const movies = await movieService.search(query.trim(), 10);
    
    const response: ApiResponse = {
      success: true,
      data: { 
        movies,
        query: query.trim()
      },
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/movies/:id - Get movie by ID
router.get('/:id', publicLimiter, async (req, res, next) => {
  try {
    const db = getDbFromRequest(req);
    const movieService = new MovieService(db);
    const movieId = parseStrictInt(req.params.id);
    const weekStart = getWeekStart();

    if (isNaN(movieId)) {
      return next(new ValidationError('Invalid movie ID'));
    }

    const movieWithShowtimes = await movieService.getMovieById(movieId, weekStart);

    if (!movieWithShowtimes) {
      return next(new NotFoundError('Movie not found'));
    }

    const response: ApiResponse = {
      success: true,
      data: movieWithShowtimes,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
