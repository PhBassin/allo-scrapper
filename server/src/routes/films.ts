import express from 'express';
import type { DB } from '../db/client.js';
import { getShowtimesByDate, getShowtimesByFilmAndWeek, getWeeklyShowtimes } from '../db/showtime-queries.js';
import { getWeeklyFilms, getFilmsByDate, getFilm, searchFilms } from '../db/film-queries.js';
import { getWeekStart } from '../utils/date.js';
import { groupShowtimesByCinema } from '../utils/showtimes.js';
import type { ApiResponse } from '../types/api.js';
import type { FilmWithShowtimes, Showtime, Cinema } from '../types/scraper.js';
import { publicLimiter } from '../middleware/rate-limit.js';

const router = express.Router();

// GET /api/films - Get weekly films or films by date
router.get('/', publicLimiter, async (req, res, next) => {
  try {
    const db: DB = req.app.get('db');
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

    let films;
    let allShowtimes;

    if (dateParam) {
      // Get films for specific date
      films = await getFilmsByDate(db, dateParam, weekStart);
      allShowtimes = await getShowtimesByDate(db, dateParam, weekStart);
    } else {
      // Get all films for the week
      films = await getWeeklyFilms(db, weekStart);
      allShowtimes = await getWeeklyShowtimes(db, weekStart);
    }

    // Group showtimes by film_id
    const showtimesByFilm = new Map<number, Array<Showtime & { cinema: Cinema }>>();
    for (const s of allShowtimes) {
      if (!showtimesByFilm.has(s.film_id)) {
        showtimesByFilm.set(s.film_id, []);
      }
      showtimesByFilm.get(s.film_id)!.push(s);
    }

    // Attach grouped showtimes to films
    const filmsWithShowtimes: FilmWithShowtimes[] = films.map(f => ({
      ...f,
      cinemas: groupShowtimesByCinema(showtimesByFilm.get(f.id) || [])
    }));

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
    const query = req.query.q as string | undefined;
    
    // Validate query parameter
    if (!query || query.trim().length < 2) {
      const response: ApiResponse = {
        success: false,
        error: 'Search query must be at least 2 characters',
      };
      return res.status(400).json(response);
    }
    
    const films = await searchFilms(db, query.trim(), 10);
    
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
    const filmId = parseInt(req.params.id as string);
    const weekStart = getWeekStart();

    if (isNaN(filmId)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid film ID',
      };
      return res.status(400).json(response);
    }

    const [film, showtimes] = await Promise.all([
      getFilm(db, filmId),
      getShowtimesByFilmAndWeek(db, filmId, weekStart)
    ]);

    if (!film) {
      const response: ApiResponse = {
        success: false,
        error: 'Film not found',
      };
      return res.status(404).json(response);
    }

    const filmWithShowtimes: FilmWithShowtimes = {
      ...film,
      cinemas: groupShowtimesByCinema(showtimes)
    };

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
