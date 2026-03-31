import dotenv from 'dotenv';
import { createApp, type AppPlugin } from './app.js';
import { db } from './db/client.js';
import { initializeDatabase } from './db/schema.js';
import { logger } from './utils/logger.js';
import { validateJWTSecret } from './utils/jwt-secret-validator.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    logger.info('🚀 Starting Allo-Scrapper Server...\n');

    // Validate JWT secret before proceeding
    logger.info('🔐 Validating JWT configuration...');
    validateJWTSecret();
    
    // Log JWT configuration
    const jwtExpiration = process.env.JWT_EXPIRES_IN || '24h';
    logger.info(`🔐 JWT expiration set to: ${jwtExpiration}`);

    // Load plugins (SaaS overlay loaded only when SAAS_ENABLED=true)
    const plugins: AppPlugin[] = [];
    if (process.env.SAAS_ENABLED === 'true') {
      logger.info('🏢 SaaS mode enabled — loading SaaS plugin...');
      const { saasPlugin } = await import('@allo-scrapper/saas');
      plugins.push(saasPlugin);
      logger.info('✅ SaaS plugin loaded');
    }

    // Initialize database (including SaaS global migrations if plugin is loaded)
    logger.info('📦 Initializing database...');
    const extraMigrationDirs = plugins.flatMap(p => p.getMigrationDirs?.() ?? []);
    await initializeDatabase(extraMigrationDirs);
    await initializeDatabase();

    // Subscribe to Redis progress events and forward to SSE clients
    const { getRedisClient } = await import('./services/redis-client.js');
    const { progressTracker } = await import('./services/progress-tracker.js');

    const redisClient = getRedisClient();
    await redisClient.subscribeToProgress((event) => {
      progressTracker.emit(event);
    });

    logger.info('📡 Redis progress subscription active (scrape:progress)');

    // Create Express app
    const app = createApp(plugins);

    // Register database connection for dependency injection
    app.set('db', db);

    // Register pool for tenant middleware (dedicated clients with SET search_path)
    const { pool } = await import('./db/client.js');
    app.set('pool', pool);

    // Start server
    const server = app.listen(Number(PORT), () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`📍 API available at http://localhost:${PORT}/api`);
      logger.info(`📍 Health check: http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('\n⏹️  Shutting down gracefully...');

      // Disconnect Redis
      const { getRedisClient: getClient } = await import('./services/redis-client.js');
      await getClient().disconnect().catch(() => {});

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
    // Log only the error message to prevent sensitive data exposure
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to start server:', errorMessage);
    process.exit(1);
  }
}

// Start the server
startServer();
