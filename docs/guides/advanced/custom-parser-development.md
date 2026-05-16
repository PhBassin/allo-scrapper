# Advanced Custom Scraper Strategy Development & Multi-Source Integration

**Last updated:** March 18, 2026 | Status: Current ✅

Complete guide to extending Allo-Scrapper with custom data sources, implementing new scraper strategies, and managing multiple theater source integrations.

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

Allo-Scrapper uses the **Strategy Pattern** to support multiple theater data sources. By default, only AlloCiné is implemented, but you can add:

- **New theater websites** (CGR, Theater Pathé, independent theaters)
- **Regional theater chains** with custom APIs
- **Aggregator platforms** (Fandango, Ticketmaster)
- **Fallback sources** for redundancy

### When to Use Custom Strategies

| Scenario | Solution |
|----------|----------|
| Add UGC Theaters (has separate booking site) | Implement UGCScraperStrategy |
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
  extractTheaterId(url: string): string | null;
  cleanTheaterUrl(url: string): string;
  
  // Metadata
  async loadTheaterMetadata(
    db: DB, 
    theater: TheaterConfig
  ): Promise<{ 
    availableDates: string[]; 
    theater: Theater 
  }>;
  
  // Scraping
  async scrapeTheater(
    db: DB, 
    theater: TheaterConfig, 
    date: string, 
    movieDelayMs: number, 
    progress?: ProgressPublisher
  ): Promise<{ 
    moviesCount: number; 
    showtimesCount: number 
  }>;
}
```

### How Strategy Selection Works

```
User adds theater via API:
  POST /api/theaters { url: "https://www.ugc.fr/..." }
                           ↓
                  StrategyFactory.getStrategyByUrl(url)
                           ↓
  Iterates through all strategies:
    - allocineStrategy.canHandleUrl(url) → false
    - ugcStrategy.canHandleUrl(url) → true ✓
                           ↓
          Returns UGCScraperStrategy instance
                           ↓
         Saves theater with source='ugc'
```

---

## Creating Your First Custom Strategy

### Step 1: Set Up Strategy Skeleton

Create a new file: `scraper/src/scraper/strategies/UGCScraperStrategy.ts`

```typescript
import { IScraperStrategy } from './IScraperStrategy.js';
import type { DB } from '../../db/client.js';
import type { Theater, TheaterConfig } from '../../types/scraper.js';
import type { ProgressPublisher } from '../../redis/client.js';

export class UGCScraperStrategy implements IScraperStrategy {
  readonly sourceName = 'ugc';

  // ===== URL HANDLING =====
  canHandleUrl(url: string): boolean {
    // Match URLs like:
    // https://www.ugctheaters.fr/theaters/paris-odeon
    // https://ugctheaters.fr/seance/theater-123
    return /ugctheaters\.fr/.test(url);
  }

  extractTheaterId(url: string): string | null {
    // Extract theater ID from URL
    // Example: https://ugctheaters.fr/theaters/UGC-PARIS-ODEON
    // Returns: UGC-PARIS-ODEON
    const match = url.match(/theaters\/([^/?]+)/);
    return match ? match[1] : null;
  }

  cleanTheaterUrl(url: string): string {
    // Normalize URL to canonical form
    return url.replace(/[?#].*$/, '');  // Remove query params
  }

  // ===== METADATA =====
  async loadTheaterMetadata(
    db: DB,
    theater: TheaterConfig
  ): Promise<{ availableDates: string[]; theater: Theater }> {
    // 1. Fetch theater info page
    const html = await this.fetchTheaterPage(theater.url);

    // 2. Parse theater metadata
    const theaterData = this.parseTheaterMetadata(html);

    // 3. Extract available dates
    const availableDates = this.parseAvailableDates(html);

    // 4. Upsert to database
    await db.query(
      'INSERT INTO theaters (id, name, url, source) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name=$2, url=$3',
      [theaterData.id, theaterData.name, theater.url, this.sourceName]
    );

    return {
      availableDates,
      theater: { id: theaterData.id, name: theaterData.name, source: this.sourceName }
    };
  }

  // ===== SCRAPING =====
  async scrapeTheater(
    db: DB,
    theater: TheaterConfig,
    date: string,
    movieDelayMs: number,
    progress?: ProgressPublisher
  ): Promise<{ moviesCount: number; showtimesCount: number }> {
    // 1. Fetch showtimes for date
    const html = await this.fetchShowtimesPage(theater.url, date);

    // 2. Parse movies and showtimes
    const { movies, showtimes } = this.parseShowtimes(html, theater.id, date);

    // 3. Fetch movie details for unknown movies
    for (const movie of movies) {
      if (!movie.duration_minutes) {
        await this.sleep(movieDelayMs);
        const movieDetails = await this.fetchMovieDetails(movie.id);
        Object.assign(movie, movieDetails);
      }
    }

    // 4. Upsert to database
    await db.query('INSERT INTO movies (id, title, duration_minutes) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET duration_minutes=$3', 
      [movies[0].id, movies[0].title, movies[0].duration_minutes]);
    // ... more upserts ...

    // 5. Report progress
    progress?.emit({ type: 'showtimes_saved', count: showtimes.length });

    return { moviesCount: movies.length, showtimesCount: showtimes.length };
  }

  // ===== PRIVATE HELPER METHODS =====
  private async fetchTheaterPage(url: string): Promise<string> {
    // Implement HTTP request with retries, timeouts, headers
    // See: scraper/src/scraper/http-client.ts for reference
  }

  private parseTheaterMetadata(html: string): { id: string; name: string; } {
    // Use Cheerio to parse HTML
    // See: scraper/src/scraper/theater-parser.ts for reference
  }

  private parseAvailableDates(html: string): string[] {
    // Extract available dates from parsed HTML
  }

  private async fetchShowtimesPage(url: string, date: string): Promise<string> {
    // Fetch showtimes for specific date
  }

  private parseShowtimes(html: string, theaterId: string, date: string) {
    // Parse movies and showtimes from HTML/JSON
  }

  private async fetchMovieDetails(movieId: string) {
    // Fetch movie metadata (duration, director, synopsis)
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
    const fixturePath = path.resolve('./tests/fixtures/ugc-theater-page.html');
    htmlFixture = fs.readFileSync(fixturePath, 'utf-8');
  });

  describe('URL Handling', () => {
    it('should recognize UGC theater URLs', () => {
      expect(strategy.canHandleUrl('https://www.ugctheaters.fr/theaters/paris-odeon'))
        .toBe(true);
      
      expect(strategy.canHandleUrl('https://allocine.fr/seance/'))
        .toBe(false);
    });

    it('should extract theater ID from URL', () => {
      const url = 'https://ugctheaters.fr/theaters/UGC-PARIS-ODEON';
      expect(strategy.extractTheaterId(url))
        .toBe('UGC-PARIS-ODEON');
    });

    it('should clean URLs removing query params', () => {
      const url = 'https://ugctheaters.fr/theaters/paris?date=2026-03-18#reviews';
      expect(strategy.cleanTheaterUrl(url))
        .toBe('https://ugctheaters.fr/theaters/paris');
    });
  });

  describe('Parsing', () => {
    it('should parse theater metadata', () => {
      const result = strategy.parseTheaterMetadata(htmlFixture);
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result.name).toMatch(/UGC|Theater/i);
    });

    it('should parse available dates', () => {
      const dates = strategy.parseAvailableDates(htmlFixture);
      
      expect(dates.length).toBeGreaterThan(0);
      dates.forEach(date => {
        expect(/\d{4}-\d{2}-\d{2}/.test(date)).toBe(true);
      });
    });

    it('should parse showtimes from fixture', () => {
      const { movies, showtimes } = strategy.parseShowtimes(
        htmlFixture,
        'UGC-PARIS',
        '2026-03-18'
      );
      
      expect(movies.length).toBeGreaterThan(0);
      expect(showtimes.length).toBeGreaterThan(0);
      
      // Verify structure
      expect(movies[0]).toHaveProperty('id');
      expect(movies[0]).toHaveProperty('title');
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
# Fetch theater page
curl "https://www.ugctheaters.fr/theaters/paris-odeon" \
  -H "User-Agent: Mozilla/5.0" \
  -o scraper/tests/fixtures/ugc-theater-page.html

# Fetch showtimes page
curl "https://www.ugctheaters.fr/showtimes?theater=UGC-PARIS&date=2026-03-18" \
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

private parseTheaterMetadata(html: string) {
  const $ = cheerio.load(html);
  
  // Example: Parse theater name from heading
  const name = $('h1.theater-title').text().trim();
  
  // Example: Parse theater ID from data attribute
  const id = $('[data-theater-id]').attr('data-theater-id');
  
  // Example: Parse address
  const address = $('.theater-address').text().trim();
  
  return {
    id: id || 'unknown',
    name: name || 'Unknown Theater',
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
2026-03-01: Theater website redesigns
  Old HTML:
    <div class="theater-name">...</div>
  New HTML:
    <h1 class="theater-title">...</h1>

  Result: Your parser breaks ❌
```

### Solution 1: Defensive Parsing with Fallbacks

```typescript
private parseTheaterName(html: string): string {
  const $ = cheerio.load(html);
  
  // Try primary selector
  let name = $('h1.theater-name').text().trim();
  
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
    logger.warn(`Could not parse theater name, using fallback`);
    return 'Unknown Theater';
  }
  
  return name;
}
```

### Solution 2: Version Your Parsers

```typescript
// Tracker version with parser version
const PARSER_VERSION = '2.0';  // Increment on breaking changes

private async parseShowtimes(html: string, theaterId: string, date: string) {
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
  const testUrl = 'https://...theater-url...';
  const date = formatDate(new Date());
  
  try {
    const result = await strategy.scrapeTheater(db, { url: testUrl }, date, 500);
    
    // Check if result looks reasonable
    if (result.moviesCount === 0) {
      logger.error(`${strategy.sourceName} parser returned 0 movies - possible HTML structure change`);
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
    theater: TheaterConfig,
    date: string,
    movieDelayMs: number,
    progress?: ProgressPublisher
  ) {
    try {
      return await this.primaryStrategy.scrapeTheater(db, theater, date, movieDelayMs, progress);
    } catch (primaryError) {
      logger.warn(`Primary strategy failed, trying fallback`, { error: primaryError });
      
      try {
        return await this.fallbackStrategy.scrapeTheater(db, theater, date, movieDelayMs, progress);
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
private movieCache = new Map<string, Movie>();

private async fetchMovieDetails(movieId: string, sourceUrl: string): Promise<Movie> {
  // Check cache first
  if (this.movieCache.has(movieId)) {
    return this.movieCache.get(movieId)!;
  }
  
  // Fetch from database
  const existing = await db.query('SELECT * FROM movies WHERE id = $1', [movieId]);
  if (existing.rows.length > 0) {
    const movie = existing.rows[0];
    this.movieCache.set(movieId, movie);
    return movie;
  }
  
  // Fetch from source
  const movie = await this.parseMovieFromUrl(sourceUrl);
  this.movieCache.set(movieId, movie);
  
  return movie;
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
  test('extractTheaterId parses ID correctly');
  test('cleanTheaterUrl removes query params');
  
  // ✅ Parsing
  test('parseTheaterMetadata extracts name, address, ID');
  test('parseAvailableDates returns valid dates');
  test('parseShowtimes returns movies and showtimes');
  test('parseShowtimes handles edge cases (no movies, duplicate movies)');
  
  // ✅ Error Handling
  test('handles missing HTML elements gracefully');
  test('handles malformed HTML');
  test('returns empty results rather than crashing');
  
  // ✅ Database Integration
  test('upserts theater to database');
  test('handles concurrent inserts');
});
```

### Integration Testing Checklist

```typescript
describe('CustomStrategy Integration', () => {
  // ✅ Real Theater Integration
  test('fetches real theater page (marked @slow, skip in CI)');
  test('parses real theater metadata');
  test('parses real showtimes');
  
  // ✅ Data Quality
  test('all movies have valid IDs and titles');
  test('all showtimes have valid times and theater_id');
  test('no duplicate showtimes');
  
  // ✅ Persistence
  test('theater is saved to database');
  test('movies are saved to database');
  test('showtimes are saved to database');
});
```

---

## Troubleshooting

### Problem: "No scraper strategy found for URL"

**Cause:** `canHandleUrl()` returns false for your theater URL

**Solution:**
```typescript
// Debug: Log which strategies are being checked
const url = 'https://example-theater.fr/showtimes';
for (const strategy of strategies) {
  const handles = strategy.canHandleUrl(url);
  console.log(`${strategy.sourceName}: ${handles}`);  // Identify which returned false
}

// Fix: Update canHandleUrl regex
canHandleUrl(url: string): boolean {
  // Was: /example-theater\.fr/
  // Now: /example-theater\.(fr|com)/  // Support both domains
  return /example-theater\.(fr|com)/.test(url);
}
```

### Problem: Parser returns 0 movies

**Cause:** Selector no longer matches website HTML

**Debug steps:**
```bash
# 1. Check if website changed
curl "https://example-theater.fr/showtimes" -o /tmp/page.html
open /tmp/page.html  # Visual inspection

# 2. Update test fixture
cp /tmp/page.html scraper/tests/fixtures/example-theater-page.html

# 3. Update selectors
const name = $('h1.theater-name').text();  // Was: div.theater-name
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
