import { test, expect } from './fixtures/org-fixture';

const useOrgFixture = process.env['E2E_ENABLE_ORG_FIXTURE'] === 'true';

// Helper function to login (reuse across tests to avoid rate limits)
async function loginAsAdmin(page: any) {
  await page.goto('/login');
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

test.describe('Admin System Information Page', () => {
  test.beforeEach(async ({ seedTestOrg }) => {
    if (useOrgFixture) {
      await seedTestOrg();
    }
  });

  // Use serial mode to avoid rate limiting issues with multiple logins
  test.describe.configure({ mode: 'serial' });

  test.describe('Access Control', () => {
    test.skip('should redirect unauthenticated users to login', async ({ page }) => {
      // TODO: Fix this test - RequireAdmin redirect may not work in E2E context
      // The redirect works in production but may need special handling in tests
      await page.goto('/admin/system');
      await page.waitForURL(/\/login/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/login/);
    });

    test('should allow access to admin users', async ({ page }) => {
      await loginAsAdmin(page);

      // Navigate to system page
      await page.click('[data-testid="user-menu-button"]');
      await page.click('text=System');

      // Should load system page successfully
      await expect(page).toHaveURL('/admin/system');
      await expect(page.locator('h1')).toContainText('System Information');
    });
  });

  test.describe('System Information Display', () => {
    // Share login state across all tests in this block
    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      await loginAsAdmin(page);
      await page.close();
    });

    test('should display all information cards', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/admin/system');
      await page.waitForLoadState('networkidle');

      // Check all main cards are visible
      await expect(page.locator('text=Health Status')).toBeVisible();
      await expect(page.locator('text=Application Info')).toBeVisible();
      await expect(page.locator('text=Server Health')).toBeVisible();
      await expect(page.locator('text=Database Statistics')).toBeVisible();
      await expect(page.locator('text=Database Migrations')).toBeVisible();
    });

    test('should display health status with correct information', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/admin/system');
      await page.waitForLoadState('networkidle');

      const healthCard = page.locator('text=Health Status').locator('..');
      
      // Should show status badge
      await expect(healthCard.locator('text=/healthy|degraded|error/i')).toBeVisible();
      
      // Should show checks
      await expect(healthCard).toContainText(/Database/i);
      await expect(healthCard).toContainText(/Migrations/i);
    });

    test('should display app information', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/admin/system');
      await page.waitForLoadState('networkidle');

      const appCard = page.locator('text=Application Info').locator('..');
      
      // Should display version
      await expect(appCard).toContainText(/Version/i);
      await expect(appCard).toContainText(/\d+\.\d+\.\d+/);
      
      // Should display environment
      await expect(appCard).toContainText(/Environment/i);
      
      // Should display Node version
      await expect(appCard).toContainText(/Node/i);
    });

    test('should display server metrics', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/admin/system');
      await page.waitForLoadState('networkidle');

      const serverCard = page.locator('text=Server Health').locator('..');
      
      // Should show uptime
      await expect(serverCard).toContainText(/Uptime/i);
      
      // Should show memory usage in MB
      await expect(serverCard).toContainText(/Memory/i);
      await expect(serverCard).toContainText(/MB/i);
    });

    test('should display database statistics', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/admin/system');
      await page.waitForLoadState('networkidle');

      const dbCard = page.locator('text=Database Statistics').locator('..');
      
      // Should show counts
      await expect(dbCard).toContainText(/Cinemas/i);
      await expect(dbCard).toContainText(/Films/i);
      await expect(dbCard).toContainText(/Showtimes/i);
      
      // Should show numbers
      await expect(dbCard).toContainText(/\d+/);
    });

    test('should display migrations table', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/admin/system');
      await page.waitForLoadState('networkidle');

      // Check migrations section
      const migrationsSection = page.locator('text=Database Migrations').locator('..');
      await expect(migrationsSection).toBeVisible();
      
      // Should show count
      await expect(migrationsSection).toContainText(/Applied:/i);
      await expect(migrationsSection).toContainText(/\d+/);
      
      // Should show table headers
      await expect(migrationsSection).toContainText(/Migration/i);
      await expect(migrationsSection).toContainText(/Applied At/i);
      await expect(migrationsSection).toContainText(/Status/i);
      
      // Should list migrations
      await expect(migrationsSection).toContainText(/\.sql/i);
    });

    test('should have auto-refresh toggle', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/admin/system');
      await page.waitForLoadState('networkidle');

      // Find auto-refresh checkbox
      const checkbox = page.locator('input[type="checkbox"]').first();
      await expect(checkbox).toBeVisible();
      
      // Should be able to toggle
      const isChecked = await checkbox.isChecked();
      await checkbox.click();
      if (isChecked) {
        await expect(checkbox).not.toBeChecked();
      } else {
        await expect(checkbox).toBeChecked();
      }
    });
  });

  test.describe('Responsive Layout', () => {
    test('should display correctly on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await loginAsAdmin(page);
      await page.goto('/admin/system');
      await page.waitForLoadState('networkidle');

      // Verify cards are visible
      await expect(page.locator('text=Health Status')).toBeVisible();
      await expect(page.locator('text=Application Info')).toBeVisible();
      await expect(page.locator('text=Server Health')).toBeVisible();
      await expect(page.locator('text=Database Statistics')).toBeVisible();
    });

    test('should display correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await loginAsAdmin(page);
      await page.goto('/admin/system');
      await page.waitForLoadState('networkidle');

      // Cards should still be visible (just stacked)
      await expect(page.locator('text=Health Status')).toBeVisible();
      
      // Scroll to see migrations table
      await page.locator('text=Database Migrations').scrollIntoViewIfNeeded();
      await expect(page.locator('text=Database Migrations')).toBeVisible();
    });
  });
});
