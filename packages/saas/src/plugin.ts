/**
 * SaaS overlay plugin.
 * Activated when SAAS_ENABLED=true in the environment.
 *
 * Implements the AppPlugin interface from server/src/app.ts.
 * register() is called once at startup by applyPlugins().
 */
import { fileURLToPath } from 'url';
import path from 'path';
import type { Express } from 'express';
import { createRegisterRouter } from './routes/register.js';
import { createOrgRouter } from './routes/org.js';
import { createOnboardingRouter } from './routes/onboarding.js';
import { createSuperadminRouter } from './routes/superadmin.js';
import { createOrgMetricsMiddleware, getOrgRegistry } from './middleware/org-metrics.js';
import { startQuotaResetScheduler } from './quota-reset-scheduler.js';

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

export const saasPlugin: AppPlugin = {
  name: '@allo-scrapper/saas',

  async register(app, options) {
    // Self-bootstrap: run SaaS-specific DB migrations before mounting routes.
    // The dynamic import resolves at runtime inside the server process.
    // @ts-ignore — cross-rootDir import is intentional; this runs inside server
    const migrationsModule = await import('../../../server/src/db/migrations.js') as { runMigrations: (db: unknown, dirs: string[]) => Promise<void> };
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

    // Prometheus metrics endpoint for org-level metrics (open/unauthenticated)
    app.get('/api/saas/metrics', async (_req, res) => {
      try {
        res.set('Content-Type', getOrgRegistry().contentType);
        const metrics = await getOrgRegistry().metrics();
        res.end(metrics);
      } catch (error) {
        console.error('Metrics endpoint error:', error);
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
  return isProduction
    ? path.join('/app', 'packages', 'saas', 'migrations')
    : path.join(__dirname, '../migrations');
}
