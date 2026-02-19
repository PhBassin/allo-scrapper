import { db } from '../db/client.js';
import {
  createScrapeReport,
  updateScrapeReport,
  getLatestScrapeReport,
  type ScrapeReport,
} from '../db/queries.js';
import { progressTracker } from './progress-tracker.js';
import { runScraper, type ScrapeOptions } from './scraper/index.js';

// Scrape session state
export interface ScrapeSession {
  reportId: number;
  triggerType: 'manual' | 'cron';
  startedAt: Date;
  status: 'running' | 'success' | 'partial_success' | 'failed';
}

// Scrape manager singleton
class ScrapeManager {
  private currentSession: ScrapeSession | null = null;

  // Check if a scrape is currently running
  isRunning(): boolean {
    return this.currentSession !== null;
  }

  // Get current session
  getCurrentSession(): ScrapeSession | null {
    return this.currentSession;
  }

  // Start a new scrape
  async startScrape(triggerType: 'manual' | 'cron', options?: ScrapeOptions): Promise<number> {
    if (this.currentSession) {
      throw new Error('A scrape is already in progress');
    }

    // Create a new report in the database
    const reportId = await createScrapeReport(db, triggerType);

    // Initialize session
    this.currentSession = {
      reportId,
      triggerType,
      startedAt: new Date(),
      status: 'running',
    };

    console.log(`🚀 Starting scrape (ID: ${reportId}, Trigger: ${triggerType})`);

    // Reset progress tracker
    progressTracker.reset();

    // Run the scrape asynchronously
    this.runScrapeAsync(reportId, options);

    return reportId;
  }

  // Run the scraper and handle completion
  private async runScrapeAsync(reportId: number, options?: ScrapeOptions): Promise<void> {
    const startTime = Date.now();

    try {
      // Run the scraper with progress tracking
      const summary = await runScraper(progressTracker, options);

      // Calculate duration
      const durationMs = Date.now() - startTime;
      summary.duration_ms = durationMs;

      // Determine final status
      let status: 'success' | 'partial_success' | 'failed';
      if (summary.failed_cinemas === 0) {
        status = 'success';
      } else if (summary.successful_cinemas > 0) {
        status = 'partial_success';
      } else {
        status = 'failed';
      }

      // Update report in database
      await updateScrapeReport(db, reportId, {
        completed_at: new Date().toISOString(),
        status,
        total_cinemas: summary.total_cinemas,
        successful_cinemas: summary.successful_cinemas,
        failed_cinemas: summary.failed_cinemas,
        total_films_scraped: summary.total_films,
        total_showtimes_scraped: summary.total_showtimes,
        errors: summary.errors,
        progress_log: progressTracker.getEvents(),
      });

      // Emit completion event
      progressTracker.emit({ type: 'completed', summary });

      console.log(`✅ Scrape completed (ID: ${reportId}, Status: ${status}, Duration: ${durationMs}ms)`);

      // Clear session
      if (this.currentSession?.reportId === reportId) {
        this.currentSession = null;
      }
    } catch (error) {
      console.error(`❌ Scrape failed (ID: ${reportId}):`, error);

      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update report with error
      await updateScrapeReport(db, reportId, {
        completed_at: new Date().toISOString(),
        status: 'failed',
        errors: [{ cinema_name: 'System', error: errorMessage }],
        progress_log: progressTracker.getEvents(),
      });

      // Emit failure event
      progressTracker.emit({ type: 'failed', error: errorMessage });

      // Clear session
      if (this.currentSession?.reportId === reportId) {
        this.currentSession = null;
      }
    }
  }

  // Get the latest scrape report from database
  async getLatestReport(): Promise<ScrapeReport | undefined> {
    return await getLatestScrapeReport(db);
  }
}

// Export singleton instance
export const scrapeManager = new ScrapeManager();
