// HTTP client for fetching cinema and film pages from source website

import { chromium, type Browser } from 'playwright';
import { logger } from '../utils/logger.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ALLOCINE_BASE_URL = 'https://www.allocine.fr';

// Shared browser instance to avoid launching a new browser for every request
let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return _browser;
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

export interface TheaterInitialData {
  html: string;           // Full initial HTML (for theater metadata parsing)
  availableDates: string[]; // Parsed data-showtimes-dates
}

/**
 * Load the theater page once using Playwright to get:
 * - Theater metadata (data-theater attribute)
 * - Available showtime dates (data-showtimes-dates attribute)
 *
 * No date clicking is performed. Showtimes for each date are fetched
 * separately via the JSON API (fetchShowtimesJson).
 */
export async function fetchTheaterPage(cinemaBaseUrl: string): Promise<TheaterInitialData> {
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    logger.info('Loading theater page', { url: cinemaBaseUrl });
    await page.goto(cinemaBaseUrl, { waitUntil: 'networkidle', timeout: 60000 });

    const html = await page.content();

    // Extract available dates from the data-showtimes-dates attribute
    const availableDates = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (globalThis as any).document?.querySelector('#theaterpage-showtimes-index-ui');
      const raw = el?.getAttribute('data-showtimes-dates');
      if (!raw) return [] as string[];
      try { return JSON.parse(raw) as string[]; } catch { return [] as string[]; }
    });

    logger.info('Available dates on page', { dates: availableDates });
    return { html, availableDates };
  } finally {
    await context.close();
  }
}

/**
 * Fetch the showtimes JSON for a specific date from the Allociné internal API.
 * This is a plain HTTP request — no browser needed.
 *
 * @param cinemaId - e.g. "C0072"
 * @param date     - e.g. "2026-02-22"
 */
export async function fetchShowtimesJson(cinemaId: string, date: string): Promise<unknown> {
  const url = `${ALLOCINE_BASE_URL}/_/showtimes/theater-${cinemaId}/d-${date}/`;
  logger.info('Fetching showtimes JSON', { url });

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'Accept-Language': 'fr-FR,fr;q=0.9',
      Referer: `${ALLOCINE_BASE_URL}/seance/salle_gen_csalle=${cinemaId}.html`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch showtimes JSON for ${cinemaId} on ${date}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchFilmPage(filmId: number): Promise<string> {
  const url = `${ALLOCINE_BASE_URL}/film/fichefilm_gen_cfilm=${filmId}.html`;

  logger.info('Fetching film page', { url });

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch film page ${filmId}: ${response.status} ${response.statusText}`
    );
  }

  return response.text();
}

// Ajouter un délai entre les requêtes pour éviter le rate limiting
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
