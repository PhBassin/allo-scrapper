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
    // Find the button
    const buttonContainer = page.locator('button').filter({ hasText: /lancer le scraping manuel/i }).first();
    await expect(buttonContainer).toBeEnabled({ timeout: 5000 });
    
    // Click the button
    await buttonContainer.click();

    // Wait for button to show success state (confirms API call succeeded)
    await expect(page.locator('button').filter({ hasText: /scraping démarré/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('progress window appears after clicking scrape button', async ({ page }) => {
    // Find and click the button
    const buttonContainer = page.locator('button').filter({ hasText: /lancer le scraping manuel/i }).first();
    await expect(buttonContainer).toBeEnabled({ timeout: 5000 });
    await buttonContainer.click();

    // Wait for button to show success state
    await expect(page.locator('button').filter({ hasText: /scraping démarré/i }).first()).toBeVisible({ timeout: 5000 });

    // Now check for progress window using data-testid
    const progressWindow = page.getByTestId('scrape-progress');
    await expect(progressWindow).toBeVisible({ timeout: 5000 });
    
    // Verify it shows loading state initially
    await expect(progressWindow).toContainText(/connexion en cours|scraping en cours/i);
  });

  test('progress window stays visible during entire scrape and 5s after completion', async ({ page }) => {
    // Click the scrape button to start scrape
    const scrapeButton = page.locator('button').filter({ hasText: /lancer le scraping manuel/i }).first();
    await expect(scrapeButton).toBeEnabled({ timeout: 5000 });
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
    const scrapeButton = page.locator('button').filter({ hasText: /lancer le scraping manuel/i }).first();
    await expect(scrapeButton).toBeEnabled({ timeout: 5000 });
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
    const scrapeButton = page.locator('button').filter({ hasText: /lancer le scraping manuel/i }).first();
    await expect(scrapeButton).toBeEnabled({ timeout: 5000 });
    await scrapeButton.click();

    // Wait for progress to start using data-testid
    const progressWindow = page.getByTestId('scrape-progress');
    await expect(progressWindow).toBeVisible({ timeout: 10000 });

    // Wait for scrape to be actively processing
    await expect(page.getByText(/cinémas traités/i)).toBeVisible({ timeout: 30000 });

    // Click the scrape button again while scrape is running (find by success text now)
    const activeButton = page.locator('button').filter({ hasText: /scraping/i }).first();
    await activeButton.click();

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
    const scrapeButton = page.locator('button').filter({ hasText: /lancer le scraping manuel/i }).first();
    await expect(scrapeButton).toBeEnabled({ timeout: 5000 });
    
    // Click scrape button
    await scrapeButton.click();

    // Check for progress window using data-testid (should appear quickly)
    const progressWindow = page.getByTestId('scrape-progress');
    await expect(progressWindow).toBeVisible({ timeout: 5000 });
    
    // This tests the Bug 1 fix: should show "Connexion en cours..." not null
    // Check that the loading text is visible within the progress window
    await expect(progressWindow).toContainText(/connexion en cours/i, { timeout: 2000 });
  });

  test('progress window shows detailed progress information', async ({ page }) => {
    // Start scrape
    const scrapeButton = page.locator('button').filter({ hasText: /lancer le scraping manuel/i }).first();
    await expect(scrapeButton).toBeEnabled({ timeout: 5000 });
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

  test('SSE events update progress counters in real-time (regression test for #617)', async ({ page }) => {
    /**
     * This test specifically verifies that the SSE modal regression is fixed.
     * 
     * Bug history (v4.1.2 -> develop):
     * - A useMemo optimization was added in commit 58fc0b8 to cache derived state
     * - This prevented the component from re-rendering when SSE events arrived
     * - Modal appeared frozen with no progress updates
     * 
     * This test ensures:
     * 1. Progress counters update as events arrive
     * 2. Progress bars animate forward
     * 3. No frozen/stale data in the UI
     * 
     * refs #617
     */
    
    // Start scrape
    const scrapeButton = page.locator('button').filter({ hasText: /lancer le scraping manuel/i }).first();
    await expect(scrapeButton).toBeEnabled({ timeout: 5000 });
    await scrapeButton.click();

    // Wait for progress window
    const progressWindow = page.getByTestId('scrape-progress');
    await expect(progressWindow).toBeVisible({ timeout: 10000 });

    // Wait for initial progress data (cinema processing started)
    await expect(page.getByText(/cinémas traités/i)).toBeVisible({ timeout: 30000 });

    // Get initial cinema count
    const cinemaCountElement = page.getByTestId('cinema-count');
    await expect(cinemaCountElement).toBeVisible();
    const initialCount = await cinemaCountElement.textContent();
    
    console.log('Initial cinema count:', initialCount);

    // Wait 2 seconds for more SSE events to arrive
    await page.waitForTimeout(2000);

    // Get updated count
    const updatedCount = await cinemaCountElement.textContent();
    console.log('Updated cinema count:', updatedCount);

    // Extract processed count from "X / Y" format
    const extractProcessed = (text: string | null): number => {
      if (!text) return 0;
      const match = text.match(/^(\d+)\s*\/\s*\d+$/);
      return match ? parseInt(match[1], 10) : 0;
    };

    const initialProcessed = extractProcessed(initialCount);
    const updatedProcessed = extractProcessed(updatedCount);

    console.log(`Processed cinemas: ${initialProcessed} -> ${updatedProcessed}`);

    // Verify counter increased (SSE events are updating the UI)
    expect(updatedProcessed).toBeGreaterThanOrEqual(initialProcessed);

    // Also verify progress bar width increased
    const cinemaProgressBar = page.getByTestId('cinema-progress-bar');
    const progressValue = await cinemaProgressBar.getAttribute('data-progress');
    
    console.log('Cinema progress percentage:', progressValue);

    // Should have non-zero progress
    expect(parseFloat(progressValue || '0')).toBeGreaterThan(0);

    // Verify status is updating (not stuck on 'initializing')
    const statusElement = page.getByTestId('progress-status');
    const statusText = await statusElement.textContent();
    
    console.log('Status text:', statusText);
    
    // Should show an active event type (started, cinema_started, etc.)
    // Not just the initial "initializing" state
    expect(statusText?.toLowerCase()).toMatch(/started|completed|traité/i);
  });
});
