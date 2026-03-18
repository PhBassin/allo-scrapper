# Advanced Custom Scraper Strategy Development & Multi-Source Integration

**Last updated:** March 18, 2026 | Status: Current ✅

Complete guide to extending Allo-Scrapper with custom data sources, implementing new scraper strategies, and managing multiple cinema source integrations.

---

## Table of Contents

- [Overview](#overview)
- [Architecture: Strategy Pattern](#architecture-strategy-pattern)
- [Creating Your First Custom Strategy](#creating-your-first-custom-strategy)
- [HTML Parsing & Test Fixtures](#html-parsing--test-fixtures)
- [Handling Parser Fragility](#handling-parser-fragility)
- [Advanced Patterns](#advanced-patterns)
- [Testing & Validation](#testing--validation)
- [Troubleshooting](#troubleshooting)

---

## Overview

Allo-Scrapper uses the **Strategy Pattern** to support multiple cinema data sources. By default, only AlloCiné is implemented, but you can add:

- **New cinema websites** (CGR, Cinéma Pathé, independent theaters)
- **Regional cinema chains** with custom APIs
- **Aggregator platforms** (Fandango, Ticketmaster)
- **Fallback sources** for redundancy

### When to Use Custom Strategies

| Scenario | Solution |
|----------|----------|
| Add UGC Cinemas (has separate booking site) | Implement UGCScraperStrategy |
| Support AlloCiné + Pathé + CGR simultaneously | Multiple strategies, automatic routing |
| Theater-specific custom API | CustomTheaterScraperStrategy |
| Fallback if AlloCiné down | Use strategy chain with fallback |

---

## Architecture: Strategy Pattern

### The IScraperStrategy Interface

All strategies implement this contract:

```typescript
// File: scraper/src/scraper/strategies/IScraperStrategy.ts

export interface IScraperStrategy {
  // Identification
  readonly sourceName: string;  // e.g., 'allocine', 'ugc', 'pathé'
  
  // URL Handling
  canHandleUrl(url: string): boolean;
  extractCinemaId(url: string): string | null;
  cleanCinemaUrl(url: string): string;
  
  // Metadata
  async loadTheaterMetadata(
    db: DB, 
    cinema: CinemaConfig
  ): Promise<{ 
    availableDates: string[]; 
    cinema: Cinema 
  }>;
  
  // Scraping
  async scrapeTheater(
    db: DB, 
    cinema: CinemaConfig, 
    date: string, 
    movieDelayMs: number, 
    progress?: ProgressPublisher
  ): Promise<{ 
    filmsCount: number; 
    showtimesCount: number 
  }>;
}
```

### How Strategy Selection Works

```
User adds cinema via API:
  POST /api/cinemas { url: "https://www.ugc.fr/..." }
                           ↓
                  StrategyFactory.getStrategyByUrl(url)
                           ↓
  Iterates through all strategies:
    - allocineStrategy.canHandleUrl(url) → false
    - ugcStrategy.canHandleUrl(url) → true ✓
                           ↓
          Returns UGCScraperStrategy instance
                           ↓
         Saves cinema with source='ugc'
```

---

## Creating Your First Custom Strategy

### Step 1: Set Up Strategy Skeleton

Create a new file: `scraper/src/scraper/strategies/UGCScraperStrategy.ts`

```typescript
import { IScraperStrategy } from './IScraperStrategy.js';
import type { DB } from '../../db/client.js';
import type { Cinema, CinemaConfig } from '../../types/scraper.js';
import type { ProgressPublisher } from '../../redis/client.js';

export class UGCScraperStrategy implements IScraperStrategy {
  readonly sourceName = 'ugc';

  // ===== URL HANDLING =====
  canHandleUrl(url: string): boolean {
    // Match URLs like:
    // https://www.ugccinemas.fr/cinemas/paris-odeon
    // https://ugccinemas.fr/seance/cinema-123
    return /ugccinemas\.fr/.test(url);
  }

  extractCinemaId(url: string): string | null {
    // Extract cinema ID from URL
    // Example: https://ugccinemas.fr/cinemas/UGC-PARIS-ODEON
    // Returns: UGC-PARIS-ODEON
    const match = url.match(/cinemas\/([^/?]+)/);
    return match ? match[1] : null;
  }

  cleanCinemaUrl(url: string): string {
    // Normalize URL to canonical form
    return url.replace(/[?#].*$/, '');  // Remove query params
  }

  // ===== METADATA =====
  async loadTheaterMetadata(
    db: DB,
    cinema: CinemaConfig
  ): Promise<{ availableDates: string[]; cinema: Cinema }> {
    // 1. Fetch cinema info page
    const html = await this.fetchCinemaPage(cinema.url);

    // 2. Parse cinema metadata
    const cinemaData = this.parseCinemaMetadata(html);

    // 3. Extract available dates
    const availableDates = this.parseAvailableDates(html);

    // 4. Upsert to database
    await db.query(
      'INSERT INTO cinemas (id, name, url, source) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name=$2, url=$3',
      [cinemaData.id, cinemaData.name, cinema.url, this.sourceName]
    );

    return {
      availableDates,
      cinema: { id: cinemaData.id, name: cinemaData.name, source: this.sourceName }
    };
  }

  // ===== SCRAPING =====
  async scrapeTheater(
    db: DB,
    cinema: CinemaConfig,
    date: string,
    movieDelayMs: number,
    progress?: ProgressPublisher
  ): Promise<{ filmsCount: number; showtimesCount: number }> {
    // 1. Fetch showtimes for date
    const html = await this.fetchShowtimesPage(cinema.url, date);

    // 2. Parse films and showtimes
    const { films, showtimes } = this.parseShowtimes(html, cinema.id, date);

    // 3. Fetch film details for unknown films
    for (const film of films) {
      if (!film.duration_minutes) {
        await this.sleep(movieDelayMs);
        const filmDetails = await this.fetchFilmDetails(film.id);
        Object.assign(film, filmDetails);
      }
    }

    // 4. Upsert to database
    await db.query('INSERT INTO films (id, title, duration_minutes) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET duration_minutes=$3', 
      [films[0].id, films[0].title, films[0].duration_minutes]);
    // ... more upserts ...

    // 5. Report progress
    progress?.emit({ type: 'showtimes_saved', count: showtimes.length });

    return { filmsCount: films.length, showtimesCount: showtimes.length };
  }

  // ===== PRIVATE HELPER METHODS =====
  private async fetchCinemaPage(url: string): Promise<string> {
    // Implement HTTP request with retries, timeouts, headers
    // See: scraper/src/scraper/http-client.ts for reference
  }

  private parseCinemaMetadata(html: string): { id: string; name: string; } {
    // Use Cheerio to parse HTML
    // See: scraper/src/scraper/theater-parser.ts for reference
  }

  private parseAvailableDates(html: string): string[] {
    // Extract available dates from parsed HTML
  }

  private async fetchShowtimesPage(url: string, date: string): Promise<string> {
    // Fetch showtimes for specific date
  }

  private parseShowtimes(html: string, cinemaId: string, date: string) {
    // Parse films and showtimes from HTML/JSON
  }

  private async fetchFilmDetails(filmId: string) {
    // Fetch film metadata (duration, director, synopsis)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Step 2: Register Strategy in Factory

Edit: `scraper/src/scraper/strategy-factory.ts`

```typescript
import { UGCScraperStrategy } from './strategies/UGCScraperStrategy.js';
import { AllocineScraperStrategy } from './strategies/AllocineScraperStrategy.js';

const strategies = [
  new UGCScraperStrategy(),      // Check UGC first
  new AllocineScraperStrategy(),  // Then AlloCiné
];

export class StrategyFactory {
  static getStrategyByUrl(url: string): IScraperStrategy {
    for (const strategy of strategies) {
      if (strategy.canHandleUrl(url)) {
        return strategy;
      }
    }
    throw new Error(`No scraper strategy found for URL: ${url}`);
  }

  static getStrategyBySource(source: string): IScraperStrategy {
    const strategy = strategies.find(s => s.sourceName === source);
    if (!strategy) {
      throw new Error(`Unknown scraper source: ${source}`);
    }
    return strategy;
  }
}
```

### Step 3: Add Unit Tests

Create: `scraper/tests/unit/scraper/ugc-strategy.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { UGCScraperStrategy } from '../../../src/scraper/strategies/UGCScraperStrategy.js';
import * as fs from 'fs';
import * as path from 'path';

describe('UGCScraperStrategy', () => {
  let strategy: UGCScraperStrategy;
  let htmlFixture: string;

  beforeAll(() => {
    strategy = new UGCScraperStrategy();
    
    // Load HTML fixture
    const fixturePath = path.resolve('./tests/fixtures/ugc-cinema-page.html');
    htmlFixture = fs.readFileSync(fixturePath, 'utf-8');
  });

  describe('URL Handling', () => {
    it('should recognize UGC cinema URLs', () => {
      expect(strategy.canHandleUrl('https://www.ugccinemas.fr/cinemas/paris-odeon'))
        .toBe(true);
      
      expect(strategy.canHandleUrl('https://allocine.fr/seance/'))
        .toBe(false);
    });

    it('should extract cinema ID from URL', () => {
      const url = 'https://ugccinemas.fr/cinemas/UGC-PARIS-ODEON';
      expect(strategy.extractCinemaId(url))
        .toBe('UGC-PARIS-ODEON');
    });

    it('should clean URLs removing query params', () => {
      const url = 'https://ugccinemas.fr/cinemas/paris?date=2026-03-18#reviews';
      expect(strategy.cleanCinemaUrl(url))
        .toBe('https://ugccinemas.fr/cinemas/paris');
    });
  });

  describe('Parsing', () => {
    it('should parse cinema metadata', () => {
      const result = strategy.parseCinemaMetadata(htmlFixture);
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result.name).toMatch(/UGC|Cinéma/i);
    });

    it('should parse available dates', () => {
      const dates = strategy.parseAvailableDates(htmlFixture);
      
      expect(dates.length).toBeGreaterThan(0);
      dates.forEach(date => {
        expect(/\d{4}-\d{2}-\d{2}/.test(date)).toBe(true);
      });
    });

    it('should parse showtimes from fixture', () => {
      const { films, showtimes } = strategy.parseShowtimes(
        htmlFixture,
        'UGC-PARIS',
        '2026-03-18'
      );
      
      expect(films.length).toBeGreaterThan(0);
      expect(showtimes.length).toBeGreaterThan(0);
      
      // Verify structure
      expect(films[0]).toHaveProperty('id');
      expect(films[0]).toHaveProperty('title');
      expect(showtimes[0]).toHaveProperty('time');
    });
  });
});
```

---

## HTML Parsing & Test Fixtures

### Creating Test Fixtures

**Step 1: Fetch Real HTML**

```bash
# Fetch cinema page
curl "https://www.ugccinemas.fr/cinemas/paris-odeon" \
  -H "User-Agent: Mozilla/5.0" \
  -o scraper/tests/fixtures/ugc-cinema-page.html

# Fetch showtimes page
curl "https://www.ugccinemas.fr/showtimes?cinema=UGC-PARIS&date=2026-03-18" \
  -H "User-Agent: Mozilla/5.0" \
  -o scraper/tests/fixtures/ugc-showtimes.html

# Check file size
ls -lh scraper/tests/fixtures/ugc-*.html
```

**Step 2: Sanitize Sensitive Data**

```bash
# Remove tracking pixels, analytics, personalized content
sed -i '' 's/<img src="[^"]*tracking[^"]*">//g' scraper/tests/fixtures/ugc-*.html

# Commit fixtures to git
git add scraper/tests/fixtures/ugc-*.html
```

### Parsing with Cheerio

```typescript
import * as cheerio from 'cheerio';

private parseCinemaMetadata(html: string) {
  const $ = cheerio.load(html);
  
  // Example: Parse cinema name from heading
  const name = $('h1.cinema-title').text().trim();
  
  // Example: Parse cinema ID from data attribute
  const id = $('[data-cinema-id]').attr('data-cinema-id');
  
  // Example: Parse address
  const address = $('.cinema-address').text().trim();
  
  return {
    id: id || 'unknown',
    name: name || 'Unknown Cinema',
    address
  };
}

private parseAvailableDates(html: string): string[] {
  const $ = cheerio.load(html);
  const dates: string[] = [];
  
  // Example: Extract from date selector dropdown
  $('select.date-picker option').each((i, el) => {
    const dateStr = $(el).attr('value');  // e.g., "2026-03-18"
    if (dateStr && /\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      dates.push(dateStr);
    }
  });
  
  return dates;
}
```

### Handling Dynamic Content

**Problem:** Some websites load showtimes via JavaScript

```html
<!-- Static HTML only shows loading spinner -->
<div id="showtimes">
  <div class="loading">Loading showtimes...</div>
</div>

<!-- Actual showtimes loaded via AJAX -->
```

**Solution: Use Puppeteer for JavaScript rendering**

```typescript
import puppeteer from 'puppeteer';

private async fetchShowtimesPageDynamic(url: string, date: string): Promise<string> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  try {
    // Set realistic user agent and headers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
    // Navigate and wait for content
    await page.goto(`${url}?date=${date}`, { waitUntil: 'networkidle2' });
    
    // Wait for showtimes to render
    await page.waitForSelector('.showtimes-container', { timeout: 5000 });
    
    // Get rendered HTML
    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}
```

---

## Handling Parser Fragility

### Problem: Websites Change Structure

```
2026-03-01: Cinema website redesigns
  Old HTML:
    <div class="cinema-name">...</div>
  New HTML:
    <h1 class="theater-title">...</h1>

  Result: Your parser breaks ❌
```

### Solution 1: Defensive Parsing with Fallbacks

```typescript
private parseCinemaName(html: string): string {
  const $ = cheerio.load(html);
  
  // Try primary selector
  let name = $('h1.cinema-name').text().trim();
  
  // Fallback to secondary selector
  if (!name) {
    name = $('div.theater-title').text().trim();
  }
  
  // Fallback to data attribute
  if (!name) {
    name = $('[data-theater-name]').attr('data-theater-name') || '';
  }
  
  // Fallback to generic heading
  if (!name) {
    name = $('h1').first().text().trim();
  }
  
  // Log if all failed
  if (!name) {
    logger.warn(`Could not parse cinema name, using fallback`);
    return 'Unknown Cinema';
  }
  
  return name;
}
```

### Solution 2: Version Your Parsers

```typescript
// Tracker version with parser version
const PARSER_VERSION = '2.0';  // Increment on breaking changes

private async parseShowtimes(html: string, cinemaId: string, date: string) {
  // ... parsing logic ...
  
  const showtimes = [/* ... */];
  
  // Record parser version for debugging
  return {
    showtimes,
    parserVersion: PARSER_VERSION,
    parseTime: Date.now()
  };
}

// In tests, validate parser version consistency
expect(result.parserVersion).toBe('2.0');
```

### Solution 3: Monitor Parser Health

```typescript
async function monitorParserHealth(strategy: IScraperStrategy) {
  const testUrl = 'https://...cinema-url...';
  const date = formatDate(new Date());
  
  try {
    const result = await strategy.scrapeTheater(db, { url: testUrl }, date, 500);
    
    // Check if result looks reasonable
    if (result.filmsCount === 0) {
      logger.error(`${strategy.sourceName} parser returned 0 films - possible HTML structure change`);
      // Alert operations team
      sendAlert(`Parser ${strategy.sourceName} may be broken`);
    }
  } catch (err) {
    logger.error(`Parser health check failed: ${err.message}`);
  }
}

// Run daily
node-cron.schedule('0 12 * * *', () => monitorParserHealth(strategy));
```

---

## Advanced Patterns

### Pattern 1: Fallback Strategy Chain

```typescript
export class FallbackStrategy implements IScraperStrategy {
  readonly sourceName = 'fallback-chain';
  
  constructor(
    private primaryStrategy: IScraperStrategy,
    private fallbackStrategy: IScraperStrategy
  ) {}
  
  async scrapeTheater(
    db: DB,
    cinema: CinemaConfig,
    date: string,
    movieDelayMs: number,
    progress?: ProgressPublisher
  ) {
    try {
      return await this.primaryStrategy.scrapeTheater(db, cinema, date, movieDelayMs, progress);
    } catch (primaryError) {
      logger.warn(`Primary strategy failed, trying fallback`, { error: primaryError });
      
      try {
        return await this.fallbackStrategy.scrapeTheater(db, cinema, date, movieDelayMs, progress);
      } catch (fallbackError) {
        logger.error(`Both strategies failed`, { primaryError, fallbackError });
        throw fallbackError;
      }
    }
  }
}

// Usage
const allocineStrategy = new AllocineScraperStrategy();
const webScraperStrategy = new GenericWebScraperStrategy();
const withFallback = new FallbackStrategy(allocineStrategy, webScraperStrategy);
```

### Pattern 2: Caching & Deduplication

```typescript
private filmCache = new Map<string, Film>();

private async fetchFilmDetails(filmId: string, sourceUrl: string): Promise<Film> {
  // Check cache first
  if (this.filmCache.has(filmId)) {
    return this.filmCache.get(filmId)!;
  }
  
  // Fetch from database
  const existing = await db.query('SELECT * FROM films WHERE id = $1', [filmId]);
  if (existing.rows.length > 0) {
    const film = existing.rows[0];
    this.filmCache.set(filmId, film);
    return film;
  }
  
  // Fetch from source
  const film = await this.parseFilmFromUrl(sourceUrl);
  this.filmCache.set(filmId, film);
  
  return film;
}
```

### Pattern 3: Rate Limit Awareness

```typescript
private lastRequestTime = 0;
private readonly MIN_DELAY_MS = 1000;

private async fetchWithDelay(url: string): Promise<string> {
  const now = Date.now();
  const timeSinceLastRequest = now - this.lastRequestTime;
  
  if (timeSinceLastRequest < this.MIN_DELAY_MS) {
    const delayNeeded = this.MIN_DELAY_MS - timeSinceLastRequest;
    await this.sleep(delayNeeded);
  }
  
  this.lastRequestTime = Date.now();
  return await fetch(url);  // Actual HTTP call
}
```

---

## Testing & Validation

### Unit Testing Checklist

```typescript
describe('CustomStrategy', () => {
  // ✅ URL Handling
  test('canHandleUrl recognizes valid URLs');
  test('canHandleUrl rejects invalid URLs');
  test('extractCinemaId parses ID correctly');
  test('cleanCinemaUrl removes query params');
  
  // ✅ Parsing
  test('parseCinemaMetadata extracts name, address, ID');
  test('parseAvailableDates returns valid dates');
  test('parseShowtimes returns films and showtimes');
  test('parseShowtimes handles edge cases (no films, duplicate films)');
  
  // ✅ Error Handling
  test('handles missing HTML elements gracefully');
  test('handles malformed HTML');
  test('returns empty results rather than crashing');
  
  // ✅ Database Integration
  test('upserts cinema to database');
  test('handles concurrent inserts');
});
```

### Integration Testing Checklist

```typescript
describe('CustomStrategy Integration', () => {
  // ✅ Real Cinema Integration
  test('fetches real cinema page (marked @slow, skip in CI)');
  test('parses real cinema metadata');
  test('parses real showtimes');
  
  // ✅ Data Quality
  test('all films have valid IDs and titles');
  test('all showtimes have valid times and cinema_id');
  test('no duplicate showtimes');
  
  // ✅ Persistence
  test('cinema is saved to database');
  test('films are saved to database');
  test('showtimes are saved to database');
});
```

---

## Troubleshooting

### Problem: "No scraper strategy found for URL"

**Cause:** `canHandleUrl()` returns false for your cinema URL

**Solution:**
```typescript
// Debug: Log which strategies are being checked
const url = 'https://example-cinema.fr/showtimes';
for (const strategy of strategies) {
  const handles = strategy.canHandleUrl(url);
  console.log(`${strategy.sourceName}: ${handles}`);  // Identify which returned false
}

// Fix: Update canHandleUrl regex
canHandleUrl(url: string): boolean {
  // Was: /example-cinema\.fr/
  // Now: /example-cinema\.(fr|com)/  // Support both domains
  return /example-cinema\.(fr|com)/.test(url);
}
```

### Problem: Parser returns 0 films

**Cause:** Selector no longer matches website HTML

**Debug steps:**
```bash
# 1. Check if website changed
curl "https://example-cinema.fr/showtimes" -o /tmp/page.html
open /tmp/page.html  # Visual inspection

# 2. Update test fixture
cp /tmp/page.html scraper/tests/fixtures/example-cinema-page.html

# 3. Update selectors
const name = $('h1.theater-name').text();  // Was: div.cinema-name
```

### Problem: Rate limit (429) errors from target website

**Solution:** Add delays to strategy

```typescript
private async fetchShowtimesPage(url: string, date: string): Promise<string> {
  const html = await this.fetchWithDelay(url);  // Add delay before request
  return html;
}

private readonly DELAY_MS = 2000;  // Adjust as needed

private async fetchWithDelay(url: string): Promise<string> {
  await this.sleep(this.DELAY_MS);
  return await fetch(url);
}
```

---

## Best Practices Summary

| Best Practice | Why | Example |
|---|---|---|
| Use test fixtures | Don't hit real website repeatedly | `fs.readFileSync('./fixture.html')` |
| Implement fallbacks | Websites change structure | Try 3 selectors before giving up |
| Version your parsers | Track changes over time | `PARSER_VERSION = '2.0'` |
| Monitor parser health | Catch breakage early | Daily healthcheck scrape |
| Add delays | Respect target website limits | `MIN_DELAY_MS = 1000` |
| Document assumptions | Help future maintainers | Comment selectors with examples |

---

## Related Documentation

- [IScraperStrategy Interface](../../reference/architecture/scraper-system.md#architecture-components) - Interface contract
- [Scraper System Architecture](../../reference/architecture/scraper-system.md) - Overall design
- [Testing Guide](../development/testing.md) - Test patterns
- [Troubleshooting Scraper](../../troubleshooting/scraper.md) - Common issues

---

[← Back to Advanced Guides](./README.md) | [Back to Documentation](../../README.md)
