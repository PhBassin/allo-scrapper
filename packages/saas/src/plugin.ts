/**
 * SaaS overlay plugin.
 * Activated when SAAS_ENABLED=true in the environment.
 *
 * Implements the AppPlugin interface from server/src/app.ts.
 * register() is called once at startup by applyPlugins().
 */
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import path from 'path';
import type { Express } from 'express';
import { createRegisterRouter } from './routes/register.js';
import { createOrgRouter } from './routes/org.js';
import { createOnboardingRouter } from './routes/onboarding.js';
import { createSuperadminRouter } from './routes/superadmin.js';
import { createTestFixturesNotFoundRouter, createTestFixturesRouter } from './routes/test-fixtures.js';
import { createOrgMetricsMiddleware, getOrgRegistry } from './middleware/org-metrics.js';
import { startQuotaResetScheduler } from './quota-reset-scheduler.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Minimal re-declaration of AppPlugin to avoid cross-rootDir imports at
 * compile time. At runtime this module executes inside the server process
 * where the real interface is available.
 */
interface AppPlugin {
  name: string;
  register(app: Express, options: { pool: unknown; db: unknown }): void | Promise<void>;
}

function isFixtureRuntimeEnabled(): boolean {
  return process.env['NODE_ENV'] === 'test' || process.env['E2E_ENABLE_ORG_FIXTURE'] === 'true';
}

export const saasPlugin: AppPlugin = {
  name: '@allo-scrapper/saas',

  async register(app, options) {
    // Self-bootstrap: run SaaS-specific DB migrations before mounting routes.
    // The dynamic import resolves at runtime inside the server process.
    // @ts-ignore — cross-rootDir import is intentional; this runs inside server
    const migrationsModule = await import('allo-scrapper-server/dist/db/migrations.js') as { runMigrations: (db: unknown, dirs: string[]) => Promise<void> };
    await migrationsModule.runMigrations(options.db, [getSaasMigrationDir()]);

    // Start monthly quota reset scheduler (runs daily at midnight UTC)
    // @ts-ignore — options.db is compatible with DB interface at runtime
    startQuotaResetScheduler(options.db);

    // Apply org metrics middleware to all routes
    app.use(createOrgMetricsMiddleware());

    // Registration & slug availability
    app.use('/api', createRegisterRouter());

    // Email verification & member invitation flows
    app.use('/api', createOnboardingRouter());

    // Superadmin routes (protected by requireSuperadmin middleware)
    app.use('/api/superadmin', createSuperadminRouter());

    // Test fixture routes: mounted in test runtime only.
    // In non-test runtimes, explicitly deny /test/* to avoid SPA fallback (production)
    // returning index.html with 200.
    if (isFixtureRuntimeEnabled()) {
      app.use('/test', createTestFixturesRouter());
    } else {
      app.use('/test', createTestFixturesNotFoundRouter());
    }

    // Prometheus metrics endpoint for org-level metrics (open/unauthenticated)
    app.get('/api/saas/metrics', async (_req, res) => {
      try {
        res.set('Content-Type', getOrgRegistry().contentType);
        const metrics = await getOrgRegistry().metrics();
        res.end(metrics);
      } catch (error) {
        logger.error('Metrics endpoint error:', error);
        res.status(500).end('Error generating metrics');
      }
    });

    // All org-scoped routes: /api/org/:slug/*
    app.use('/api/org/:slug', createOrgRouter());
  },
};

/**
 * Returns the absolute path to the SaaS global migrations directory.
 * Used by server/src/db/migrations.ts when SAAS_ENABLED=true.
 */
export function getSaasMigrationDir(): string {
  const isProduction = process.env['NODE_ENV'] === 'production';
  if (isProduction) {
    return path.join('/app', 'packages', 'saas', 'migrations');
  }

  const candidates = [
    path.join(__dirname, '../migrations'),
    path.join(__dirname, '../../../../migrations'),
  ];

  const resolved = candidates.find((candidate) => existsSync(candidate));
  return resolved ?? candidates[0];
}
