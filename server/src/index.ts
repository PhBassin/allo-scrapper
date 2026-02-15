import dotenv from 'dotenv';
import { createApp } from './app.js';
import { initializeDatabase } from './db/schema.js';
import { cronService } from './services/cron.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    console.log('🚀 Starting Allo-Scrapper Server...\n');

    // Initialize database
    console.log('📦 Initializing database...');
    await initializeDatabase();

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📍 API available at http://localhost:${PORT}/api`);
      console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    });

    // Start cron job for scheduled scraping
    cronService.start();

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n⏹️  Shutting down gracefully...');
      
      // Stop cron job
      cronService.stop();
      
      // Close server
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
