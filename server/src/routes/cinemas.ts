import express from 'express';
import { db } from '../db/client.js';
import { getCinemas, getShowtimesByCinemaAndWeek, addCinema, updateCinemaConfig, deleteCinema } from '../db/queries.js';
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

// POST /api/cinemas - Add a new cinema
router.post('/', async (req, res) => {
  try {
    const { id, name, url } = req.body;

    if (!id || !name || !url) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing required fields: id, name, url',
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
    console.error('Error adding cinema:', error);

    if (error instanceof Error && error.message.includes('duplicate key')) {
      const response: ApiResponse = {
        success: false,
        error: `Cinema with this ID already exists`,
      };
      return res.status(409).json(response);
    }

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add cinema',
    };
    return res.status(500).json(response);
  }
});

// PUT /api/cinemas/:id - Update a cinema's name and/or URL
router.put('/:id', async (req, res) => {
  try {
    const cinemaId = req.params.id;
    const { name, url } = req.body;

    if (!name && !url) {
      const response: ApiResponse = {
        success: false,
        error: 'At least one field must be provided: name, url',
      };
      return res.status(400).json(response);
    }

    const updates: { name?: string; url?: string } = {};
    if (name) updates.name = name;
    if (url) updates.url = url;

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
    console.error('Error updating cinema:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update cinema',
    };
    return res.status(500).json(response);
  }
});

// DELETE /api/cinemas/:id - Delete a cinema (cascades to showtimes and weekly_programs)
router.delete('/:id', async (req, res) => {
  try {
    const cinemaId = req.params.id;
    const deleted = await deleteCinema(db, cinemaId);

    if (!deleted) {
      const response: ApiResponse = {
        success: false,
        error: `Cinema ${cinemaId} not found`,
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = { success: true };
    return res.status(204).json(response);
  } catch (error) {
    console.error('Error deleting cinema:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete cinema',
    };
    return res.status(500).json(response);
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
