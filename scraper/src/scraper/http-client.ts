// HTTP client for fetching theater and movie pages from source website

import puppeteer, { type Browser } from 'puppeteer-core';
import { logger } from '../utils/logger.js';
import { ALLOCINE_BASE_URL } from './utils.js';
import { HttpError, RateLimitError } from '../utils/errors.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Validates theater ID format (e.g., "C0072", "W7517")
 * @throws {Error} if format is invalid
 */
function validateTheaterId(theaterId: string): void {
  // Theater IDs must match: letter + 4-5 digits
  if (!/^[A-Z]\d{4,5}$/.test(theaterId)) {
    throw new Error(`Invalid theater ID format: ${theaterId}`);
  }
}

/**
 * Validates date format (YYYY-MM-DD)
 * @throws {Error} if format is invalid or not a real date
 */
function validateDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date}`);
  }
  // Validate it's a real date
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
}

/**
 * Validates movie ID format (must be a positive integer)
 * @throws {Error} if format is invalid
 */
function validateMovieId(movieId: number): void {
  if (!Number.isInteger(movieId) || movieId <= 0) {
    throw new Error(`Invalid movie ID: ${movieId}`);
  }
}

// Shared browser instance to avoid launching a new browser for every request
let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium-headless-shell',
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
 * Load the theater page once using Puppeteer to get:
 * - Theater metadata (data-theater attribute)
 * - Available showtime dates (data-showtimes-dates attribute)
 *
 * No date clicking is performed. Showtimes for each date are fetched
 * separately via the JSON API (fetchShowtimesJson).
 */
export async function fetchTheaterPage(theaterBaseUrl: string): Promise<TheaterInitialData> {
  const browser = await getBrowser();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  try {
    await page.setUserAgent(USER_AGENT);
    logger.info('Loading theater page', { url: theaterBaseUrl });
    await page.goto(theaterBaseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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
 * @param theaterId - e.g. "C0072"
 * @param date     - e.g. "2026-02-22"
 */
export async function fetchShowtimesJson(theaterId: string, date: string): Promise<unknown> {
  // Validate inputs before using in URL to prevent SSRF
  validateTheaterId(theaterId);
  validateDate(date);

  // Construct URL via URL object and re-validate hostname to satisfy SSRF guard.
  // Even though theaterId and date are already strictly validated above, building
  // the URL with new URL() and asserting the final hostname prevents any future
  // taint from reaching the fetch call.
  const constructed = new URL(`/_/showtimes/theater-${theaterId}/d-${date}/`, ALLOCINE_BASE_URL);
  if (constructed.hostname !== 'www.allocine.fr' || constructed.protocol !== 'https:') {
    throw new Error(`SSRF guard: unexpected host in constructed URL ${constructed.href}`);
  }
  const url = constructed.href;
  logger.info('Fetching showtimes JSON', { url });

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'Accept-Language': 'fr-FR,fr;q=0.9',
      Referer: `${ALLOCINE_BASE_URL}/seance/salle_gen_csalle=${theaterId}.html`,
    },
  });

  if (!response.ok) {
    // Detect rate limiting specifically
    if (response.status === 429) {
      throw new RateLimitError(
        `Rate limit exceeded for ${theaterId} on ${date}`,
        response.status,
        url
      );
    }

    // Throw generic HttpError for other failures
    throw new HttpError(
      `Failed to fetch showtimes JSON for ${theaterId} on ${date}: ${response.status} ${response.statusText}`,
      response.status,
      url
    );
  }

  return response.json();
}

export async function fetchMoviePage(movieId: number): Promise<string> {
  // Validate input before using in URL to prevent SSRF
  validateMovieId(movieId);

  // Construct URL via URL object and re-validate hostname (SSRF guard).
  const constructed = new URL(`/film/fichefilm_gen_cfilm=${movieId}.html`, ALLOCINE_BASE_URL);
  if (constructed.hostname !== 'www.allocine.fr' || constructed.protocol !== 'https:') {
    throw new Error(`SSRF guard: unexpected host in constructed URL ${constructed.href}`);
  }
  const url = constructed.href;

  logger.info('Fetching movie page', { url });

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    // Detect rate limiting specifically
    if (response.status === 429) {
      throw new RateLimitError(
        `Rate limit exceeded for movie ${movieId}`,
        response.status,
        url
      );
    }

    // Throw generic HttpError for other failures
    throw new HttpError(
      `Failed to fetch movie page ${movieId}: ${response.status} ${response.statusText}`,
      response.status,
      url
    );
  }

  return response.text();
}

// Ajouter un délai entre les requêtes pour éviter le rate limiting
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
