import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Theater-Specific Scrape Feature
 * 
 * These tests verify that the theater page has a scrape button that triggers
 * a theater-specific scrape operation (only that theater, all films, all dates).
 */

test.describe('Theater Page - Theater-Specific Scrape', () => {
  test.describe.configure({ mode: 'serial' }); // Triggers real scrapes — must be sequential

  test.beforeEach(async ({ page }) => {
    // Listen for console messages and errors
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
    
    // Navigate to home page first
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Click on the first theater link to navigate to a theater page
    const firstTheaterLink = page.locator('a[href^="/theater/"]').first();
    await expect(firstTheaterLink).toBeVisible({ timeout: 10000 });
    await firstTheaterLink.click();
    
    // Wait for theater page to load
    await page.waitForLoadState('networkidle');
  });

  test('theater page displays theater-specific scrape button', async ({ page }) => {
    // Verify we're on a theater page
    await expect(page).toHaveURL(/\/theater\/C\d{4}/);
    
    // Find the theater scrape button by text
    const theaterScrapeButton = page.locator('button').filter({ hasText: /scraper uniquement ce théâtre/i });
    await expect(theaterScrapeButton).toBeVisible({ timeout: 5000 });
    await expect(theaterScrapeButton).toBeEnabled();
  });

  test('theater scrape button is positioned as sticky at top-20', async ({ page }) => {
    // Verify we're on a theater page
    await expect(page).toHaveURL(/\/theater\/C\d{4}/);
    
    // Find the theater scrape button container
    const buttonContainer = page.locator('button').filter({ hasText: /scraper uniquement ce théâtre/i }).locator('..');
    
    // Check for sticky positioning classes (looking at parent container)
    const classes = await buttonContainer.getAttribute('class');
    expect(classes).toContain('sticky');
    expect(classes).toContain('top-20');
  });

  test('clicking theater scrape button triggers API and shows success state', async ({ page }) => {
    // Verify we're on a theater page
    await expect(page).toHaveURL(/\/theater\/C\d{4}/);
    
    // Find and click the theater scrape button
    const theaterScrapeButton = page.locator('button').filter({ hasText: /scraper uniquement ce théâtre/i });
    await expect(theaterScrapeButton).toBeEnabled({ timeout: 5000 });
    await theaterScrapeButton.click();
    
    // Wait for button to show success state
    await expect(page.locator('button').filter({ hasText: /scraping démarré/i })).toBeVisible({ timeout: 5000 });
  });

  test('theater scrape shows progress window', async ({ page }) => {
    // Verify we're on a theater page
    await expect(page).toHaveURL(/\/theater\/C\d{4}/);
    
    // Click theater scrape button
    const theaterScrapeButton = page.locator('button').filter({ hasText: /scraper uniquement ce théâtre/i });
    await expect(theaterScrapeButton).toBeEnabled({ timeout: 5000 });
    await theaterScrapeButton.click();
    
    // Wait for success state
    await expect(page.locator('button').filter({ hasText: /scraping démarré/i })).toBeVisible({ timeout: 5000 });
    
    // Progress window should appear
    const progressWindow = page.getByTestId('scrape-progress');
    await expect(progressWindow).toBeVisible({ timeout: 5000 });
    
    // Should show loading or scraping state
    await expect(progressWindow).toContainText(/connexion en cours|scraping en cours/i);
  });

  test('theater scrape handles API error gracefully', async ({ page }) => {
    // Intercept API call to simulate error
    await page.route('**/api/scraper/trigger', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Simulated server error' }
        })
      });
    });
    
    // Verify we're on a theater page
    await expect(page).toHaveURL(/\/theater\/C\d{4}/);
    
    // Click theater scrape button
    const theaterScrapeButton = page.locator('button').filter({ hasText: /scraper uniquement ce théâtre/i });
    await expect(theaterScrapeButton).toBeEnabled({ timeout: 5000 });
    await theaterScrapeButton.click();
    
    // Should show error state
    const errorMessage = page.locator('.text-red-600').filter({ hasText: /erreur|error/i });
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('theater scrape only processes the specific theater', async ({ page }) => {
    // Get the theater ID from URL
    await expect(page).toHaveURL(/\/theater\/(C\d{4})/);
    const url = page.url();
    const theaterId = url.match(/\/theater\/(C\d{4})/)?.[1];
    expect(theaterId).toBeTruthy();
    
    // Click theater scrape button
    const theaterScrapeButton = page.locator('button').filter({ hasText: /scraper uniquement ce théâtre/i });
    await expect(theaterScrapeButton).toBeEnabled({ timeout: 5000 });
    await theaterScrapeButton.click();
    
    // Wait for progress window
    const progressWindow = page.getByTestId('scrape-progress');
    await expect(progressWindow).toBeVisible({ timeout: 10000 });
    
    // Wait for theater progress to show (should show "1 / 1" for single theater)
    await expect(page.getByText(/cinémas traités/i)).toBeVisible({ timeout: 30000 });
    
    // Verify only 1 theater is being processed
    const theaterProgress = progressWindow.getByText(/1 \/ 1/).first();
    await expect(theaterProgress).toBeVisible({ timeout: 10000 });
  });
});
