// HTTP client for fetching cinema and film pages from source website

import puppeteer, { type Browser } from 'puppeteer-core';
import { logger } from '../utils/logger.js';
import { ALLOCINE_BASE_URL } from './utils.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── Retry configuration ──────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_JITTER_MS = 500;

/**
 * Fetch with automatic retry, exponential backoff, Retry-After support, jitter,
 * and AbortSignal.timeout.
 *
 * Retries on:
 *  - HTTP 429 (Too Many Requests)
 *  - HTTP 5xx (server errors)
 *  - Network errors (TypeError from fetch)
 *
 * @param url     - The URL to fetch
 * @param options - Standard RequestInit options (signal will be overridden)
 * @returns       - The Response object
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      // Success — return immediately
      if (response.ok) return response;

      // Retryable HTTP status: 429 or 5xx
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(
          `HTTP ${response.status} ${response.statusText} for ${url}`
        );

        if (attempt < MAX_RETRIES) {
          const delayMs = computeRetryDelay(attempt, response);
          logger.warn('Retryable HTTP error, backing off', {
            url,
            status: response.status,
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            delayMs,
          });
          await delay(delayMs);
          continue;
        }
      }

      // Non-retryable HTTP error — throw immediately
      throw new Error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`
      );
    } catch (error) {
      lastError = error;

      // AbortError / TimeoutError from AbortSignal.timeout — retryable
      // Network errors (TypeError) — retryable
      const isRetryable =
        error instanceof TypeError ||
        (error instanceof DOMException && error.name === 'TimeoutError') ||
        (error instanceof DOMException && error.name === 'AbortError');

      if (isRetryable && attempt < MAX_RETRIES) {
        const delayMs = computeRetryDelay(attempt);
        logger.warn('Network/timeout error, retrying', {
          url,
          error: error instanceof Error ? error.message : String(error),
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          delayMs,
        });
        await delay(delayMs);
        continue;
      }

      throw error;
    }
  }

  // Should never reach here, but just in case
  throw lastError;
}

/**
 * Compute retry delay with exponential backoff + jitter.
 * Respects Retry-After header if present.
 */
function computeRetryDelay(attempt: number, response?: Response): number {
  // Check Retry-After header (seconds or HTTP-date)
  if (response) {
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds > 0) {
        // Clamp to max 60 seconds to avoid absurdly long waits
        return Math.min(seconds * 1000, 60_000);
      }
      // Try parsing as HTTP-date
      const date = new Date(retryAfter);
      if (!isNaN(date.getTime())) {
        const ms = date.getTime() - Date.now();
        if (ms > 0) return Math.min(ms, 60_000);
      }
    }
  }

  // Exponential backoff: 1s, 2s, 4s, ... + random jitter up to 500ms
  const exponential = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * MAX_JITTER_MS;
  return exponential + jitter;
}

/**
 * Validates cinema ID format (e.g., "C0072", "W7517")
 * @throws {Error} if format is invalid
 */
function validateCinemaId(cinemaId: string): void {
  // Cinema IDs must match: letter + 4-5 digits
  if (!/^[A-Z]\d{4,5}$/.test(cinemaId)) {
    throw new Error(`Invalid cinema ID format: ${cinemaId}`);
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
 * Validates film ID format (must be a positive integer)
 * @throws {Error} if format is invalid
 */
function validateFilmId(filmId: number): void {
  if (!Number.isInteger(filmId) || filmId <= 0) {
    throw new Error(`Invalid film ID: ${filmId}`);
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
export async function fetchTheaterPage(cinemaBaseUrl: string): Promise<TheaterInitialData> {
  const browser = await getBrowser();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  try {
    await page.setUserAgent(USER_AGENT);
    logger.info('Loading theater page', { url: cinemaBaseUrl });
    await page.goto(cinemaBaseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

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
  // Validate inputs before using in URL to prevent SSRF
  validateCinemaId(cinemaId);
  validateDate(date);

  // Construct URL via URL object and re-validate hostname to satisfy SSRF guard.
  // Even though cinemaId and date are already strictly validated above, building
  // the URL with new URL() and asserting the final hostname prevents any future
  // taint from reaching the fetch call.
  const constructed = new URL(`/_/showtimes/theater-${cinemaId}/d-${date}/`, ALLOCINE_BASE_URL);
  if (constructed.hostname !== 'www.allocine.fr' || constructed.protocol !== 'https:') {
    throw new Error(`SSRF guard: unexpected host in constructed URL ${constructed.href}`);
  }
  const url = constructed.href;
  logger.info('Fetching showtimes JSON', { url });

  const response = await fetchWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'Accept-Language': 'fr-FR,fr;q=0.9',
      Referer: `${ALLOCINE_BASE_URL}/seance/salle_gen_csalle=${cinemaId}.html`,
    },
  });

  return response.json();
}

export async function fetchFilmPage(filmId: number): Promise<string> {
  // Validate input before using in URL to prevent SSRF
  validateFilmId(filmId);

  // Construct URL via URL object and re-validate hostname (SSRF guard).
  const constructed = new URL(`/film/fichefilm_gen_cfilm=${filmId}.html`, ALLOCINE_BASE_URL);
  if (constructed.hostname !== 'www.allocine.fr' || constructed.protocol !== 'https:') {
    throw new Error(`SSRF guard: unexpected host in constructed URL ${constructed.href}`);
  }
  const url = constructed.href;

  logger.info('Fetching film page', { url });

  const response = await fetchWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
    },
  });

  return response.text();
}

// Ajouter un délai entre les requêtes pour éviter le rate limiting
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
