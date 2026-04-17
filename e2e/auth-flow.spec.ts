import { test, expect } from './fixtures/org-fixture';

const useOrgFixture = process.env['E2E_ENABLE_ORG_FIXTURE'] === 'true';

test.describe('Authentication Flow', () => {
    test.beforeEach(async ({ seedTestOrg }) => {
        if (useOrgFixture) {
            await seedTestOrg();
        }
    });

    test('reports page redirects unauthenticated users to login', async ({ page }) => {
        // Navigate directly to the protected route
        await page.goto('/reports');
        await page.waitForLoadState('networkidle');

        // Login form should be visible since ProtectedRoute renders <Navigate to="/login" />
        // which mounts the LoginPage component.
        await expect(page.locator('h2').filter({ hasText: /Login/i })).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#username')).toBeVisible();
        await expect(page.locator('#password')).toBeVisible();
    });

    test('home page hides scrape buttons for unauthenticated users', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Scrape button should not be visible
        const scrapeButton = page.locator('button').filter({ hasText: /lancer le scraping/i });
        await expect(scrapeButton).not.toBeVisible();
    });

    test('login flow works and unhides protected content', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        // Fill login form
        await page.fill('#username', 'admin');
        await page.fill('#password', 'admin');
        await page.click('button[type="submit"]');

        // Wait for the home page header to appear
        await page.waitForSelector('header nav');

        // Header should now show Logout and Reports links
        await expect(page.locator('header nav').getByRole('link', { name: /^Rapports$/i })).toBeVisible({ timeout: 10000 });
        await expect(page.locator('button').filter({ hasText: 'Se déconnecter' })).toBeVisible();

        // Home page should now show the manual scrape button
        const scrapeButton = page.locator('button').filter({ hasText: /lancer le scraping/i });
        await expect(scrapeButton).toBeVisible();
    });

    test('logout removes access to protected content', async ({ page }) => {
        // 1. Login first
        await page.goto('/login');
        await page.fill('#username', 'admin');
        await page.fill('#password', 'admin');
        await page.click('button[type="submit"]');

        // Wait for login to complete and navigate to home
        await page.waitForSelector('button:has-text("Se déconnecter")');

        // 2. Click Logout
        const logoutBtn = page.locator('button').filter({ hasText: 'Se déconnecter' });
        await logoutBtn.click();

        // Wait for logout consequences
        await page.waitForLoadState('networkidle');

        // 3. Verify Scrape button and Reports link are gone
        const scrapeButton = page.locator('button').filter({ hasText: /lancer le scraping/i });
        await expect(scrapeButton).not.toBeVisible();
        await expect(page.locator('header nav').getByRole('link', { name: /^Rapports$/i })).not.toBeVisible();

        // 4. Verify Reports page redirects back to login
        await page.goto('/reports');
        await expect(page.locator('h2').filter({ hasText: /Login/i })).toBeVisible({ timeout: 10000 });
    });
});
