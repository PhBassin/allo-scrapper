import { fileURLToPath } from 'url';
import path from 'path';
import type { Express, RequestHandler } from 'express';
import { createRegisterRouter } from './routes/register.js';
import { createOrgRouter } from './routes/org.js';
import { createOnboardingRouter } from './routes/onboarding.js';
import { createSuperadminRouter } from './routes/superadmin.js';
import { createOrgMetricsMiddleware, getOrgRegistry } from './middleware/org-metrics.js';
import type { OrgSettingsRouterDeps } from './routes/org-settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// PluginDeps — mirror of the interface defined in server/src/app.ts.
// Kept in sync manually; no cross-package import needed.
// ---------------------------------------------------------------------------

export interface PluginDeps {
  requireAuth: RequestHandler;
  requirePermission: (...permissions: string[]) => RequestHandler;
  protectedLimiter: RequestHandler;
  validateImage: (data: string, type: 'logo' | 'favicon', maxBytes: number) => Promise<{ valid: boolean; error?: string; compressedBase64?: string }>;
  NotFoundError: new (message: string) => Error;
  ValidationError: new (message: string) => Error;
  logger: { info: (msg: string, meta?: Record<string, unknown>) => void };
}

export interface AppPlugin {
  name: string;
  beforeRoutes?:    (app: Express) => void;
  registerRoutes?:  (app: Express, deps: PluginDeps) => void | Promise<void>;
  afterRoutes?:     (app: Express) => void;
  getMigrationDirs?: () => string[];
}

/**
 * SaaS overlay plugin.
 * Activated when SAAS_ENABLED=true in the environment.
 */
export const saasPlugin: AppPlugin = {
  name: '@allo-scrapper/saas',

  beforeRoutes(app) {
    // Phase 7.5 — per-org Prometheus metrics middleware
    app.use(createOrgMetricsMiddleware());
  },

  async registerRoutes(app, deps) {
    const {
      requireAuth,
      requirePermission,
      protectedLimiter,
      validateImage,
      NotFoundError,
      ValidationError,
      logger,
    } = deps;

    // Registration & slug availability
    app.use('/api/auth', createRegisterRouter());

    // Email verification + invitation join (public routes)
    app.use('/api', createOnboardingRouter());

    // Build settings deps from injected server utilities.
    // All server deps are passed in — no cross-package relative imports needed.
    const settingsDeps: OrgSettingsRouterDeps = {
      requireAuth,
      requirePermission,
      protectedLimiter,
      validateImage,
      notFoundError: (msg) => new NotFoundError(msg),
      validationError: (msg) => new ValidationError(msg),
      logger,
    };

    // All org-scoped routes: /api/org/:slug/*
    app.use('/api/org/:slug', createOrgRouter(settingsDeps));

    // Phase 7.5 — expose per-org Prometheus metrics at /api/saas/metrics
    app.get('/api/saas/metrics', async (_req, res) => {
      try {
        const registry = getOrgRegistry();
        res.set('Content-Type', registry.contentType);
        res.end(await registry.metrics());
      } catch (err) {
        res.status(500).end(String(err));
      }
    });

    // Superadmin portal: /api/superadmin/*
    app.use('/api/superadmin', createSuperadminRouter());
  },

  afterRoutes(_app) {
    // Final SaaS-specific overrides — reserved for future use
  },

  getMigrationDirs() {
    // Returns the directory containing SaaS global migrations
    // (plans, organizations, org_usage, subscriptions)
    const isDocker = __dirname.startsWith('/app/');
    return [
      isDocker
        ? path.join('/app', 'packages', 'saas', 'migrations')
        : path.join(__dirname, '../migrations'),
    ];
  },
};
