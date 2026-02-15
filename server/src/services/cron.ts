import cron from 'node-cron';
import { scrapeManager } from './scrape-manager.js';

// Cron service for scheduled scraping
class CronService {
  private job?: cron.ScheduledTask;

  // Start the cron job
  start(): void {
    if (this.job) {
      console.log('⚠️  Cron job already running');
      return;
    }

    // Schedule: Every Wednesday at 8:00 AM Paris time
    // Cron format: minute hour dayOfMonth month dayOfWeek
    // 0 8 * * 3 = At 08:00 on Wednesday
    const schedule = process.env.SCRAPE_CRON_SCHEDULE || '0 8 * * 3';

    console.log(`⏰ Scheduling cron job: ${schedule} (Europe/Paris timezone)`);

    this.job = cron.schedule(
      schedule,
      async () => {
        console.log('⏰ Cron job triggered - starting scrape...');
        
        try {
          if (scrapeManager.isRunning()) {
            console.log('⚠️  Scrape already running, skipping cron trigger');
            return;
          }

          await scrapeManager.startScrape('cron');
        } catch (error) {
          console.error('❌ Error in cron job:', error);
        }
      },
      {
        scheduled: true,
        timezone: 'Europe/Paris',
      }
    );

    console.log('✅ Cron job started successfully');
  }

  // Stop the cron job
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = undefined;
      console.log('⏸️  Cron job stopped');
    }
  }

  // Check if running
  isRunning(): boolean {
    return this.job !== undefined;
  }
}

// Export singleton instance
export const cronService = new CronService();
