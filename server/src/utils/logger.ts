import winston from 'winston';

const { combine, timestamp, json, colorize, simple } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Structured JSON logger for the Express API server.
 * - In production (NODE_ENV=production): outputs JSON (for Loki ingestion)
 * - In development: outputs colorized, human-readable text
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  defaultMeta: { service: 'ics-web' },
  format: isProduction
    ? combine(timestamp(), json())
    : combine(colorize(), simple()),
  transports: [
    new winston.transports.Console(),
  ],
});
