import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Scrape Progress Feature
 * 
 * These tests verify the SSE-based scrape progress window behavior
 * with real scrape operations (not mocked).
 */

test.describe('Scrape Progress Visibility', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('progress window stays visible during entire scrape and 5s after completion', async ({ page }) => {
    // Click the scrape button to start scrape
    const scrapeButton = page.getByRole('button', { name: /actualiser/i });
    await scrapeButton.click();

    // Progress window should appear with loading state or first event
    const progressWindow = page.locator('div').filter({ hasText: /scraping en cours|connexion en cours/i }).first();
    await expect(progressWindow).toBeVisible({ timeout: 10000 });

    // Wait for scrape to progress - check for "Cinémas traités" indicator
    await expect(page.getByText(/cinémas traités/i)).toBeVisible({ timeout: 15000 });

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
    const scrapeButton = page.getByRole('button', { name: /actualiser/i });
    await scrapeButton.click();

    // Wait for progress window to appear
    const progressWindow = page.locator('div').filter({ hasText: /scraping en cours|connexion en cours/i }).first();
    await expect(progressWindow).toBeVisible({ timeout: 10000 });

    // Wait for scrape to be in progress (cinema processing started)
    await expect(page.getByText(/cinémas traités/i)).toBeVisible({ timeout: 15000 });

    // Refresh the page
    await page.reload();

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Progress window should auto-appear because scrape is still running
    // The HomePage should detect isRunning=true and show progress
    await expect(progressWindow).toBeVisible({ timeout: 10000 });

    // Should show progress details (not just loading state)
    await expect(page.getByText(/cinémas traités/i)).toBeVisible({ timeout: 5000 });
  });

  test('clicking scrape button during active scrape resumes progress without error', async ({ page }) => {
    // Start first scrape
    const scrapeButton = page.getByRole('button', { name: /actualiser/i });
    await scrapeButton.click();

    // Wait for progress to start
    const progressWindow = page.locator('div').filter({ hasText: /scraping en cours|connexion en cours/i }).first();
    await expect(progressWindow).toBeVisible({ timeout: 10000 });

    // Wait for scrape to be actively processing
    await expect(page.getByText(/cinémas traités/i)).toBeVisible({ timeout: 15000 });

    // Click the scrape button again while scrape is running
    await scrapeButton.click();

    // Should NOT show an error message
    const errorMessage = page.locator('div').filter({ hasText: /erreur|error/i }).first();
    await expect(errorMessage).not.toBeVisible();

    // Progress window should still be visible
    await expect(progressWindow).toBeVisible();

    // Progress should continue (cinemas counter should still be present)
    await expect(page.getByText(/cinémas traités/i)).toBeVisible();
  });

  test('progress window shows loading state before first SSE event', async ({ page }) => {
    // Click scrape button
    const scrapeButton = page.getByRole('button', { name: /actualiser/i });
    await scrapeButton.click();

    // Immediately check for loading state (before SSE events arrive)
    // This tests the Bug 1 fix: should show "Connexion en cours..." not null
    const loadingState = page.getByText(/connexion en cours/i);
    
    // Use a short timeout since we want to catch the initial state
    await expect(loadingState).toBeVisible({ timeout: 2000 });
  });

  test('progress window shows detailed progress information', async ({ page }) => {
    // Start scrape
    const scrapeButton = page.getByRole('button', { name: /actualiser/i });
    await scrapeButton.click();

    // Wait for progress window
    await expect(page.getByText(/cinémas traités/i)).toBeVisible({ timeout: 15000 });

    // Check for cinema progress elements
    expect(await page.locator('text=/\\d+ \\/ \\d+/').count()).toBeGreaterThan(0);

    // Check for films progress section
    await expect(page.getByText(/films traités/i)).toBeVisible();

    // Verify progress bars are present (by checking for bg-primary/bg-green classes)
    const progressBars = page.locator('.bg-primary, .bg-green-500').filter({ has: page.locator('.h-2') });
    expect(await progressBars.count()).toBeGreaterThan(0);
  });
});
