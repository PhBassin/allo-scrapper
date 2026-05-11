// HTTP client for fetching cinema and movie pages from source website

import puppeteer, { type Browser } from 'puppeteer-core';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { logger } from '../utils/logger.js';
import { ALLOCINE_BASE_URL } from './utils.js';
import { HttpError, RateLimitError } from '../utils/errors.js';
import { CircuitBreaker } from './circuit-breaker.js';

const FETCH_TIMEOUT_MS = 15000;

// ── Retry configuration ─────────────────────────────────────────
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 10000;

/**
 * Determine whether an error is retryable (transient).
 * 429 and 4xx client errors are NOT retried — they indicate a
 * condition that retries won't fix (rate-limit, bad request).
 * 5xx, network/timeout, and DNS errors ARE retried.
 */
function isRetryableError(err: unknown): boolean {
  if (err instanceof RateLimitError) return false;
  if (err instanceof HttpError && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) return false;
  return true;
}

/**
 * Compute exponential backoff delay with jitter (±25%).
 * delay = min(base * 2^(attempt-1), maxDelay)
 * Then apply uniform jitter in [0.75, 1.25].
 */
function backoffDelay(attempt: number): number {
  const exponential = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1), RETRY_MAX_DELAY_MS);
  const jitter = 0.75 + Math.random() * 0.5; // 0.75 → 1.25
  return Math.round(exponential * jitter);
}

/**
 * Generic fetch with exponential-backoff retry.
 *
 * Retries only on transient errors (5xx, network, timeout).
 * Does NOT retry on 429 (RateLimitError) or 4xx client errors.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retryOn?: (err: unknown) => boolean,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    // Merge the caller's signal with our own timeout
    const existingSignal = init.signal ?? null;
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    // If the caller provided a signal, forward aborts to our controller
    if (existingSignal) {
      if (existingSignal.aborted) {
        clearTimeout(timeoutId);
        throw new HttpError('Request aborted', 0, url);
      }
      existingSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });

      if (!response.ok) {
        // Detect rate limiting specifically
        if (response.status === 429) {
          throw new RateLimitError(
            `Rate limit exceeded for ${url}`,
            response.status,
            url
          );
        }

        throw new HttpError(
          `HTTP ${response.status} ${response.statusText} for ${url}`,
          response.status,
          url
        );
      }

      return response;
    } catch (err) {
      lastError = err;
      clearTimeout(timeoutId);

      const retryable = retryOn ? retryOn(err) : isRetryableError(err);
      if (!retryable || attempt === RETRY_MAX_ATTEMPTS) {
        throw err;
      }

      const delay = backoffDelay(attempt);
      logger.warn('Retrying HTTP request', {
        url: url.slice(0, 120),
        attempt,
        nextDelayMs: delay,
        error: err instanceof Error ? err.message : String(err),
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export const circuitBreaker = new CircuitBreaker(5, 60000, (err) => {
  if (err instanceof RateLimitError) return false;
  if (err instanceof HttpError && err.statusCode && err.statusCode < 500) return false;
  return true;
});

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
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

function getPlaywrightCacheDir(): string {
  const configuredPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (configuredPath && configuredPath !== '0') {
    return configuredPath;
  }

  return join(homedir(), '.cache', 'ms-playwright');
}

function findCachedBrowserExecutable(prefix: string, executableSegments: string[]): string | undefined {
  const cacheDir = getPlaywrightCacheDir();
  if (!existsSync(cacheDir)) {
    return undefined;
  }

  const matchingDirs = readdirSync(cacheDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));

  for (const dirName of matchingDirs) {
    const executablePath = join(cacheDir, dirName, ...executableSegments);
    if (existsSync(executablePath)) {
      return executablePath;
    }
  }

  return undefined;
}

function resolveChromiumExecutablePath(): string {
  const configuredPath = process.env.CHROME_PATH;
  if (configuredPath) {
    return configuredPath;
  }

  const candidates = [
    '/usr/bin/chromium-headless-shell',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    findCachedBrowserExecutable('chromium_headless_shell-', ['chrome-headless-shell-linux64', 'chrome-headless-shell']),
    findCachedBrowserExecutable('chromium-', ['chrome-linux64', 'chrome']),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Chromium executable not found. Set CHROME_PATH or install a browser under one of: ${candidates.join(', ') || getPlaywrightCacheDir()}`
  );
}

async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    const executablePath = resolveChromiumExecutablePath();
    logger.info('Launching browser', { executablePath });

    _browser = await puppeteer.launch({
      headless: true,
      executablePath,
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
  return circuitBreaker.execute(async () => {
    const browser = await getBrowser();
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    try {
      await page.setUserAgent(getRandomUserAgent());
      logger.info('Loading theater page', { url: cinemaBaseUrl });
      await page.goto(cinemaBaseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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
  });
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
      'User-Agent': getRandomUserAgent(),
      Accept: 'application/json',
      'Accept-Language': 'fr-FR,fr;q=0.9',
      Referer: `${ALLOCINE_BASE_URL}/seance/salle_gen_csalle=${cinemaId}.html`,
    },
  });

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

  return circuitBreaker.execute(async () => {
    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
      },
    });

    return response.text();
  });
}

// Ajouter un délai entre les requêtes pour éviter le rate limiting
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
