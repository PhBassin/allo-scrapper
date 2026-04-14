import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Handle JSON syntax errors from express.json()
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON payload'
    });
  }

  if (err && (err instanceof AppError || ('statusCode' in err && typeof (err as any).statusCode === 'number'))) {
    const error = err as AppError;
    if (error.statusCode >= 500) {
      logger.error('App Error [5xx]', { error: error.message, stack: error.stack, details: error.details });
    } else {
      logger.warn(`App Error [${error.statusCode}]`, { error: error.message, details: error.details });
    }

    return res.status(error.statusCode).json({
      success: false,
      error: error.statusCode >= 500 && process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message,
      ...(error.details && { details: error.details })
    });
  }

  // Handle generic JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }

  logger.error('Unhandled System Error', { error: err.message, stack: err.stack });

  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};
