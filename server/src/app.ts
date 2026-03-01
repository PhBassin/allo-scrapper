import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { Registry, collectDefaultMetrics } from 'prom-client';
import { createHash } from 'crypto';

import { getCorsOptions } from './utils/cors-config.js';
import { logger } from './utils/logger.js';
import { generalLimiter } from './middleware/rate-limit.js';
import { generateThemeCSS } from './services/theme-generator.js';

// Import routes
import filmsRouter from './routes/films.js';
import cinemasRouter from './routes/cinemas.js';
import scraperRouter from './routes/scraper.js';
import reportsRouter from './routes/reports.js';
import authRouter from './routes/auth.js';
import settingsRouter from './routes/settings.js';
import usersRouter from './routes/users.js';

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

  // Rate limiting for all API routes
  app.use('/api', generalLimiter);

  // API routes
  app.use('/api/auth', authRouter);
  app.use('/api/films', filmsRouter);
  app.use('/api/cinemas', cinemasRouter);
  app.use('/api/scraper', scraperRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/users', usersRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      name: process.env.APP_NAME ?? 'Allo-Scrapper'
    });
  });

  // Theme CSS endpoint (public, with ETag caching)
  app.get('/api/theme.css', async (req, res) => {
    try {
      const db = req.app.get('db');
      
      if (!db) {
        logger.error('Database connection not found in app context');
        res.set('Content-Type', 'text/css; charset=utf-8');
        return res.send(':root { --color-primary: #FECC00; --color-secondary: #1F2937; }');
      }
      
      const css = await generateThemeCSS(db);
      
      // Generate ETag from CSS content (MD5 hash)
      const etag = createHash('md5').update(css, 'utf8').digest('hex');
      
      // Check If-None-Match header for HTTP caching
      const clientEtag = req.headers['if-none-match'];
      if (clientEtag && clientEtag === etag) {
        // Client has latest version, return 304 Not Modified
        return res.status(304).end();
      }
      
      // Set caching headers
      res.set({
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'ETag': etag,
      });
      
      return res.send(css);
    } catch (err) {
      logger.error('Error serving theme CSS', { error: err });
      
      // Return minimal fallback CSS on error (don't fail hard)
      res.set('Content-Type', 'text/css; charset=utf-8');
      return res.send(':root { --color-primary: #FECC00; --color-secondary: #1F2937; }');
    }
  });

  // Prometheus metrics endpoint
  app.get('/metrics', async (_req, res) => {
    try {
      res.set('Content-Type', serverRegistry.contentType);
      res.end(await serverRegistry.metrics());
    } catch (err) {
      logger.error('Error generating metrics', { error: err });
      res.status(500).end('Internal server error');
    }
  });

  // Serve React static files in production
  if (process.env.NODE_ENV === 'production') {
    const publicPath = path.join(__dirname, '../public');
    app.use(express.static(publicPath));

    // Serve index.html for all non-API routes (SPA support)
    app.get('*', generalLimiter, (_req, res) => {
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
