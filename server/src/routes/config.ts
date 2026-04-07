import express from 'express';
import type { ApiResponse } from '../types/api.js';

const router = express.Router();

/**
 * GET /api/config
 * Returns public runtime configuration for the frontend.
 * No authentication required — safe to call before login.
 */
router.get('/', (_req, res) => {
  const saasEnabled = process.env.SAAS_ENABLED === 'true';
  const appName = process.env.APP_NAME ?? 'Allo-Scrapper';

  const response: ApiResponse = {
    success: true,
    data: {
      saasEnabled,
      appName,
    },
  };

  res.json(response);
});

export default router;
