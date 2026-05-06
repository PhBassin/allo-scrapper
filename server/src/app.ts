import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { Registry, collectDefaultMetrics } from 'prom-client';
import { createHash } from 'crypto';
import type { Pool } from 'pg';

import { getCorsOptions } from './utils/cors-config.js';
import { logger } from './utils/logger.js';
import { generalLimiter, healthCheckLimiter, protectedLimiter } from './middleware/rate-limit.js';
import { requireAuth, type AuthRequest } from './middleware/auth.js';
import { requirePermission } from './middleware/permission.js';
import { generateThemeCSS } from './services/theme-generator.js';
import { validateInputSize } from "./middleware/input-validation.js";
import { errorHandler } from './middleware/error-handler.js';
import type { DB } from './db/client.js';

// ---------------------------------------------------------------------------
// Plugin interface — allows SaaS (and other) overlays to extend the core app
// without modifying core code.
// ---------------------------------------------------------------------------

/**
 * Options passed to each plugin's register function.
 */
export interface AppPluginOptions {
  pool: Pool;
  db: DB;
}

/**
 * Plugin contract. Implement this interface in packages that extend the core
 * server (e.g. @allo-scrapper/saas).
 *
 * register() is called once at startup, after db/pool are attached to the app,
 * but before the server starts listening. It may be async.
 */
export interface AppPlugin {
  name: string;
  register(app: Express, options: AppPluginOptions): void | Promise<void>;
}

/**
 * Apply a list of plugins to an already-created Express app.
 * Plugins are called in order and awaited, so each plugin is fully
 * initialised before the next one starts.
 *
 * @param app     - The Express application instance
 * @param plugins - Array of plugins to apply (may be empty)
 * @param options - Pool + DB handles passed to each plugin
 */
export async function applyPlugins(
  app: Express,
  plugins: AppPlugin[],
  options: AppPluginOptions
): Promise<void> {
  for (const plugin of plugins) {
    logger.info(`Loading plugin: ${plugin.name}`);
    await plugin.register(app, options);
    logger.info(`Plugin loaded: ${plugin.name}`);
  }
}

// Import routes
import filmsRouter from './routes/films.js';
import cinemasRouter from './routes/cinemas.js';
import scraperRouter from './routes/scraper.js';
import reportsRouter from './routes/reports.js';
import authRouter from './routes/auth.js';
import settingsRouter from './routes/settings.js';
import usersRouter from './routes/users.js';
import systemRouter from './routes/system.js';
import rolesRouter from './routes/roles.js';
import rateLimitsRouter from './routes/admin/rate-limits.js';
import configRouter from './routes/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Prometheus registry for the backend
// ---------------------------------------------------------------------------
const serverRegistry = new Registry();
collectDefaultMetrics({ register: serverRegistry, prefix: 'ics_web_' });

function isTrustedDockerBridgeAddress(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) {
    return false;
  }

  const normalized = remoteAddress.replace(/^::ffff:/, '');
  const octets = normalized.split('.');
  if (octets.length === 4 && octets.every((segment) => /^\d+$/.test(segment))) {
    const first = Number(octets[0]);
    const second = Number(octets[1]);
    return first === 172 && second >= 16 && second <= 31;
  }

  return false;
}

export function isTrustedInternalMetricsScrape(req: Request): boolean {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim() !== '') {
    return false;
  }

  if (Array.isArray(forwardedFor) && forwardedFor.some((value) => value.trim() !== '')) {
    return false;
  }

  return isTrustedDockerBridgeAddress(req.socket.remoteAddress);
}

function requireMetricsAccess(req: Request, res: Response, next: NextFunction): void | Response {
  if (isTrustedInternalMetricsScrape(req)) {
    return next();
  }

  return requireAuth(req as AuthRequest, res, () =>
    requirePermission('system:health')(req as AuthRequest, res, next)
  );
}

function createAdminScraperAliasRouter() {
  const router = express.Router();
  const allowedPathPattern = /^\/dlq(?:\/[^/]+(?:\/retry)?)?\/?$/;

  router.use((req, res, next) => {
    if (!allowedPathPattern.test(req.path)) {
      return next();
    }

    return scraperRouter(req, res, next);
  });

  return router;
}

export function createApp() {
  const app = express();
  const adminScraperAliasRouter = createAdminScraperAliasRouter();

  // Trust the first proxy to ensure accurate IP resolution for rate limiting
  app.set('trust proxy', 1);

  // Middleware
  // Security: Helmet with strict CSP (no unsafe-inline/unsafe-eval in script-src)
  // Note: style-src keeps unsafe-inline for React inline styles in 3 components
  // (ScrapeProgress, ColorPicker, FontSelector use dynamic inline styles)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"], // Removed unsafe-inline and unsafe-eval
          styleSrc: ["'self'", "'unsafe-inline'"], // Keep for React inline styles
          styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "https://*.acsta.net", "https://*.allocine.fr"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
          objectSrc: ["'none'"], // Prevent Flash/Java applets
          baseUri: ["'self'"], // Prevent <base> tag injection
          formAction: ["'self'"], // Restrict form submissions
          frameAncestors: ["'none'"], // Prevent clickjacking (like X-Frame-Options)
          upgradeInsecureRequests: null,
        },
      },
    })
  );
  app.use(cors(getCorsOptions()));
  app.use(morgan('combined'));
  app.use(cookieParser());

  // CSRF protection for cookie-based auth: double-submit cookie pattern.
  // State-changing requests must include X-CSRF-Token header matching csrf_token cookie.
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (!req.path.startsWith('/api/')) return next(); // only protect API routes
    const cookieToken = req.cookies?.csrf_token;
    const headerToken = req.headers['x-csrf-token'];
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return res.status(403).json({ success: false, error: 'CSRF token missing or invalid' });
    }
    next();
  });

  // Additional security headers beyond Helmet defaults
  app.use((_req, res, next) => {
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    next();
  });

  app.use(validateInputSize());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ limit: '100kb', extended: true }));

  // Health check endpoint with database connectivity check
  // Cached for 5 seconds to prevent database connection pool exhaustion
  // Rate limited to 10 req/min per IP (localhost exempt for K8s/Docker probes)
  let cachedHealthStatus: {
    healthy: boolean;
    lastCheck: number;
  } = { healthy: true, lastCheck: 0 };
  
  const HEALTH_CACHE_TTL = 5000; // 5 seconds

  app.get('/api/health', healthCheckLimiter, async (req, res) => {
    const db: DB | undefined = req.app.get('db');
    
    // Fallback to simple health check if db is not available
    if (!db) {
      return res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        name: process.env.APP_NAME ?? 'Allo-Scrapper'
      });
    }

    try {
      const now = Date.now();
      
      // Use cached status if recent
      if (now - cachedHealthStatus.lastCheck < HEALTH_CACHE_TTL) {
        return res.status(cachedHealthStatus.healthy ? 200 : 503).json({
          status: cachedHealthStatus.healthy ? 'healthy' : 'unhealthy',
          database: cachedHealthStatus.healthy ? 'connected' : 'disconnected',
          timestamp: new Date().toISOString(),
          cached: true,
        });
      }

      // Perform actual health check
      await db.query('SELECT 1');
      cachedHealthStatus = { healthy: true, lastCheck: now };
      
      return res.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
        cached: false,
      });
    } catch (error) {
      cachedHealthStatus = { healthy: false, lastCheck: Date.now() };
      return res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
        cached: false,
      });
    }
  });

  // Rate limiting for all API routes except /api/health, which keeps its own
  // dedicated limiter so localhost probes can bypass generic /api quotas.
  app.use('/api', generalLimiter);

  // API routes
  app.use('/api/auth', authRouter);
  app.use('/api/films', filmsRouter);
  app.use('/api/cinemas', cinemasRouter);
  app.use('/api/scraper', scraperRouter);
  // Alias mount per Sprint Change Proposal 2026-04-26; canonical path remains /api/scraper/dlq
  app.use('/api/admin/scraper', adminScraperAliasRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/system', systemRouter);
  app.use('/api/roles', rolesRouter);
  app.use('/api/admin/rate-limits', rateLimitsRouter);
  app.use('/api/config', configRouter);

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
  app.get('/metrics', protectedLimiter, requireMetricsAccess, async (_req, res) => {
    try {
      res.set('Content-Type', serverRegistry.contentType);
      res.end(await serverRegistry.metrics());
    } catch (err) {
      logger.error('Error generating metrics', { error: err });
      res.status(500).end('Internal server error');
    }
  });

  return app;
}

/**
 * Register final catch-all handlers after plugins have registered their routes.
 * MUST be called after applyPlugins() to avoid catching plugin routes.
 */
export function registerFallbackHandlers(app: Express): void {
  // Error handler must be registered after plugins so plugin-route errors keep the
  // shared JSON API contract instead of falling through to Express' HTML handler.
  app.use(errorHandler);

  // 404 handler for API routes (must be AFTER plugin routes, BEFORE SPA fallback)
  app.use(/^\/api(?:\/(.*))?$/, (_req, res) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
    });
  });

  // Serve React static files in production
  if (process.env.NODE_ENV === 'production') {
    const publicPath = path.join(__dirname, '../public');
    app.use(express.static(publicPath));

    // Serve index.html for all non-API routes (SPA support)
    app.get(/^\/(.*)/, generalLimiter, (_req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }
}
