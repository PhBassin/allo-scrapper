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

  async register(app, _options) {
    // Registration & slug availability
    app.use('/api', createRegisterRouter());

    // All org-scoped routes: /api/org/:slug/*
    app.use('/api/org/:slug', createOrgRouter());
  },
};

/**
 * Returns the absolute path to the SaaS global migrations directory.
 * Used by server/src/db/migrations.ts when SAAS_ENABLED=true.
 */
export function getSaasMigrationDir(): string {
  const isDocker = __dirname.startsWith('/app/');
  return isDocker
    ? path.join('/app', 'packages', 'saas', 'migrations')
    : path.join(__dirname, '../migrations');
}
