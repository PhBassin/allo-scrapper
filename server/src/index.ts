import dotenv from 'dotenv';
import { createApp } from './app.js';
import { db } from './db/client.js';
import { initializeDatabase } from './db/schema.js';
import { cronService } from './services/cron.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const USE_REDIS_SCRAPER = process.env.USE_REDIS_SCRAPER === 'true';

async function startServer() {
  try {
    logger.info('🚀 Starting Allo-Scrapper Server...\n');
    logger.info(`🔧 Scraper mode: ${USE_REDIS_SCRAPER ? 'Redis microservice' : 'Legacy in-process'}`);

    // Initialize database
    logger.info('📦 Initializing database...');
    await initializeDatabase();

    // If using Redis scraper, subscribe to progress events and forward to SSE
    if (USE_REDIS_SCRAPER) {
      const { getRedisClient } = await import('./services/redis-client.js');
      const { progressTracker } = await import('./services/progress-tracker.js');

      const redisClient = getRedisClient();
      await redisClient.subscribeToProgress((event) => {
        progressTracker.emit(event);
      });

      logger.info('📡 Redis progress subscription active (scrape:progress)');
    }

    // Create Express app
    const app = createApp();

    // Register database connection for dependency injection
    app.set('db', db);

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`📍 API available at http://localhost:${PORT}/api`);
      logger.info(`📍 Health check: http://localhost:${PORT}/api/health`);
    });

    // Start cron job for scheduled scraping (only in legacy mode)
    if (!USE_REDIS_SCRAPER) {
      cronService.start();
    } else {
      logger.info('⏭️  Legacy cron disabled (USE_REDIS_SCRAPER=true – cron runs in ics-scraper-cron container)');
    }

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('\n⏹️  Shutting down gracefully...');

      // Stop cron job (legacy mode only)
      if (!USE_REDIS_SCRAPER) {
        cronService.stop();
      }

      // Disconnect Redis if used
      if (USE_REDIS_SCRAPER) {
        const { getRedisClient } = await import('./services/redis-client.js');
        await getRedisClient().disconnect().catch(() => {});
      }

      // Close server
      server.close(() => {
        logger.info('✅ Server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
