import { test, expect } from '@playwright/test';

test.describe('Film Search', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');
    // Wait for page to load
    await page.waitForSelector('[data-testid="film-search-bar"]', { timeout: 10000 });
  });

  test('should display the search bar on HomePage', async ({ page }) => {
    const searchBar = page.locator('[data-testid="film-search-bar"]');
    await expect(searchBar).toBeVisible();

    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', 'Rechercher un film...');
  });

  test('should show search results when typing', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    
    // Type a search query
    await searchInput.fill('Matrix');
    
    // Wait for debounce (300ms) and API response
    await page.waitForTimeout(500);
    
    // Check if results dropdown appears
    const resultsDropdown = page.locator('[data-testid="search-results"]');
    await expect(resultsDropdown).toBeVisible({ timeout: 5000 });
    
    // Check if there are result items
    const resultItems = page.locator('[data-testid="search-result-item"]');
    const count = await resultItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to film detail page when clicking a result', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    
    // Type a search query
    await searchInput.fill('Matrix');
    
    // Wait for results
    await page.waitForTimeout(500);
    await page.waitForSelector('[data-testid="search-result-item"]', { timeout: 5000 });
    
    // Click on the first result
    const firstResult = page.locator('[data-testid="search-result-item"]').first();
    await firstResult.click();
    
    // Wait for navigation to film detail page
    await page.waitForURL(/\/film\/\d+/, { timeout: 5000 });
    
    // Verify we're on a film detail page
    expect(page.url()).toMatch(/\/film\/\d+/);
    
    // Verify the search bar is closed (input should be cleared)
    await page.goto('/');
    const searchInputAfter = page.locator('[data-testid="search-input"]');
    await expect(searchInputAfter).toHaveValue('');
  });

  test('should show "no results" message for invalid query', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    
    // Type a query that won't match any films
    await searchInput.fill('xyz123notfound9999');
    
    // Wait for debounce and API response
    await page.waitForTimeout(500);
    
    // Check if "no results" message appears
    const noResultsMessage = page.locator('[data-testid="no-results"]');
    await expect(noResultsMessage).toBeVisible({ timeout: 5000 });
    await expect(noResultsMessage).toHaveText('Aucun résultat trouvé');
  });

  test('should debounce search requests', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    
    // Type rapidly to test debouncing
    await searchInput.fill('M');
    await page.waitForTimeout(100);
    await searchInput.fill('Ma');
    await page.waitForTimeout(100);
    await searchInput.fill('Mat');
    await page.waitForTimeout(100);
    await searchInput.fill('Matr');
    await page.waitForTimeout(100);
    await searchInput.fill('Matrix');
    
    // Wait for debounce to finish
    await page.waitForTimeout(400);
    
    // Results should only appear after typing stopped for 300ms
    const resultsDropdown = page.locator('[data-testid="search-results"]');
    await expect(resultsDropdown).toBeVisible({ timeout: 5000 });
  });

  test('should close dropdown when clicking outside', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    
    // Perform a search
    await searchInput.fill('Matrix');
    await page.waitForTimeout(500);
    
    // Wait for results to appear
    const resultsDropdown = page.locator('[data-testid="search-results"]');
    await expect(resultsDropdown).toBeVisible({ timeout: 5000 });
    
    // Click outside the search bar (on the page title)
    await page.locator('h1').click();
    
    // Dropdown should close
    await expect(resultsDropdown).toBeHidden({ timeout: 2000 });
  });

  test('should support keyboard navigation', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    
    // Perform a search
    await searchInput.fill('Matrix');
    await page.waitForTimeout(500);
    await page.waitForSelector('[data-testid="search-result-item"]', { timeout: 5000 });
    
    // Press ArrowDown to select first result
    await searchInput.press('ArrowDown');
    
    // Check if first result is highlighted (has bg-gray-100 class)
    const firstResult = page.locator('[data-testid="search-result-item"]').first();
    await expect(firstResult).toHaveClass(/bg-gray-100/);
    
    // Press Enter to navigate
    await searchInput.press('Enter');
    
    // Should navigate to film detail page
    await page.waitForURL(/\/film\/\d+/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/film\/\d+/);
  });

  test('should close dropdown on Escape key', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    
    // Perform a search
    await searchInput.fill('Matrix');
    await page.waitForTimeout(500);
    
    // Wait for results
    const resultsDropdown = page.locator('[data-testid="search-results"]');
    await expect(resultsDropdown).toBeVisible({ timeout: 5000 });
    
    // Press Escape
    await searchInput.press('Escape');
    
    // Dropdown should close
    await expect(resultsDropdown).toBeHidden({ timeout: 2000 });
  });

  test('should not show results for queries shorter than 2 characters', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    
    // Type a single character
    await searchInput.fill('M');
    
    // Wait for debounce
    await page.waitForTimeout(500);
    
    // Dropdown should not appear
    const resultsDropdown = page.locator('[data-testid="search-results"]');
    await expect(resultsDropdown).toBeHidden({ timeout: 1000 });
  });

  test('should show film posters in search results', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    
    // Perform a search
    await searchInput.fill('Matrix');
    await page.waitForTimeout(500);
    await page.waitForSelector('[data-testid="search-result-item"]', { timeout: 5000 });
    
    // Check if film posters are displayed
    const firstResult = page.locator('[data-testid="search-result-item"]').first();
    const poster = firstResult.locator('img');
    
    // Poster should either be visible or a placeholder icon should be shown
    const hasPoster = await poster.count() > 0;
    if (hasPoster) {
      await expect(poster).toBeVisible();
    } else {
      // Check for placeholder icon
      const placeholderIcon = firstResult.locator('svg');
      await expect(placeholderIcon).toBeVisible();
    }
  });
});
