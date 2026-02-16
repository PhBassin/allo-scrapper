import express from 'express';
import { db } from '../db/client.js';
import { getWeeklyFilms, getFilm, getShowtimesByFilmAndWeek, getWeeklyShowtimes } from '../db/queries.js';
import { getWeekStart } from '../utils/date.js';
import type { ApiResponse } from '../types/api.js';
import type { FilmWithShowtimes, CinemaWithShowtimes, Showtime, Cinema } from '../types/scraper.js';

const router = express.Router();

// Helper to group showtimes by cinema
function groupShowtimesByCinema(showtimes: Array<Showtime & { cinema: Cinema }>): CinemaWithShowtimes[] {
  const cinemaMap = new Map<string, CinemaWithShowtimes>();

  for (const s of showtimes) {
    if (!cinemaMap.has(s.cinema_id)) {
      cinemaMap.set(s.cinema_id, {
        ...s.cinema,
        showtimes: []
      });
    }
    const { cinema: _cinema, ...showtimeOnly } = s;
    cinemaMap.get(s.cinema_id)!.showtimes.push(showtimeOnly as Showtime);
  }

  return Array.from(cinemaMap.values());
}

// GET /api/films - Get weekly films
router.get('/', async (_req, res) => {
  try {
    const weekStart = getWeekStart();
    const films = await getWeeklyFilms(db, weekStart);
    const allShowtimes = await getWeeklyShowtimes(db, weekStart);

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
      data: { films: filmsWithShowtimes, weekStart },
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching films:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch films',
    };
    res.status(500).json(response);
  }
});

// GET /api/films/:id - Get film by ID
router.get('/:id', async (req, res) => {
  try {
    const filmId = parseInt(req.params.id);
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
    console.error('Error fetching film:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch film',
    };
    return res.status(500).json(response);
  }
});

export default router;
