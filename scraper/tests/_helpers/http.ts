/**
 * Test helpers for HTTP mocking in scraper tests.
 *
 * Usage:
 *   import { mockHttpOk, mockFetchStub } from '../../tests/_helpers/http.js';
 *   beforeEach(() => mockFetchStub());
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Simple fetch mock
// ---------------------------------------------------------------------------

/**
 * Creates a mock `fetch` that returns a successful JSON response.
 *
 * @param body  - The JSON body to return (default: {}).
 * @param status - HTTP status code (default: 200).
 * @returns A Vitest mock function suitable for `vi.stubGlobal('fetch', ...)`.
 */
export function mockHttpOk(body: unknown = {}, status: number = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(
      typeof body === 'string' ? body : JSON.stringify(body),
    ),
  });
}

// ---------------------------------------------------------------------------
// Stub global fetch with a default OK response
// ---------------------------------------------------------------------------

/** Convenience: stubs `global.fetch` with a 200 OK empty response.
 *  Returns the mock so tests can inspect calls. */
export function mockFetchStub(body: unknown = {}, status: number = 200) {
  const fn = mockHttpOk(body, status);
  vi.stubGlobal('fetch', fn);
  return fn;
}

// ---------------------------------------------------------------------------
// Puppeteer page mock
// ---------------------------------------------------------------------------

/**
 * Creates a lightweight Puppeteer Page mock.
 * Provides `goto`, `content`, `evaluate`, `close`, `setUserAgent`.
 */
export function mockPuppeteerPage(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    goto: vi.fn().mockResolvedValue(null),
    content: vi.fn().mockResolvedValue('<html></html>'),
    evaluate: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
    setUserAgent: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Creates a Puppeteer BrowserContext mock with a pre-built page.
 */
export function mockBrowserContext(pageOverrides?: Partial<Record<string, unknown>>) {
  const page = mockPuppeteerPage(pageOverrides);
  return {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn(),
    _page: page,
  };
}
