import { fileURLToPath } from 'url';
import path from 'path';
import type { Express } from 'express';

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
    // TODO: tenant resolution middleware, quota middleware
  },

  registerRoutes(_app) {
    // TODO: /api/auth/register, /api/org/:slug/*, /api/superadmin/*
  },

  afterRoutes(_app) {
    // TODO: final SaaS-specific overrides
  },

  getMigrationDirs() {
    // In Docker: dist is under /app/packages/saas/dist
    // In dev: resolve relative to this file's compiled location
    const isDocker = __dirname.startsWith('/app/');
    return [
      isDocker
        ? path.join('/app', 'packages', 'saas', 'migrations')
        : path.join(__dirname, '../../migrations'),
    ];
  },
};
