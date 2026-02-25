import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Reports Navigation
 * 
 * These tests verify that navigation between the reports list and detail views
 * works correctly, including URL query parameter persistence for pagination.
 */

test.describe('Reports Navigation', () => {
  test.beforeAll(async ({ browser }) => {
    // Ensure we have at least one report by triggering a scrape of one cinema
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      console.log('Setting up: Ensuring at least one report exists...');
      
      // Go to home page
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check if scrape button exists and click it
      const scrapeButton = page.locator('button').filter({ hasText: /lancer le scraping/i }).first();
      const buttonVisible = await scrapeButton.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (buttonVisible) {
        await scrapeButton.click();
        
        // Wait for scraping to start
        await expect(page.locator('button').filter({ hasText: /scraping/i }).first()).toBeVisible({ timeout: 5000 });
        
        // Wait for scraping to complete (with generous timeout)
        await expect(page.getByText(/scraping terminé/i)).toBeVisible({ timeout: 120000 });
        
        console.log('Setup complete: Scrape finished, reports should be available');
      } else {
        console.log('Setup: Scrape button not found, assuming reports already exist');
      }
    } catch (error) {
      console.warn('Setup warning:', error);
    } finally {
      await page.close();
      await context.close();
    }
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to home and wait for load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('navigating from report detail to list via header link works', async ({ page }) => {
    // 1. Go to reports page
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/reports');
    
    // 2. Verify we see the reports list
    await expect(page.getByText(/Historique des scrapings/i)).toBeVisible({ timeout: 5000 });
    
    // 3. Click on first report
    const firstReport = page.locator('a[href^="/reports/"]').first();
    await expect(firstReport).toBeVisible({ timeout: 5000 });
    await firstReport.click();
    
    // 4. Verify we're on detail page
    await expect(page).toHaveURL(/\/reports\/\d+/);
    await expect(page.locator('h1').filter({ hasText: /Rapport #\d+/i })).toBeVisible({ timeout: 5000 });
    
    // 5. Click "Rapports" in header navigation
    await page.locator('header nav').getByRole('link', { name: /^Rapports$/i }).click();
    
    // 6. VERIFY: We should be back on the list
    await expect(page).toHaveURL('/reports');
    await expect(page.getByText(/Historique des scrapings/i)).toBeVisible({ timeout: 5000 });
    
    // 7. VERIFY: Detail view is gone (check for absence of detail-specific elements)
    const detailTitle = page.locator('h1').filter({ hasText: /Rapport #\d+/i });
    await expect(detailTitle).not.toBeVisible();
    
    // 8. VERIFY: List view is showing (should see multiple report cards)
    const reportLinks = page.locator('a[href^="/reports/"]');
    await expect(reportLinks.first()).toBeVisible();
  });

  test('navigating from report detail to list via breadcrumb works', async ({ page }) => {
    // 1. Navigate to reports list
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    // 2. Click on first report
    const firstReport = page.locator('a[href^="/reports/"]').first();
    await expect(firstReport).toBeVisible({ timeout: 5000 });
    await firstReport.click();
    
    // 3. Wait for detail to load
    await expect(page).toHaveURL(/\/reports\/\d+/);
    await expect(page.locator('h1').filter({ hasText: /Rapport #\d+/i })).toBeVisible({ timeout: 5000 });
    
    // 4. Click breadcrumb "← Rapports"
    const breadcrumbLink = page.getByRole('link', { name: /← Rapports/i });
    await expect(breadcrumbLink).toBeVisible();
    await breadcrumbLink.click();
    
    // 5. VERIFY: Back to list
    await expect(page).toHaveURL('/reports');
    await expect(page.getByText(/Historique des scrapings/i)).toBeVisible({ timeout: 5000 });
    
    // 6. VERIFY: List view is showing
    const reportLinks = page.locator('a[href^="/reports/"]');
    await expect(reportLinks.first()).toBeVisible();
  });

  test('page number is persisted in URL when navigating', async ({ page }) => {
    // 1. Go to reports page
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    // 2. Check if pagination exists (we need enough reports)
    const nextButton = page.getByRole('button', { name: /Suivant/i });
    const hasPagination = await nextButton.isVisible().catch(() => false);
    
    if (!hasPagination) {
      console.log('Skipping pagination test: not enough reports for pagination');
      test.skip();
      return;
    }
    
    const nextEnabled = await nextButton.isEnabled();
    if (!nextEnabled) {
      console.log('Skipping pagination test: already on last page');
      test.skip();
      return;
    }
    
    // 3. Go to page 2
    await nextButton.click();
    await page.waitForLoadState('networkidle');
    
    // 4. VERIFY: URL should contain page parameter
    await expect(page).toHaveURL(/\/reports\?page=2/);
    await expect(page.getByText(/Page 2/i)).toBeVisible({ timeout: 5000 });
    
    // 5. Click on a report from page 2
    const firstReport = page.locator('a[href^="/reports/"]').first();
    await expect(firstReport).toBeVisible({ timeout: 5000 });
    const reportId = await firstReport.getAttribute('href');
    await firstReport.click();
    
    // 6. Verify we're on detail page
    await expect(page).toHaveURL(new RegExp(reportId!));
    await expect(page.locator('h1').filter({ hasText: /Rapport #\d+/i })).toBeVisible();
    
    // 7. Go back to list via header
    await page.locator('header nav').getByRole('link', { name: /^Rapports$/i }).click();
    
    // 8. VERIFY: We should be back on page 1 (fresh state - URL without page param or ?page=1)
    await expect(page).toHaveURL(/\/reports(\?page=1)?$/);
    await expect(page.getByText(/Historique des scrapings/i)).toBeVisible({ timeout: 5000 });
  });

  test('page number is persisted when using browser back button', async ({ page }) => {
    // 1. Go to reports page
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    // 2. Check if pagination exists
    const nextButton = page.getByRole('button', { name: /Suivant/i });
    const hasPagination = await nextButton.isVisible().catch(() => false);
    
    if (!hasPagination || !(await nextButton.isEnabled())) {
      console.log('Skipping pagination test: not enough reports');
      test.skip();
      return;
    }
    
    // 3. Go to page 2
    await nextButton.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/reports\?page=2/);
    
    // 4. Click on a report
    const firstReport = page.locator('a[href^="/reports/"]').first();
    await firstReport.click();
    await expect(page).toHaveURL(/\/reports\/\d+/);
    
    // 5. Use browser back button
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // 6. VERIFY: We should be back on page 2 (browser history preserved)
    await expect(page).toHaveURL(/\/reports\?page=2/);
    await expect(page.getByText(/Page 2/i)).toBeVisible({ timeout: 5000 });
  });

  test('direct navigation to report detail and back to list works', async ({ page }) => {
    // 1. Get a report ID by visiting the list first
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    const firstReportLink = page.locator('a[href^="/reports/"]').first();
    await expect(firstReportLink).toBeVisible({ timeout: 5000 });
    const reportHref = await firstReportLink.getAttribute('href');
    const reportId = reportHref?.match(/\/reports\/(\d+)/)?.[1];
    
    if (!reportId) {
      throw new Error('Could not extract report ID');
    }
    
    // 2. Navigate directly to detail page via URL
    await page.goto(`/reports/${reportId}`);
    await page.waitForLoadState('networkidle');
    
    // 3. Verify detail view loads
    await expect(page).toHaveURL(`/reports/${reportId}`);
    await expect(page.locator('h1').filter({ hasText: /Rapport #\d+/i })).toBeVisible({ timeout: 5000 });
    
    // 4. Click "Rapports" in header
    await page.locator('header nav').getByRole('link', { name: /^Rapports$/i }).click();
    
    // 5. VERIFY: Back to list
    await expect(page).toHaveURL('/reports');
    await expect(page.getByText(/Historique des scrapings/i)).toBeVisible({ timeout: 5000 });
  });
});
