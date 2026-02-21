import cron from 'node-cron';
import { scrapeManager } from './scrape-manager.js';
import { logger } from '../utils/logger.js';

// Cron service for scheduled scraping
class CronService {
  private job?: cron.ScheduledTask;

  // Start the cron job
  start(): void {
    if (this.job) {
      logger.info('⚠️  Cron job already running');
      return;
    }

    // Schedule: Every Wednesday at 8:00 AM Paris time
    // Cron format: minute hour dayOfMonth month dayOfWeek
    // 0 8 * * 3 = At 08:00 on Wednesday
    const schedule = process.env.SCRAPE_CRON_SCHEDULE || '0 8 * * 3';

    logger.info(`⏰ Scheduling cron job: ${schedule} (Europe/Paris timezone)`);

    this.job = cron.schedule(
      schedule,
      async () => {
        logger.info('⏰ Cron job triggered - starting scrape...');
        
        try {
          if (scrapeManager.isRunning()) {
            logger.info('⚠️  Scrape already running, skipping cron trigger');
            return;
          }

          // Automatic cron jobs always use 'weekly' mode with 7 days
          await scrapeManager.startScrape('cron', { mode: 'weekly', days: 7 });
        } catch (error) {
          logger.error('❌ Error in cron job:', error);
        }
      },
      {
        scheduled: true,
        timezone: 'Europe/Paris',
      }
    );

    logger.info('✅ Cron job started successfully');
  }

  // Stop the cron job
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = undefined;
      logger.info('⏸️  Cron job stopped');
    }
  }

  // Check if running
  isRunning(): boolean {
    return this.job !== undefined;
  }
}

// Export singleton instance
export const cronService = new CronService();
