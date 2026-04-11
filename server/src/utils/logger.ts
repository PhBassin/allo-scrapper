import { createLogger } from '@allo-scrapper/logger';

/**
 * Structured JSON logger for the Express API server.
 */
export const logger = createLogger(process.env.APP_NAME ?? 'Allo-Scrapper');
