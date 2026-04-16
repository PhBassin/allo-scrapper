import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Cinema-Specific Scrape Feature
 * 
 * These tests verify that the cinema page has a scrape button that triggers
 * a cinema-specific scrape operation (only that cinema, all films, all dates).
 */

test.describe('Cinema Page - Cinema-Specific Scrape', () => {
  test.describe.configure({ mode: 'serial' }); // Triggers real scrapes — must be sequential

  test.beforeEach(async ({ page }) => {
    // Listen for console messages and errors
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
    
    // Navigate to home page first
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Click on the first cinema link to navigate to a cinema page
    const firstCinemaLink = page.locator('a[href^="/cinema/"]').first();
    await expect(firstCinemaLink).toBeVisible({ timeout: 10000 });
    await firstCinemaLink.click();
    
    // Wait for cinema page to load
    await page.waitForLoadState('networkidle');
  });

  test('cinema page displays cinema-specific scrape button', async ({ page }) => {
    // Verify we're on a cinema page
    await expect(page).toHaveURL(/\/cinema\/C\d{4}/);
    
    // Find the cinema scrape button by text
    const cinemaScrapeButton = page.locator('button').filter({ hasText: /scraper uniquement ce cinéma/i });
    await expect(cinemaScrapeButton).toBeVisible({ timeout: 5000 });
    await expect(cinemaScrapeButton).toBeEnabled();
  });

  test('cinema scrape button is positioned as sticky at top-20', async ({ page }) => {
    // Verify we're on a cinema page
    await expect(page).toHaveURL(/\/cinema\/C\d{4}/);
    
    // Find the cinema scrape button container
    const buttonContainer = page.locator('button').filter({ hasText: /scraper uniquement ce cinéma/i }).locator('..');
    
    // Check for sticky positioning classes (looking at parent container)
    const classes = await buttonContainer.getAttribute('class');
    expect(classes).toContain('sticky');
    expect(classes).toContain('top-20');
  });

  test('clicking cinema scrape button triggers API and shows success state', async ({ page }) => {
    // Verify we're on a cinema page
    await expect(page).toHaveURL(/\/cinema\/C\d{4}/);
    
    // Find and click the cinema scrape button
    const cinemaScrapeButton = page.locator('button').filter({ hasText: /scraper uniquement ce cinéma/i });
    await expect(cinemaScrapeButton).toBeEnabled({ timeout: 5000 });
    await cinemaScrapeButton.click();
    
    // Wait for button to show success state
    await expect(page.locator('button').filter({ hasText: /scraping démarré/i })).toBeVisible({ timeout: 5000 });
  });

  test('cinema scrape shows progress window', async ({ page }) => {
    // Verify we're on a cinema page
    await expect(page).toHaveURL(/\/cinema\/C\d{4}/);
    
    // Click cinema scrape button
    const cinemaScrapeButton = page.locator('button').filter({ hasText: /scraper uniquement ce cinéma/i });
    await expect(cinemaScrapeButton).toBeEnabled({ timeout: 5000 });
    await cinemaScrapeButton.click();
    
    // Wait for success state
    await expect(page.locator('button').filter({ hasText: /scraping démarré/i })).toBeVisible({ timeout: 5000 });
    
    // Progress window should appear
    const progressWindow = page.getByTestId('scrape-progress');
    await expect(progressWindow).toBeVisible({ timeout: 5000 });
    
    // Should show loading or scraping state
    await expect(progressWindow).toContainText(/connexion en cours|scraping en cours/i);
  });

  test('cinema scrape handles API error gracefully', async ({ page }) => {
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
    
    // Verify we're on a cinema page
    await expect(page).toHaveURL(/\/cinema\/C\d{4}/);
    
    // Click cinema scrape button
    const cinemaScrapeButton = page.locator('button').filter({ hasText: /scraper uniquement ce cinéma/i });
    await expect(cinemaScrapeButton).toBeEnabled({ timeout: 5000 });
    await cinemaScrapeButton.click();
    
    // Should show error state
    const errorMessage = page.locator('.text-red-600').filter({ hasText: /erreur|error/i });
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('cinema scrape only processes the specific cinema', async ({ page }) => {
    // Get the cinema ID from URL
    await expect(page).toHaveURL(/\/cinema\/(C\d{4})/);
    const url = page.url();
    const cinemaId = url.match(/\/cinema\/(C\d{4})/)?.[1];
    expect(cinemaId).toBeTruthy();
    
    // Click cinema scrape button
    const cinemaScrapeButton = page.locator('button').filter({ hasText: /scraper uniquement ce cinéma/i });
    await expect(cinemaScrapeButton).toBeEnabled({ timeout: 5000 });
    await cinemaScrapeButton.click();
    
    // Wait for progress window
    const progressWindow = page.getByTestId('scrape-progress');
    await expect(progressWindow).toBeVisible({ timeout: 10000 });
    
    // Wait for cinema progress to show (should show "1 / 1" for single cinema)
    await expect(page.getByText(/cinémas traités/i)).toBeVisible({ timeout: 30000 });
    
    // Verify only 1 cinema is being processed
    const cinemaProgress = progressWindow.getByText(/1 \/ 1/).first();
    await expect(cinemaProgress).toBeVisible({ timeout: 10000 });
  });
});
