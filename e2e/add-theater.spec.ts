import { test, expect } from '@playwright/test';

/**
 * E2E Tests for the "Ajouter un theater" flow.
 *
 * Migrated from verification/verify_add_theater.py (Python Playwright script).
 *
 * All external API calls are intercepted so the tests run without a live
 * backend.  The mocked /api/theaters handler is stateful: a POST switches the
 * GET response so the new theater appears after the page reloads.
 */

const INITIAL_THEATERS = JSON.stringify({
  success: true,
  data: [{ id: 'C0001', name: 'Theater One', url: 'http://allocine.fr/C0001' }],
});

const UPDATED_THEATERS = JSON.stringify({
  success: true,
  data: [
    { id: 'C0001', name: 'Theater One', url: 'http://allocine.fr/C0001' },
    { id: 'C0002', name: 'Theater Two', url: 'http://allocine.fr/C0002' },
  ],
});

const NEW_THEATER_URL = 'https://www.allocine.fr/seance/salle_gen_csalle=C0002.html';

test.describe('Add Theater flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock /api/movies — empty programme
    await page.route('**/api/movies', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { movies: [], weekStart: '2023-10-25' },
        }),
      })
    );

    // Mock /api/scraper/status — not running
    await page.route('**/api/scraper/status', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { isRunning: false } }),
      })
    );

    // Stateful theaters mock: GET returns current list, POST adds a theater
    let theatersBody = INITIAL_THEATERS;

    await page.route('**/api/theaters', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: theatersBody,
        });
      } else if (route.request().method() === 'POST') {
        // Switch GET response for subsequent calls (simulates DB write + reload)
        theatersBody = UPDATED_THEATERS;
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'C0002', name: 'Theater Two', url: 'http://allocine.fr/C0002' },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/');
  });

  test('"Ajouter un theater" button is visible on the home page', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /ajouter un theater/i });
    await expect(addButton).toBeVisible();
  });

  test('clicking the button opens a prompt dialog', async ({ page }) => {
    let dialogSeen = false;

    page.once('dialog', async dialog => {
      dialogSeen = true;
      await dialog.dismiss();
    });

    await page.getByRole('button', { name: /ajouter un theater/i }).click();
    await page.waitForTimeout(500);

    expect(dialogSeen).toBe(true);
  });

  test('accepting the dialog with a valid URL adds the theater to the list', async ({ page }) => {
    // Accept the prompt with a valid AlloCiné URL
    page.once('dialog', dialog => dialog.accept(NEW_THEATER_URL));

    await page.getByRole('button', { name: /ajouter un theater/i }).click();

    // The new theater must appear in the page after the POST + reload
    await expect(page.getByText('Theater Two')).toBeVisible({ timeout: 5000 });
  });

  test('dismissing the dialog does not add a new theater', async ({ page }) => {
    page.once('dialog', dialog => dialog.dismiss());

    await page.getByRole('button', { name: /ajouter un theater/i }).click();
    await page.waitForTimeout(500);

    // Only the initial theater should be present
    await expect(page.getByText('Theater Two')).not.toBeVisible();
    await expect(page.getByText('Theater One')).toBeVisible();
  });
});
