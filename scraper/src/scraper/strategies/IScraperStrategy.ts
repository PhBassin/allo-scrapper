import { type DB } from '../../db/client.js';
import { type Theater, type TheaterConfig } from '../../types/scraper.js';
import { type ProgressPublisher } from '../index.js';

export interface IScraperStrategy {
  readonly sourceName: string; // e.g., 'allocine'
  
  // URL matching and manipulation
  canHandleUrl(url: string): boolean;
  extractTheaterId(url: string): string | null;
  cleanTheaterUrl(url: string): string;

  // Core scraping actions
  loadTheaterPageMetadata(db: DB, theater: TheaterConfig): Promise<{ availableDates: string[]; theater: Theater }>;
  scrapeTheaterPage(db: DB, theater: TheaterConfig, date: string, movieDelayMs: number, progress?: ProgressPublisher): Promise<{ moviesCount: number; showtimesCount: number }>;
}
