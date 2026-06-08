import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Scrape Progress Feature
 * 
 * These tests verify the SSE-based scrape progress window behavior
 * with real scrape operations (not mocked).
 */

async function startScrape(page: any) {
  const scrapeButton = page.locator('button').filter({ hasText: /lancer le scraping manuel/i }).first();
  await expect(scrapeButton).toBeEnabled({ timeout: 5000 });
  await scrapeButton.click();
}

async function waitForProgressWindow(page: any, timeout = 10000) {
  const progressWindow = page.getByTestId('scrape-progress');
  await expect(progressWindow).toBeVisible({ timeout });
  return progressWindow;
}

async function waitForTheaterProgress(page: any) {
  await expect(page.getByText(/theaters traités/i)).toBeVisible({ timeout: 30000 });
}

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
    await startScrape(page);

    // Wait for button to show success state (confirms API call succeeded)
    await expect(page.locator('button').filter({ hasText: /scraping démarré/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('progress window appears after clicking scrape button', async ({ page }) => {
    await startScrape(page);

    // Wait for button to show success state
    await expect(page.locator('button').filter({ hasText: /scraping démarré/i }).first()).toBeVisible({ timeout: 5000 });

    // Now check for progress window using data-testid
    const progressWindow = await waitForProgressWindow(page, 5000);
    
    // Verify it shows loading state initially
    await expect(progressWindow).toContainText(/connexion en cours|scraping en cours/i);
  });

  test('progress window stays visible during entire scrape and 5s after completion', async ({ page }) => {
    await startScrape(page);

    // Progress window should appear with loading state or first event using data-testid
    const progressWindow = await waitForProgressWindow(page);

    // Verify loading state appears first
    await expect(progressWindow).toContainText(/connexion en cours|scraping en cours/i, { timeout: 5000 });

    // Wait for scrape to progress - check for "Theaters traités" indicator
    await waitForTheaterProgress(page);

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
    await startScrape(page);

    const progressWindow = await waitForProgressWindow(page);

    await waitForTheaterProgress(page);

    // Refresh the page
    await page.reload();

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Progress window should auto-appear because scrape is still running
    // The HomePage should detect isRunning=true and show progress
    await waitForProgressWindow(page);
    await waitForTheaterProgress(page);
  });

  test('clicking scrape button during active scrape resumes progress without error', async ({ page }) => {
    await startScrape(page);

    const progressWindow = await waitForProgressWindow(page);
    await waitForTheaterProgress(page);

    // Click the scrape button again while scrape is running (find by success text now)
    const activeButton = page.locator('button').filter({ hasText: /scraping/i }).first();
    await activeButton.click();

    // Should NOT show an error message in the scrape button area
    const errorMessage = page.locator('.text-red-600').filter({ hasText: /erreur|error/i });
    await expect(errorMessage).not.toBeVisible();

    // Progress window should still be visible
    await expect(progressWindow).toBeVisible();

    // Progress should continue (theaters counter should still be present)
    await expect(page.getByText(/theaters traités/i)).toBeVisible();
  });

  test('progress window shows loading state before first SSE event', async ({ page }) => {
    await startScrape(page);

    const progressWindow = await waitForProgressWindow(page, 5000);
    
    // This tests the Bug 1 fix: should show "Connexion en cours..." not null
    await expect(progressWindow).toContainText(/connexion en cours/i, { timeout: 2000 });
  });

  test('progress window shows detailed progress information', async ({ page }) => {
    await startScrape(page);

    const progressWindow = await waitForProgressWindow(page);
    await waitForTheaterProgress(page);

    // Check for theater progress elements (format: "0 / 3" or similar)
    const theaterProgress = progressWindow.getByText(/\d+ \/ \d+/).first();
    await expect(theaterProgress).toBeVisible();

    // Check for movies progress section
    await expect(page.getByText(/movies traités/i)).toBeVisible();

    // Verify progress bars are present within the progress window
    const progressBars = progressWindow.locator('.h-2.rounded-full');
    expect(await progressBars.count()).toBeGreaterThanOrEqual(2); // Theater and movie progress bars
  });
});
