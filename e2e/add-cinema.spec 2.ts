import { test, expect } from '@playwright/test';

/**
 * E2E Tests for the "Ajouter un cinéma" flow.
 *
 * Migrated from verification/verify_add_cinema.py (Python Playwright script).
 *
 * All external API calls are intercepted so the tests run without a live
 * backend.  The mocked /api/cinemas handler is stateful: a POST switches the
 * GET response so the new cinema appears after the page reloads.
 */

const INITIAL_CINEMAS = JSON.stringify({
  success: true,
  data: [{ id: 'C0001', name: 'Cinema One', url: 'http://allocine.fr/C0001' }],
});

const UPDATED_CINEMAS = JSON.stringify({
  success: true,
  data: [
    { id: 'C0001', name: 'Cinema One', url: 'http://allocine.fr/C0001' },
    { id: 'C0002', name: 'Cinema Two', url: 'http://allocine.fr/C0002' },
  ],
});

const NEW_CINEMA_URL = 'https://www.allocine.fr/seance/salle_gen_csalle=C0002.html';

test.describe('Add Cinema flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock /api/films — empty programme
    await page.route('**/api/films', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { films: [], weekStart: '2023-10-25' },
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

    // Stateful cinemas mock: GET returns current list, POST adds a cinema
    let cinemasBody = INITIAL_CINEMAS;

    await page.route('**/api/cinemas', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: cinemasBody,
        });
      } else if (route.request().method() === 'POST') {
        // Switch GET response for subsequent calls (simulates DB write + reload)
        cinemasBody = UPDATED_CINEMAS;
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'C0002', name: 'Cinema Two', url: 'http://allocine.fr/C0002' },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/');
  });

  test('"Ajouter un cinéma" button is visible on the home page', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /ajouter un cinéma/i });
    await expect(addButton).toBeVisible();
  });

  test('clicking the button opens a prompt dialog', async ({ page }) => {
    let dialogSeen = false;

    page.once('dialog', async dialog => {
      dialogSeen = true;
      await dialog.dismiss();
    });

    await page.getByRole('button', { name: /ajouter un cinéma/i }).click();
    await page.waitForTimeout(500);

    expect(dialogSeen).toBe(true);
  });

  test('accepting the dialog with a valid URL adds the cinema to the list', async ({ page }) => {
    // Accept the prompt with a valid AlloCiné URL
    page.once('dialog', dialog => dialog.accept(NEW_CINEMA_URL));

    await page.getByRole('button', { name: /ajouter un cinéma/i }).click();

    // The new cinema must appear in the page after the POST + reload
    await expect(page.getByText('Cinema Two')).toBeVisible({ timeout: 5000 });
  });

  test('dismissing the dialog does not add a new cinema', async ({ page }) => {
    page.once('dialog', dialog => dialog.dismiss());

    await page.getByRole('button', { name: /ajouter un cinéma/i }).click();
    await page.waitForTimeout(500);

    // Only the initial cinema should be present
    await expect(page.getByText('Cinema Two')).not.toBeVisible();
    await expect(page.getByText('Cinema One')).toBeVisible();
  });
});
