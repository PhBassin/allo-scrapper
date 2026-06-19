import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * Log the error with appropriate severity level.
 * - AppError 5xx → logger.error
 * - AppError 4xx → logger.warn
 * - JWT errors → silent (no log)
 * - Generic errors → logger.error
 */
function logError(err: Error): void {
  // JWT errors are handled silently
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return;
  }

  if (err instanceof AppError || ('statusCode' in err && typeof (err as any).statusCode === 'number')) {
    const error = err as AppError;
    if (error.statusCode >= 500) {
      logger.error('App Error [5xx]', { error: error.message, stack: error.stack, details: error.details });
    } else {
      logger.warn(`App Error [${error.statusCode}]`, { error: error.message, details: error.details });
    }
    return;
  }

  logger.error('Unhandled System Error', { error: err.message, stack: err.stack });
}

/**
 * Format the error into a { statusCode, body } response object.
 * In production, 5xx messages are sanitised to prevent information leakage.
 */
function formatErrorResponse(
  err: Error,
  isProd: boolean,
): { statusCode: number; body: object } {
  // AppError (or error with statusCode property)
  if (err instanceof AppError || ('statusCode' in err && typeof (err as any).statusCode === 'number')) {
    const error = err as AppError;
    const is5xx = error.statusCode >= 500;

    return {
      statusCode: error.statusCode,
      body: {
        success: false,
        error: isProd && is5xx ? 'Internal server error' : error.message,
        ...((!isProd || !is5xx) && error.details ? { details: error.details } : {}),
      },
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      body: { success: false, error: 'Invalid or expired token' },
    };
  }

  // Generic / unhandled error
  return {
    statusCode: 500,
    body: {
      success: false,
      error: isProd ? 'Internal server error' : err.message,
    },
  };
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  logError(err);

  const isProd = process.env.NODE_ENV === 'production';
  const { statusCode, body } = formatErrorResponse(err, isProd);

  return res.status(statusCode).json(body);
};
