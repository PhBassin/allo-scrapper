import type { Request, NextFunction } from 'express';
import { parseStrictInt } from '../../utils/number.js';
import { ValidationError, NotFoundError, AuthError } from '../../utils/errors.js';
import { getScheduleById, type ScrapeSchedule } from '../../db/schedule-queries.js';
import type { DB } from '../../db/index.js';
import type { AuthRequest } from '../../middleware/auth.js';

/**
 * Parse the `:id` URL param as a positive integer, or fail the request with a
 * 400 ValidationError. Returns `null` when validation fails so callers can
 * short-circuit.
 */
function parseScheduleId(req: Request, next: NextFunction): number | null {
  const id = parseStrictInt(req.params.id);
  if (isNaN(id)) {
    next(new ValidationError('Invalid schedule ID'));
    return null;
  }
  return id;
}

/**
 * Fetch the schedule referenced by `req.params.id`, validating both the
 * param and the existence of the schedule. Returns the schedule on success
 * or `null` after failing the request.
 */
export async function loadSchedule(
  db: DB,
  req: Request,
  next: NextFunction
): Promise<ScrapeSchedule | null> {
  const id = parseScheduleId(req, next);
  if (id === null) return null;

  const schedule = await getScheduleById(db, id);
  if (!schedule) {
    next(new NotFoundError('Schedule not found'));
    return null;
  }
  return schedule;
}

/**
 * Return the authenticated user's id, or fail the request with 401 if not
 * authenticated. Returns `null` when not authenticated.
 */
export function requireUserId(req: AuthRequest, next: NextFunction): number | null {
  const userId = req.user?.id;
  if (!userId) {
    next(new AuthError('User not authenticated'));
    return null;
  }
  return userId;
}

/**
 * Translate a Postgres unique-violation (`23505`) into a friendly 400
 * ValidationError. Other errors are forwarded as-is via `next(error)`.
 */
export function handleUniqueConstraintError(
  error: any,
  next: NextFunction,
  message = 'Resource already exists'
): void {
  if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
    next(new ValidationError(message));
    return;
  }
  next(error);
}