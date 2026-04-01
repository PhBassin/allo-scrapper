import { fileURLToPath } from 'url';
import path from 'path';
import type { Express } from 'express';
import { createRegisterRouter } from './routes/register.js';
import { createOrgRouter } from './routes/org.js';
import { createOnboardingRouter } from './routes/onboarding.js';
import { createSuperadminRouter } from './routes/superadmin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppPlugin {
  name: string;
  beforeRoutes?:    (app: Express) => void;
  registerRoutes?:  (app: Express) => void;
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

  registerRoutes(app) {
    // Registration & slug availability
    app.use('/api/auth', createRegisterRouter());

    // Email verification + invitation join (public routes)
    app.use('/api', createOnboardingRouter());

    // All org-scoped routes: /api/org/:slug/*
    app.use('/api/org/:slug', createOrgRouter());

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
