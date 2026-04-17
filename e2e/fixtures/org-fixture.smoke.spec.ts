import { test, expect } from './org-fixture';

test.describe('Org fixture cleanup smoke', () => {
  test('seeds org and auto-cleans in afterEach', async ({ seedTestOrg }) => {
    const org = await seedTestOrg();

    expect(org.orgId).toBeGreaterThan(0);
    expect(org.orgSlug.startsWith('e2e-test-')).toBe(true);
    expect(org.schemaName.startsWith('org_')).toBe(true);
    expect(org.admin.username).toContain('e2e-test-');
  });
});
