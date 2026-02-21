import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { Registry, collectDefaultMetrics } from 'prom-client';

import { getCorsOptions } from './utils/cors-config.js';
import { logger } from './utils/logger.js';

// Import routes
import filmsRouter from './routes/films.js';
import cinemasRouter from './routes/cinemas.js';
import scraperRouter from './routes/scraper.js';
import reportsRouter from './routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Prometheus registry for the backend
// ---------------------------------------------------------------------------
const serverRegistry = new Registry();
collectDefaultMetrics({ register: serverRegistry, prefix: 'ics_web_' });

export function createApp() {
  const app = express();

  // Middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https://*.acsta.net", "https://*.allocine.fr"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "data:"],
          upgradeInsecureRequests: null,
        },
      },
    })
  );
  app.use(cors(getCorsOptions()));
  app.use(morgan('combined'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API routes
  app.use('/api/films', filmsRouter);
  app.use('/api/cinemas', cinemasRouter);
  app.use('/api/scraper', scraperRouter);
  app.use('/api/reports', reportsRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Prometheus metrics endpoint
  app.get('/metrics', async (_req, res) => {
    try {
      res.set('Content-Type', serverRegistry.contentType);
      res.end(await serverRegistry.metrics());
    } catch (err) {
      res.status(500).end(String(err));
    }
  });

  // Serve React static files in production
  if (process.env.NODE_ENV === 'production') {
    const publicPath = path.join(__dirname, '../public');
    app.use(express.static(publicPath));

    // Serve index.html for all non-API routes (SPA support)
    app.get('*', (_req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }

  // 404 handler for API routes
  app.use('/api/*', (_req, res) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
    });
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
  });

  return app;
}
