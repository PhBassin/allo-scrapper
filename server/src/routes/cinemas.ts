import express from 'express';
import { db } from '../db/client.js';
import { getCinemas, getShowtimesByCinemaAndWeek } from '../db/queries.js';
import { getWeekStart } from '../utils/date.js';
import type { ApiResponse } from '../types/api.js';

const router = express.Router();

// GET /api/cinemas - Get all cinemas
router.get('/', async (_req, res) => {
  try {
    const cinemas = await getCinemas(db);

    const response: ApiResponse = {
      success: true,
      data: cinemas,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching cinemas:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch cinemas',
    };
    res.status(500).json(response);
  }
});

// GET /api/cinemas/:id - Get cinema schedule
router.get('/:id', async (req, res) => {
  try {
    const cinemaId = req.params.id;
    const weekStart = getWeekStart();

    const showtimes = await getShowtimesByCinemaAndWeek(db, cinemaId, weekStart);

    const response: ApiResponse = {
      success: true,
      data: { showtimes, weekStart },
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching cinema schedule:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch cinema schedule',
    };
    res.status(500).json(response);
  }
});

export default router;
