import express from 'express';
import { db } from '../db/client.js';
import { getWeeklyFilms, getFilm } from '../db/queries.js';
import { getWeekStart } from '../utils/date.js';
import type { ApiResponse } from '../types/api.js';

const router = express.Router();

// GET /api/films - Get weekly films
router.get('/', async (_req, res) => {
  try {
    const weekStart = getWeekStart();
    const films = await getWeeklyFilms(db, weekStart);

    const response: ApiResponse = {
      success: true,
      data: { films, weekStart },
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

    if (isNaN(filmId)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid film ID',
      };
      return res.status(400).json(response);
    }

    const film = await getFilm(db, filmId);

    if (!film) {
      const response: ApiResponse = {
        success: false,
        error: 'Film not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: film,
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
