import winston from 'winston';

const { combine, timestamp, json, colorize, simple } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Creates a structured JSON logger.
 * - In production (NODE_ENV=production): outputs JSON (for Loki ingestion)
 * - In development: outputs colorized, human-readable text
 */
export function createLogger(serviceName: string, level?: string) {
  return winston.createLogger({
    level: level ?? process.env.LOG_LEVEL ?? 'info',
    defaultMeta: { service: serviceName },
    format: isProduction
      ? combine(timestamp(), json())
      : combine(colorize(), simple()),
    transports: [
      new winston.transports.Console(),
    ],
  });
}
