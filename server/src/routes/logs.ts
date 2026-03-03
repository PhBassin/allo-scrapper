import { Router, type Request, type Response } from 'express';
import { logger } from '../utils/logger.js';

const router = Router();

type AllowedLevel = 'error' | 'warn';
const ALLOWED_LEVELS: ReadonlySet<string> = new Set<AllowedLevel>(['error', 'warn']);

interface ClientLogPayload {
  level: AllowedLevel;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * POST /api/logs
 *
 * Accepts client-side log events (error / warn) and re-logs them via the
 * server-side Winston logger so they flow into Loki → Grafana alongside
 * backend logs.
 *
 * Only ERROR and WARN levels are forwarded — DEBUG and INFO would be too
 * noisy and are silently discarded by the client logger before reaching
 * this endpoint.
 *
 * Body:
 *   { level: 'error' | 'warn', message: string, context?: object }
 *
 * Responses:
 *   204 — accepted and logged
 *   400 — validation failure
 */
router.post('/', (req: Request, res: Response): void => {
  const { level, message, context } = req.body as Partial<ClientLogPayload>;

  if (!level || typeof level !== 'string' || !ALLOWED_LEVELS.has(level)) {
    res.status(400).json({
      success: false,
      error: 'Invalid or missing "level". Accepted values: "error", "warn".',
    });
    return;
  }

  if (!message || typeof message !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Invalid or missing "message". Must be a non-empty string.',
    });
    return;
  }

  const meta: Record<string, unknown> = { source: 'client' };
  if (context !== undefined) {
    meta.context = context;
  }

  logger[level](message, meta);

  res.status(204).end();
});

export default router;
