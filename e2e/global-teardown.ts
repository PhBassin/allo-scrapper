import { runGlobalOrgCleanup } from './fixtures/org-fixture';

async function globalTeardown(): Promise<void> {
  const baseUrl = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000';
  await runGlobalOrgCleanup(baseUrl);
}

export default globalTeardown;
