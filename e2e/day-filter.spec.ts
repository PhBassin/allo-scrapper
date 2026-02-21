import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Day Filter Feature
 * 
 * These tests verify the day selector functionality on the home page,
 * ensuring users can filter films by specific dates.
 */

test.describe('Day Filter', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console messages
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
    
    // Navigate to home page
    await page.goto('/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('day selector is visible on home page', async ({ page }) => {
    // Wait for day selector to be visible
    await expect(page.getByText(/filtrer par jour/i)).toBeVisible({ timeout: 5000 });
    
    // Verify "Tous les jours" button is present
    const allDaysButton = page.getByTestId('day-selector-all');
    await expect(allDaysButton).toBeVisible();
    
    // Verify individual day buttons are present (at least one)
    const dayButtons = page.locator('[data-testid^="day-selector-2"]');
    expect(await dayButtons.count()).toBeGreaterThan(0);
  });

  test('default state shows all days with "Tous les jours" selected', async ({ page }) => {
    // Wait for day selector
    await expect(page.getByText(/filtrer par jour/i)).toBeVisible({ timeout: 5000 });
    
    // "Tous les jours" button should be selected (has bg-primary class)
    const allDaysButton = page.getByTestId('day-selector-all');
    await expect(allDaysButton).toHaveClass(/bg-primary/);
    
    // Page title should show "Au programme cette semaine"
    await expect(page.getByText(/au programme cette semaine/i)).toBeVisible();
  });

  test('clicking a specific day filters films and updates title', async ({ page }) => {
    // Wait for day selector
    await expect(page.getByText(/filtrer par jour/i)).toBeVisible({ timeout: 5000 });
    
    // Get the first day button (should be a date like 2025-02-17)
    const firstDayButton = page.locator('[data-testid^="day-selector-2"]').first();
    await expect(firstDayButton).toBeVisible();
    
    // Click the first day
    await firstDayButton.click();
    
    // Wait for page to reload with filtered data
    await page.waitForLoadState('networkidle');
    
    // Title should change to "Films du jour"
    await expect(page.getByText(/films du jour/i)).toBeVisible({ timeout: 5000 });
    
    // The clicked button should now be selected (has bg-primary class)
    await expect(firstDayButton).toHaveClass(/bg-primary/);
    
    // "Tous les jours" should no longer be selected
    const allDaysButton = page.getByTestId('day-selector-all');
    await expect(allDaysButton).not.toHaveClass(/bg-primary/);
  });

  test('clicking "Tous les jours" resets filter to show all films', async ({ page }) => {
    // Wait for day selector
    await expect(page.getByText(/filtrer par jour/i)).toBeVisible({ timeout: 5000 });
    
    // Click a specific day first
    const firstDayButton = page.locator('[data-testid^="day-selector-2"]').first();
    await firstDayButton.click();
    await page.waitForLoadState('networkidle');
    
    // Verify we're in filtered state
    await expect(page.getByText(/films du jour/i)).toBeVisible({ timeout: 5000 });
    
    // Click "Tous les jours" to reset
    const allDaysButton = page.getByTestId('day-selector-all');
    await allDaysButton.click();
    await page.waitForLoadState('networkidle');
    
    // Title should return to "Au programme cette semaine"
    await expect(page.getByText(/au programme cette semaine/i)).toBeVisible({ timeout: 5000 });
    
    // "Tous les jours" should be selected again
    await expect(allDaysButton).toHaveClass(/bg-primary/);
  });

  test('selected date displays in the header', async ({ page }) => {
    // Wait for day selector
    await expect(page.getByText(/filtrer par jour/i)).toBeVisible({ timeout: 5000 });
    
    // Click a specific day
    const firstDayButton = page.locator('[data-testid^="day-selector-2"]').first();
    await firstDayButton.click();
    await page.waitForLoadState('networkidle');
    
    // Should show "Date sélectionnée" label
    await expect(page.getByText(/date sélectionnée/i)).toBeVisible({ timeout: 5000 });
    
    // Should show a formatted date in the header next to "Date sélectionnée"
    // Look specifically within the header section for the date
    const headerSection = page.locator('.flex.items-center.gap-2.text-gray-500');
    await expect(headerSection).toContainText(/\d{1,2}\s+[a-zéèêàù]+\s+\d{4}/i);
  });

  test('day filter persists state when navigating between days', async ({ page }) => {
    // Wait for day selector
    await expect(page.getByText(/filtrer par jour/i)).toBeVisible({ timeout: 5000 });
    
    // Get day buttons
    const dayButtons = page.locator('[data-testid^="day-selector-2"]');
    const dayCount = await dayButtons.count();
    
    // Ensure we have at least 2 days to test navigation
    expect(dayCount).toBeGreaterThanOrEqual(2);
    
    // Click first day
    const firstDay = dayButtons.nth(0);
    await firstDay.click();
    await page.waitForLoadState('networkidle');
    await expect(firstDay).toHaveClass(/bg-primary/);
    
    // Click second day
    const secondDay = dayButtons.nth(1);
    await secondDay.click();
    await page.waitForLoadState('networkidle');
    
    // Second day should be selected
    await expect(secondDay).toHaveClass(/bg-primary/);
    
    // First day should no longer be selected
    await expect(firstDay).not.toHaveClass(/bg-primary/);
    
    // Title should still show "Films du jour"
    await expect(page.getByText(/films du jour/i)).toBeVisible();
  });

  test('day selector shows 7 day buttons plus "Tous les jours"', async ({ page }) => {
    // Wait for day selector
    await expect(page.getByText(/filtrer par jour/i)).toBeVisible({ timeout: 5000 });
    
    // Count day buttons (should be 7 days)
    const dayButtons = page.locator('[data-testid^="day-selector-2"]');
    expect(await dayButtons.count()).toBe(7);
    
    // Plus the "Tous les jours" button
    await expect(page.getByTestId('day-selector-all')).toBeVisible();
  });

  test('empty state message updates based on filter', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // If there are no films, we should see the empty state
    // This test checks that the empty message changes based on filter state
    
    // Check if films are present first
    const filmsPresent = await page.locator('[data-testid="film-card"]').count() > 0;
    
    if (!filmsPresent) {
      // In "all days" mode, should show generic empty message
      await expect(page.getByText(/aucun film programmé pour le moment/i)).toBeVisible();
      
      // Click a specific day
      const firstDayButton = page.locator('[data-testid^="day-selector-2"]').first();
      await firstDayButton.click();
      await page.waitForLoadState('networkidle');
      
      // In filtered mode, should show date-specific empty message
      await expect(page.getByText(/aucun film programmé pour cette date/i)).toBeVisible();
    }
  });

  test('day selector buttons have proper hover states', async ({ page }) => {
    // Wait for day selector
    await expect(page.getByText(/filtrer par jour/i)).toBeVisible({ timeout: 5000 });
    
    // Get day buttons
    const allDaysButton = page.getByTestId('day-selector-all');
    const firstDayButton = page.locator('[data-testid^="day-selector-2"]').first();
    
    // Click first day to make "Tous les jours" non-selected
    await firstDayButton.click();
    await page.waitForLoadState('networkidle');
    
    // Non-selected button ("Tous les jours") should have specific styling
    // Check that it has the non-selected background color
    await expect(allDaysButton).toHaveClass(/bg-gray-50/);
    
    // Verify the selected button has the primary background
    await expect(firstDayButton).toHaveClass(/bg-primary/);
  });

  test('day filter works with scrape operation', async ({ page }, testInfo) => {
    // Increase test timeout for this specific test
    testInfo.setTimeout(60000); // 1 minute
    
    // Wait for day selector
    await expect(page.getByText(/filtrer par jour/i)).toBeVisible({ timeout: 5000 });
    
    // Select a specific day
    const firstDayButton = page.locator('[data-testid^="day-selector-2"]').first();
    await firstDayButton.click();
    await page.waitForLoadState('networkidle');
    
    // Verify filter is active
    await expect(page.getByText(/films du jour/i)).toBeVisible();
    
    // Start a scrape
    const scrapeButton = page.locator('button').filter({ hasText: /lancer le scraping manuel/i }).first();
    if (await scrapeButton.isVisible()) {
      await scrapeButton.click();
      
      // Wait for scrape to start
      const progressWindow = page.getByTestId('scrape-progress');
      await expect(progressWindow).toBeVisible({ timeout: 10000 });
      
      // Day selector should still show selected day during scrape
      await expect(firstDayButton).toHaveClass(/bg-primary/);
      
      // Wait a bit for scrape to progress
      await page.waitForTimeout(3000);
      
      // Verify filter state is maintained during the scrape
      // The button should still be selected
      await expect(firstDayButton).toHaveClass(/bg-primary/);
      
      // Verify the title still shows the filtered view
      await expect(page.getByText(/films du jour/i)).toBeVisible();
    }
  });
});
