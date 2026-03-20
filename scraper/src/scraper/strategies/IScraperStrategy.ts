import { type DB } from '../../db/client.js';
import { type Cinema, type CinemaConfig } from '../../types/scraper.js';
import { type ProgressPublisher } from '../index.js';

export interface IScraperStrategy {
  readonly sourceName: string; // e.g., 'allocine'
  
  // URL matching and manipulation
  canHandleUrl(url: string): boolean;
  extractCinemaId(url: string): string | null;
  cleanCinemaUrl(url: string): string;

  // Core scraping actions
  loadTheaterMetadata(db: DB, cinema: CinemaConfig): Promise<{ availableDates: string[]; cinema: Cinema }>;
  scrapeTheater(
    db: DB,
    cinema: CinemaConfig,
    date: string,
    movieDelayMs: number,
    progress?: ProgressPublisher,
    processedFilmIds?: Set<number>
  ): Promise<{ filmsCount: number; showtimesCount: number }>;
}
