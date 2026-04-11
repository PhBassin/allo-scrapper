import { createLogger } from '@allo-scrapper/logger';

/**
 * Structured JSON logger for the scraper microservice.
 */
export const logger = createLogger(`${process.env.APP_NAME ?? 'Allo-Scrapper'}-scraper`);
