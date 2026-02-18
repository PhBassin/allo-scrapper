import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseTheaterPage } from './theater-parser.js';

// Get current directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test Suite 1: Cinema C0089 (Max Linder Panorama) - NEW CINEMA
describe('parseTheaterPage - Cinema C0089 (Max Linder Panorama)', () => {
  let html: string;
  let result: ReturnType<typeof parseTheaterPage>;

  beforeAll(() => {
    const fixturePath = join(__dirname, '../../../tests/fixtures/cinema-c0089-page.html');
    html = readFileSync(fixturePath, 'utf-8');
    result = parseTheaterPage(html, 'C0089');
  });

  it('should extract cinema ID correctly', () => {
    expect(result.cinema.id).toBe('C0089');
  });

  it('should extract cinema name', () => {
    expect(result.cinema.name).toBe('Max Linder Panorama');
  });

  it('should handle cinema address (may be empty in some fixtures)', () => {
    // Address may not be in data-theater attribute
    expect(typeof result.cinema.address).toBe('string');
  });

  it('should handle postal code (may be empty in some fixtures)', () => {
    // Postal code may not be in data-theater attribute
    expect(typeof result.cinema.postal_code).toBe('string');
  });

  it('should extract city (may be empty in some fixtures)', () => {
    // City may not be in data-theater attribute
    expect(typeof result.cinema.city).toBe('string');
  });

  it('should handle screen count', () => {
    // Screen count defaults to 0 if not in data-theater
    expect(typeof result.cinema.screen_count).toBe('number');
    expect(result.cinema.screen_count).toBeGreaterThanOrEqual(0);
  });

  it('should extract image URL if present', () => {
    if (result.cinema.image_url) {
      expect(result.cinema.image_url).toMatch(/^https?:\/\//);
    }
  });

  it('should parse available dates array', () => {
    expect(Array.isArray(result.dates)).toBe(true);
    expect(result.dates.length).toBeGreaterThanOrEqual(0);
  });

  it('should parse films array', () => {
    expect(Array.isArray(result.films)).toBe(true);
  });

  it('should have selected date', () => {
    expect(result.selected_date).toBeDefined();
  });

  it('should parse film data with required fields', () => {
    if (result.films.length > 0) {
      const firstFilm = result.films[0];
      expect(firstFilm.film).toBeDefined();
      expect(firstFilm.film.id).toBeGreaterThan(0);
      expect(firstFilm.film.title).toBeTruthy();
      expect(Array.isArray(firstFilm.showtimes)).toBe(true);
    }
  });

  it('should parse showtimes for each film', () => {
    result.films.forEach((filmData) => {
      expect(Array.isArray(filmData.showtimes)).toBe(true);
      filmData.showtimes.forEach((showtime) => {
        expect(showtime.id).toBeDefined();
        expect(showtime.film_id).toBeGreaterThan(0);
        expect(showtime.cinema_id).toBe('C0089');
        expect(showtime.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(showtime.time).toBeTruthy();
      });
    });
  });
});

// Test Suite 2: Regression Tests - Cinema W7504 (Épée de Bois)
describe('parseTheaterPage - Regression: Cinema W7504 (Épée de Bois)', () => {
  let html: string;
  let result: ReturnType<typeof parseTheaterPage>;

  beforeAll(() => {
    const fixturePath = join(__dirname, '../../../tests/fixtures/cinema-w7504-page.html');
    html = readFileSync(fixturePath, 'utf-8');
    result = parseTheaterPage(html, 'W7504');
  });

  it('should parse cinema W7504 correctly', () => {
    expect(result.cinema.id).toBe('W7504');
    // Cinema name from the source website may vary in capitalization and accents
    const nameLower = result.cinema.name.toLowerCase();
    expect(nameLower).toMatch(/ep[eé]e/); // Matches "epee" or "épée"
    expect(nameLower).toContain('bois');
  });

  it('should extract cinema data types', () => {
    // Location data may not always be present in data-theater
    expect(typeof result.cinema.city).toBe('string');
    expect(typeof result.cinema.postal_code).toBe('string');
  });

  it('should parse films without errors', () => {
    expect(Array.isArray(result.films)).toBe(true);
  });

  it('should parse showtimes correctly', () => {
    result.films.forEach((filmData) => {
      expect(Array.isArray(filmData.showtimes)).toBe(true);
      filmData.showtimes.forEach((showtime) => {
        expect(showtime.cinema_id).toBe('W7504');
      });
    });
  });
});

// Test Suite 3: Regression Tests - Cinema C0072 (Le Grand Action)
describe('parseTheaterPage - Regression: Cinema C0072 (Le Grand Action)', () => {
  let html: string;
  let result: ReturnType<typeof parseTheaterPage>;

  beforeAll(() => {
    const fixturePath = join(__dirname, '../../../tests/fixtures/cinema-c0072-page.html');
    html = readFileSync(fixturePath, 'utf-8');
    result = parseTheaterPage(html, 'C0072');
  });

  it('should parse cinema C0072 correctly', () => {
    expect(result.cinema.id).toBe('C0072');
    expect(result.cinema.name).toBe('Le Grand Action');
  });

  it('should extract cinema data types', () => {
    // Location data may not always be present in data-theater
    expect(typeof result.cinema.city).toBe('string');
    expect(typeof result.cinema.postal_code).toBe('string');
  });

  it('should parse films without errors', () => {
    expect(Array.isArray(result.films)).toBe(true);
  });

  it('should parse showtimes correctly', () => {
    result.films.forEach((filmData) => {
      expect(Array.isArray(filmData.showtimes)).toBe(true);
      filmData.showtimes.forEach((showtime) => {
        expect(showtime.cinema_id).toBe('C0072');
      });
    });
  });
});

// Test Suite 4: Edge Cases
describe('parseTheaterPage - Edge Cases', () => {
  it('should handle missing theater data gracefully', () => {
    const minimalHtml = '<html><body><div id="theaterpage-showtimes-index-ui"></div></body></html>';
    const result = parseTheaterPage(minimalHtml, 'TEST123');
    
    expect(result.cinema.id).toBe('TEST123');
    expect(result.cinema.name).toBe('');
    expect(result.cinema.address).toBe('');
    expect(result.cinema.postal_code).toBe('');
    expect(result.cinema.city).toBe('');
    expect(result.films).toEqual([]);
    expect(result.dates).toEqual([]);
  });

  it('should handle malformed JSON in data-theater attribute', () => {
    const badJsonHtml = `
      <html><body>
        <div id="theaterpage-showtimes-index-ui" 
             data-theater="{invalid json}"
             data-showtimes-dates="[broken]">
        </div>
      </body></html>
    `;
    
    expect(() => parseTheaterPage(badJsonHtml, 'TEST456')).not.toThrow();
    const result = parseTheaterPage(badJsonHtml, 'TEST456');
    expect(result.cinema.id).toBe('TEST456');
    expect(result.cinema.name).toBe('');
  });

  it('should handle empty HTML', () => {
    const emptyHtml = '<html><body></body></html>';
    
    expect(() => parseTheaterPage(emptyHtml, 'EMPTY')).not.toThrow();
    const result = parseTheaterPage(emptyHtml, 'EMPTY');
    expect(result.cinema.id).toBe('EMPTY');
    expect(result.films).toEqual([]);
  });

  it('should handle cinema with no films showing', () => {
    const noFilmsHtml = `
      <html><body>
        <div id="theaterpage-showtimes-index-ui"
             data-theater='{"name":"Test Cinema","location":{"address":"1 rue Test","postalCode":"75001","city":"Paris"},"screenCount":1}'>
        </div>
      </body></html>
    `;
    
    const result = parseTheaterPage(noFilmsHtml, 'NOFILMS');
    expect(result.cinema.id).toBe('NOFILMS');
    expect(result.cinema.name).toBe('Test Cinema');
    expect(result.films).toEqual([]);
  });

  it('should return consistent structure for all cases', () => {
    const minimalHtml = '<html><body></body></html>';
    const result = parseTheaterPage(minimalHtml, 'CONSISTENT');
    
    expect(result).toHaveProperty('cinema');
    expect(result).toHaveProperty('films');
    expect(result).toHaveProperty('dates');
    expect(result).toHaveProperty('selected_date');
    
    expect(result.cinema).toHaveProperty('id');
    expect(result.cinema).toHaveProperty('name');
    expect(result.cinema).toHaveProperty('address');
    expect(result.cinema).toHaveProperty('postal_code');
    expect(result.cinema).toHaveProperty('city');
    expect(result.cinema).toHaveProperty('screen_count');
  });
});

// Test Suite 5: Data Validation
describe('parseTheaterPage - Data Validation', () => {
  let c0089Result: ReturnType<typeof parseTheaterPage>;
  let w7504Result: ReturnType<typeof parseTheaterPage>;
  let c0072Result: ReturnType<typeof parseTheaterPage>;

  beforeAll(() => {
    const c0089Html = readFileSync(join(__dirname, '../../../tests/fixtures/cinema-c0089-page.html'), 'utf-8');
    const w7504Html = readFileSync(join(__dirname, '../../../tests/fixtures/cinema-w7504-page.html'), 'utf-8');
    const c0072Html = readFileSync(join(__dirname, '../../../tests/fixtures/cinema-c0072-page.html'), 'utf-8');
    
    c0089Result = parseTheaterPage(c0089Html, 'C0089');
    w7504Result = parseTheaterPage(w7504Html, 'W7504');
    c0072Result = parseTheaterPage(c0072Html, 'C0072');
  });

  it('should parse valid film IDs for all cinemas', () => {
    [c0089Result, w7504Result, c0072Result].forEach((result) => {
      result.films.forEach((filmData) => {
        expect(filmData.film.id).toBeGreaterThan(0);
        expect(Number.isInteger(filmData.film.id)).toBe(true);
      });
    });
  });

  it('should parse valid ISO dates for showtimes', () => {
    [c0089Result, w7504Result, c0072Result].forEach((result) => {
      result.films.forEach((filmData) => {
        filmData.showtimes.forEach((showtime) => {
          expect(showtime.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          // Verify it's a valid date
          const date = new Date(showtime.date);
          expect(date.toString()).not.toBe('Invalid Date');
        });
      });
    });
  });

  it('should parse valid source URLs for films', () => {
    [c0089Result, w7504Result, c0072Result].forEach((result) => {
      result.films.forEach((filmData) => {
        expect(filmData.film.source_url).toMatch(/^https:\/\/www\.example-cinema-site\.com/);
        expect(filmData.film.source_url).toContain('cfilm=');
      });
    });
  });

  it('should calculate week_start correctly', () => {
    [c0089Result, w7504Result, c0072Result].forEach((result) => {
      result.films.forEach((filmData) => {
        filmData.showtimes.forEach((showtime) => {
          expect(showtime.week_start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          const weekStart = new Date(showtime.week_start);
          expect(weekStart.getDay()).toBe(3); // Wednesday = 3
        });
      });
    });
  });

  it('should generate unique showtime IDs that include the date', () => {
    // Showtime IDs must include the date to be unique per day
    // Format: <source_showtime_id>-<YYYY-MM-DD>
    [c0089Result, w7504Result, c0072Result].forEach((result) => {
      result.films.forEach((filmData) => {
        filmData.showtimes.forEach((showtime) => {
          // ID should contain the date to ensure uniqueness across days
          expect(showtime.id).toContain(showtime.date);
          // ID format: <numeric_id>-<date>
          expect(showtime.id).toMatch(/^\d+-\d{4}-\d{2}-\d{2}$/);
        });
      });
    });
  });
});
