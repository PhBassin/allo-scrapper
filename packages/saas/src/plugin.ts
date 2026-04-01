import { fileURLToPath } from 'url';
import path from 'path';
import type { Express, RequestHandler } from 'express';
import { createRegisterRouter } from './routes/register.js';
import { createOrgRouter } from './routes/org.js';
import { createOnboardingRouter } from './routes/onboarding.js';
import { createSuperadminRouter } from './routes/superadmin.js';
import type { OrgSettingsRouterDeps } from './routes/org-settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppPlugin {
  name: string;
  beforeRoutes?:    (app: Express) => void;
  registerRoutes?:  (app: Express) => void | Promise<void>;
  afterRoutes?:     (app: Express) => void;
  getMigrationDirs?: () => string[];
}

/**
 * SaaS overlay plugin.
 * Activated when SAAS_ENABLED=true in the environment.
 */
export const saasPlugin: AppPlugin = {
  name: '@allo-scrapper/saas',

  beforeRoutes(_app) {
    // Global SaaS middleware (e.g. org rate limiting) — Phase 3
  },

  async registerRoutes(app) {
    // Registration & slug availability
    app.use('/api/auth', createRegisterRouter());

    // Email verification + invitation join (public routes)
    app.use('/api', createOnboardingRouter());

    // Build settings deps by dynamically importing server utilities.
    // These imports are resolved at runtime (inside the server process), so
    // they are always available. The casts below keep the saas package's tsc
    // compilation clean (rootDir: ./src would reject cross-package imports).
    const [
      { requireAuth },
      { requirePermission },
      { protectedLimiter },
      { validateImage },
      { NotFoundError, ValidationError },
      { logger },
    ] = await Promise.all([
      import('../../../../server/src/middleware/auth.js' as string) as Promise<{ requireAuth: RequestHandler }>,
      import('../../../../server/src/middleware/permission.js' as string) as Promise<{ requirePermission: (p: string) => RequestHandler }>,
      import('../../../../server/src/middleware/rate-limit.js' as string) as Promise<{ protectedLimiter: RequestHandler }>,
      import('../../../../server/src/utils/image-validator.js' as string) as Promise<{ validateImage: OrgSettingsRouterDeps['validateImage'] }>,
      import('../../../../server/src/utils/errors.js' as string) as Promise<{ NotFoundError: new (msg: string) => Error; ValidationError: new (msg: string) => Error }>,
      import('../../../../server/src/utils/logger.js' as string) as Promise<{ logger: OrgSettingsRouterDeps['logger'] }>,
    ]);

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
