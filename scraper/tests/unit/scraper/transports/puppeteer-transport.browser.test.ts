import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// A fake browser whose page runs `evaluate` callbacks against `fakeDocument`,
// standing in for the rendered theater page.
let fakeDocument: { querySelector: (selector: string) => unknown } | undefined;

const page = {
  setUserAgent: vi.fn(),
  goto: vi.fn(),
  content: vi.fn(async () => '<html>theater</html>'),
  evaluate: vi.fn(async (fn: () => unknown) => {
    const g = globalThis as { document?: unknown };
    const previous = g.document;
    g.document = fakeDocument;
    try {
      return fn();
    } finally {
      g.document = previous;
    }
  }),
};
const context = { newPage: vi.fn(async () => page), close: vi.fn() };
const browser = { connected: true, createBrowserContext: vi.fn(async () => context), close: vi.fn() };

vi.mock('puppeteer-core', () => ({
  default: { launch: vi.fn(async () => browser) },
}));

import puppeteer from 'puppeteer-core';
import { PuppeteerTransport, closeBrowser } from '../../../../src/scraper/transports/puppeteer-transport.js';

const THEATER_URL = 'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html';

/** The theater page's showtimes root, carrying `data-showtimes-dates`. */
function withDatesAttribute(raw: string | null) {
  fakeDocument = {
    querySelector: (selector: string) =>
      selector === '#theaterpage-showtimes-index-ui' ? { getAttribute: () => raw } : null,
  };
}

describe('PuppeteerTransport - page loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.connected = true;
    fakeDocument = undefined;
  });

  afterEach(async () => {
    await closeBrowser();
  });

  it('returns the rendered HTML and the dates listed on the page', async () => {
    withDatesAttribute('["2026-03-24","2026-03-25"]');

    const result = await new PuppeteerTransport().fetchPage(THEATER_URL);

    expect(result).toEqual({ html: '<html>theater</html>', availableDates: ['2026-03-24', '2026-03-25'] });
    expect(page.goto).toHaveBeenCalledWith(THEATER_URL, expect.objectContaining({ waitUntil: 'networkidle0' }));
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('returns no dates when the attribute is missing or not valid JSON', async () => {
    withDatesAttribute(null);
    expect((await new PuppeteerTransport().fetchPage(THEATER_URL)).availableDates).toEqual([]);

    withDatesAttribute('not-json');
    expect((await new PuppeteerTransport().fetchPage(THEATER_URL)).availableDates).toEqual([]);
  });

  it('closes the browser context even when navigation fails', async () => {
    page.goto.mockRejectedValueOnce(new Error('navigation timeout'));

    await expect(new PuppeteerTransport().fetchPage(THEATER_URL)).rejects.toThrow('navigation timeout');
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('reuses one browser per process and relaunches it once disconnected', async () => {
    withDatesAttribute(null);
    const transport = new PuppeteerTransport();

    await transport.fetchPage(THEATER_URL);
    await transport.fetchPage(THEATER_URL);
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);

    browser.connected = false;
    await transport.fetchPage(THEATER_URL);
    expect(puppeteer.launch).toHaveBeenCalledTimes(2);
  });

  it('closeBrowser closes the shared browser once, and is a no-op without one', async () => {
    withDatesAttribute(null);
    await new PuppeteerTransport().fetchPage(THEATER_URL);

    await closeBrowser();
    await closeBrowser();

    expect(browser.close).toHaveBeenCalledTimes(1);
  });
});
