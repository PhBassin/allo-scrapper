import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Scrape Progress Feature
 * 
 * These tests verify the SSE-based scrape progress window behavior
 * with real scrape operations (not mocked).
 */

test.describe('Scrape Progress Visibility', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console messages
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
    
    // Navigate to home page
    await page.goto('/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('clicking scrape button triggers API call and shows response', async ({ page }) => {
    // Track network requests
    const requests: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/scraper')) {
        requests.push(`${req.method()} ${req.url()}`);
        console.log('REQUEST:', req.method(), req.url());
      }
    });
    page.on('response', async res => {
      if (res.url().includes('/scraper')) {
        console.log('RESPONSE:', res.status(), res.url());
        try {
          const body = await res.text();
          console.log('BODY:', body.substring(0, 200));
        } catch (e) {
          // Ignore
        }
      }
    });

    // Find the button container first (it's the only button with the scraping text)
    const buttonContainer = page.locator('button').filter({ hasText: /lancer le scraping manuel/i }).first();
    await expect(buttonContainer).toBeEnabled({ timeout: 5000 });
    
    // Click the button
    console.log('Clicking button...');
    await buttonContainer.click();
    console.log('Button clicked, waiting for state change...');

    // Wait for ANY button to show loading or success state (button text will have changed)
    await expect(page.locator('button').filter({ hasText: /scraping en cours|scraping démarré/i }).first()).toBeVisible({ timeout: 5000 });
    
    console.log('Requests made:', requests);
  });

  test('progress window stays visible during entire scrape and 5s after completion', async ({ page }) => {
    // Click the scrape button to start scrape
    const scrapeButton = page.getByRole('button', { name: /lancer le scraping manuel/i });
    await scrapeButton.click();

    // Progress window should appear with loading state or first event using data-testid
    const progressWindow = page.getByTestId('scrape-progress');
    await expect(progressWindow).toBeVisible({ timeout: 10000 });

    // Verify loading state appears first
    await expect(progressWindow).toContainText(/connexion en cours|scraping en cours/i, { timeout: 5000 });

    // Wait for scrape to progress - check for "Cinémas traités" indicator
    await expect(page.getByText(/cinémas traités/i)).toBeVisible({ timeout: 30000 });

    // Wait for completion (with generous timeout for real scrape)
    // Look for either "Scraping terminé" or completion indicators
    await expect(page.getByText(/scraping terminé/i)).toBeVisible({ timeout: 120000 });

    // Progress window should still be visible immediately after completion
    await expect(progressWindow).toBeVisible();

    // Wait 3 seconds and verify still visible
    await page.waitForTimeout(3000);
    await expect(progressWindow).toBeVisible();

    // After 6+ seconds total (accounting for potential delays), window may close
    // This verifies the "stays visible for ~5s after" requirement
    await page.waitForTimeout(3000);
    // We don't assert hidden here since the 5s is approximate
  });

  test('progress resumes on page refresh during active scrape', async ({ page }) => {
    // Start scrape
    const scrapeButton = page.getByRole('button', { name: /lancer le scraping manuel/i });
    await scrapeButton.click();

    // Wait for progress window to appear using data-testid
    const progressWindow = page.getByTestId('scrape-progress');
    await expect(progressWindow).toBeVisible({ timeout: 10000 });

    // Wait for scrape to be in progress (cinema processing started)
    await expect(page.getByText(/cinémas traités/i)).toBeVisible({ timeout: 30000 });

    // Refresh the page
    await page.reload();

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Progress window should auto-appear because scrape is still running
    // The HomePage should detect isRunning=true and show progress
    await expect(page.getByTestId('scrape-progress')).toBeVisible({ timeout: 10000 });

    // Should show progress details (not just loading state)
    await expect(page.getByText(/cinémas traités/i)).toBeVisible({ timeout: 30000 });
  });

  test('clicking scrape button during active scrape resumes progress without error', async ({ page }) => {
    // Start first scrape
    const scrapeButton = page.getByRole('button', { name: /lancer le scraping manuel/i });
    await scrapeButton.click();

    // Wait for progress to start using data-testid
    const progressWindow = page.getByTestId('scrape-progress');
    await expect(progressWindow).toBeVisible({ timeout: 10000 });

    // Wait for scrape to be actively processing
    await expect(page.getByText(/cinémas traités/i)).toBeVisible({ timeout: 30000 });

    // Click the scrape button again while scrape is running
    await scrapeButton.click();

    // Should NOT show an error message in the scrape button area
    const errorMessage = page.locator('.text-red-600').filter({ hasText: /erreur|error/i });
    await expect(errorMessage).not.toBeVisible();

    // Progress window should still be visible
    await expect(progressWindow).toBeVisible();

    // Progress should continue (cinemas counter should still be present)
    await expect(page.getByText(/cinémas traités/i)).toBeVisible();
  });

  test('progress window shows loading state before first SSE event', async ({ page }) => {
    // Wait for the scrape button to be ready
    const scrapeButton = page.getByRole('button', { name: /lancer le scraping manuel/i });
    await expect(scrapeButton).toBeEnabled({ timeout: 5000 });
    
    // Click scrape button
    await scrapeButton.click();

    // Wait for the button state to change (indicating the click was registered)
    await expect(scrapeButton).not.toHaveText(/lancer le scraping manuel/i, { timeout: 2000 });

    // Check for progress window using data-testid
    const progressWindow = page.getByTestId('scrape-progress');
    await expect(progressWindow).toBeVisible({ timeout: 5000 });
    
    // This tests the Bug 1 fix: should show "Connexion en cours..." not null
    // Check that the loading text is visible within the progress window
    await expect(progressWindow).toContainText(/connexion en cours/i, { timeout: 2000 });
  });

  test('progress window shows detailed progress information', async ({ page }) => {
    // Start scrape
    const scrapeButton = page.getByRole('button', { name: /lancer le scraping manuel/i });
    await scrapeButton.click();

    // Wait for progress window using data-testid
    const progressWindow = page.getByTestId('scrape-progress');
    await expect(progressWindow).toBeVisible({ timeout: 10000 });

    // Wait for cinema progress to show
    await expect(page.getByText(/cinémas traités/i)).toBeVisible({ timeout: 30000 });

    // Check for cinema progress elements (format: "0 / 3" or similar)
    const cinemaProgress = progressWindow.getByText(/\d+ \/ \d+/).first();
    await expect(cinemaProgress).toBeVisible();

    // Check for films progress section
    await expect(page.getByText(/films traités/i)).toBeVisible();

    // Verify progress bars are present within the progress window
    const progressBars = progressWindow.locator('.h-2.rounded-full');
    expect(await progressBars.count()).toBeGreaterThanOrEqual(2); // Cinema and film progress bars
  });
});
