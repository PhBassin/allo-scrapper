import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseTheaterPage } from '../../../src/scraper/theater-parser.js';

// Get current directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test Suite 1: Theater C0089 (Max Linder Panorama) - NEW THEATER
describe('parseTheaterPage - Theater C0089 (Max Linder Panorama)', () => {
  let html: string;
  let result: ReturnType<typeof parseTheaterPage>;

  beforeAll(() => {
    const fixturePath = join(__dirname, '../../fixtures/theater-c0089-page.html');
    html = readFileSync(fixturePath, 'utf-8');
    result = parseTheaterPage(html, 'C0089');
  });

  it('should extract theater ID correctly', () => {
    expect(result.theater.id).toBe('C0089');
  });

  it('should extract theater name', () => {
    expect(result.theater.name).toBe('Max Linder Panorama');
  });

  it('should handle theater address (may be empty in some fixtures)', () => {
    // Address may not be in data-theater attribute
    expect(typeof result.theater.address).toBe('string');
  });

  it('should handle postal code (may be empty in some fixtures)', () => {
    // Postal code may not be in data-theater attribute
    expect(typeof result.theater.postal_code).toBe('string');
  });

  it('should extract city (may be empty in some fixtures)', () => {
    // City may not be in data-theater attribute
    expect(typeof result.theater.city).toBe('string');
  });

  it('should extract image URL if present', () => {
    if (result.theater.image_url) {
      expect(result.theater.image_url).toMatch(/^https?:\/\//);
    }
  });

  it('should parse available dates array', () => {
    expect(Array.isArray(result.dates)).toBe(true);
    expect(result.dates.length).toBeGreaterThanOrEqual(0);
  });

  it('should parse movies array', () => {
    expect(Array.isArray(result.movies)).toBe(true);
  });

  it('should have selected date', () => {
    expect(result.selected_date).toBeDefined();
  });

  it('should parse movie data with required fields', () => {
    if (result.movies.length > 0) {
      const firstMovie = result.movies[0];
      expect(firstMovie.movie).toBeDefined();
      expect(firstMovie.movie.id).toBeGreaterThan(0);
      expect(firstMovie.movie.title).toBeTruthy();
      expect(Array.isArray(firstMovie.showtimes)).toBe(true);
    }
  });

  it('should parse showtimes for each movie', () => {
    result.movies.forEach((movieData) => {
      expect(Array.isArray(movieData.showtimes)).toBe(true);
      movieData.showtimes.forEach((showtime) => {
        expect(showtime.id).toBeDefined();
        expect(showtime.movie_id).toBeGreaterThan(0);
        expect(showtime.theater_id).toBe('C0089');
        expect(showtime.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(showtime.time).toBeTruthy();
      });
    });
  });
});

// Test Suite 2: Regression Tests - Theater W7504 (Épée de Bois)
describe('parseTheaterPage - Regression: Theater W7504 (Épée de Bois)', () => {
  let html: string;
  let result: ReturnType<typeof parseTheaterPage>;

  beforeAll(() => {
    const fixturePath = join(__dirname, '../../fixtures/theater-w7504-page.html');
    html = readFileSync(fixturePath, 'utf-8');
    result = parseTheaterPage(html, 'W7504');
  });

  it('should parse theater W7504 correctly', () => {
    expect(result.theater.id).toBe('W7504');
    // Theater name from the source website may vary in capitalization and accents
    const nameLower = result.theater.name.toLowerCase();
    expect(nameLower).toMatch(/ep[eé]e/); // Matches "epee" or "épée"
    expect(nameLower).toContain('bois');
  });

  it('should extract theater data types', () => {
    // Location data may not always be present in data-theater
    expect(typeof result.theater.city).toBe('string');
    expect(typeof result.theater.postal_code).toBe('string');
  });

  it('should parse movies without errors', () => {
    expect(Array.isArray(result.movies)).toBe(true);
  });

  it('should parse showtimes correctly', () => {
    result.movies.forEach((movieData) => {
      expect(Array.isArray(movieData.showtimes)).toBe(true);
      movieData.showtimes.forEach((showtime) => {
        expect(showtime.theater_id).toBe('W7504');
      });
    });
  });
});

// Test Suite 3: Regression Tests - Theater C0072 (Le Grand Action)
describe('parseTheaterPage - Regression: Theater C0072 (Le Grand Action)', () => {
  let html: string;
  let result: ReturnType<typeof parseTheaterPage>;

  beforeAll(() => {
    const fixturePath = join(__dirname, '../../fixtures/theater-c0072-page.html');
    html = readFileSync(fixturePath, 'utf-8');
    result = parseTheaterPage(html, 'C0072');
  });

  it('should parse theater C0072 correctly', () => {
    expect(result.theater.id).toBe('C0072');
    expect(result.theater.name).toBe('Le Grand Action');
  });

  it('should extract theater data types', () => {
    // Location data may not always be present in data-theater
    expect(typeof result.theater.city).toBe('string');
    expect(typeof result.theater.postal_code).toBe('string');
  });

  it('should parse movies without errors', () => {
    expect(Array.isArray(result.movies)).toBe(true);
  });

  it('should parse showtimes correctly', () => {
    result.movies.forEach((movieData) => {
      expect(Array.isArray(movieData.showtimes)).toBe(true);
      movieData.showtimes.forEach((showtime) => {
        expect(showtime.theater_id).toBe('C0072');
      });
    });
  });
});

// Test Suite 4: Edge Cases
describe('parseTheaterPage - Edge Cases', () => {
  it('should handle missing theater data gracefully', () => {
    const minimalHtml = '<html><body><div id="theaterpage-showtimes-index-ui"></div></body></html>';
    const result = parseTheaterPage(minimalHtml, 'TEST123');

    expect(result.theater.id).toBe('TEST123');
    expect(result.theater.name).toBe('');
    expect(result.theater.address).toBe('');
    expect(result.theater.postal_code).toBe('');
    expect(result.theater.city).toBe('');
    expect(result.movies).toEqual([]);
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
    expect(result.theater.id).toBe('TEST456');
    expect(result.theater.name).toBe('');
  });

  it('should handle empty HTML', () => {
    const emptyHtml = '<html><body></body></html>';

    expect(() => parseTheaterPage(emptyHtml, 'EMPTY')).not.toThrow();
    const result = parseTheaterPage(emptyHtml, 'EMPTY');
    expect(result.theater.id).toBe('EMPTY');
    expect(result.movies).toEqual([]);
  });

  it('should handle theater with no movies showing', () => {
    const noMoviesHtml = `
      <html><body>
        <div id="theaterpage-showtimes-index-ui"
             data-theater='{"name":"Test Theater","location":{"address":"1 rue Test","postalCode":"75001","city":"Paris"}}'>
        </div>
      </body></html>
    `;

    const result = parseTheaterPage(noMoviesHtml, 'NOMOVIES');
    expect(result.theater.id).toBe('NOMOVIES');
    expect(result.theater.name).toBe('Test Theater');
    expect(result.movies).toEqual([]);
  });

  it('should return consistent structure for all cases', () => {
    const minimalHtml = '<html><body></body></html>';
    const result = parseTheaterPage(minimalHtml, 'CONSISTENT');

    expect(result).toHaveProperty('theater');
    expect(result).toHaveProperty('movies');
    expect(result).toHaveProperty('dates');
    expect(result).toHaveProperty('selected_date');

    expect(result.theater).toHaveProperty('id');
    expect(result.theater).toHaveProperty('name');
    expect(result.theater).toHaveProperty('address');
    expect(result.theater).toHaveProperty('postal_code');
    expect(result.theater).toHaveProperty('city');
  });
});

// Test Suite 4b: Theater metadata from JSON-LD and data-theater (issue #1355)
describe('parseTheaterPage - Theater metadata', () => {
  // The real former shape of the showtimes section's data-theater attribute
  // (see the fixtures' git history): location has city/region/zip only.
  const historicalDataTheater =
    '{"internalId":"C0089","location":{"city":"Paris","region":"Île-de-France","zip":"75009"},"name":"Max Linder Panorama"}';

  function page({ jsonLd = [] as string[], dataTheater }: { jsonLd?: string[]; dataTheater?: string }): string {
    const scripts = jsonLd.map((block) => `<script type="application/ld+json">${block}</script>`).join('\n');
    const attr = dataTheater === undefined ? '' : `data-theater='${dataTheater}'`;
    return `<html><head>${scripts}</head><body><div id="theaterpage-showtimes-index-ui" ${attr}></div></body></html>`;
  }

  it('reads address and image from the JSON-LD block when data-theater has only id and name', () => {
    const html = readFileSync(join(__dirname, '../../fixtures/theater-jsonld-address-page.html'), 'utf-8');
    const result = parseTheaterPage(html, 'C0024');

    expect(result.theater.name).toBe('Denfert');
    expect(result.theater.address).toBe('24, Place Denfert-Rochereau');
    expect(result.theater.postal_code).toBe('75014');
    expect(result.theater.city).toBe('Paris 14e arrondissement');
    expect(result.theater.image_url).toBe('https://fr.web.img6.acsta.net/r_234_234/theaterlogos/denfert.jpg');
  });

  it('reads address and image from the JSON-LD block of a real theater page', () => {
    const html = readFileSync(join(__dirname, '../../fixtures/theater-c0089-page.html'), 'utf-8');
    const result = parseTheaterPage(html, 'C0089');

    expect(result.theater.address).toBe('24 Bd Poissonnière');
    expect(result.theater.postal_code).toBe('75009');
    expect(result.theater.city).toBe('Paris');
    expect(result.theater.image_url).toBe('https://fr.web.img6.acsta.net/r_234_234/theaterlogos/2022/05/04/165638369.jpg');
  });

  it('falls back to data-theater location.city and location.zip when the page has no JSON-LD block', () => {
    const result = parseTheaterPage(page({ dataTheater: historicalDataTheater }), 'C0089');

    expect(result.theater.name).toBe('Max Linder Panorama');
    expect(result.theater.address).toBe('');
    expect(result.theater.postal_code).toBe('75009');
    expect(result.theater.city).toBe('Paris');
  });

  it('falls back to data-theater when the JSON-LD block is malformed', () => {
    const result = parseTheaterPage(page({ jsonLd: ['{not json'], dataTheater: historicalDataTheater }), 'C0089');

    expect(result.theater.postal_code).toBe('75009');
    expect(result.theater.city).toBe('Paris');
  });

  it('trims and decodes the data-theater fallback values', () => {
    const dataTheater = '{"name":"  Le Ch&#039;ti  ","location":{"city":"  L&#039;Isle-Adam ","zip":"   "}}';
    const result = parseTheaterPage(page({ dataTheater }), 'TRIM');

    expect(result.theater.name).toBe("Le Ch'ti");
    expect(result.theater.city).toBe("L'Isle-Adam");
    expect(result.theater.postal_code).toBe('');
  });

  it('decodes HTML entities in JSON-LD values', () => {
    const jsonLd = '{"@type":"MovieTheater","address":{"streetAddress":"2 rue de l&#039;Église","postalCode":"69001","addressLocality":"Lyon"}}';
    const result = parseTheaterPage(page({ jsonLd: [jsonLd], dataTheater: '{"id":"X","name":"X"}' }), 'ENT');

    expect(result.theater.address).toBe("2 rue de l'Église");
  });

  it('ignores JSON-LD nodes that are not a MovieTheater, even when they come first', () => {
    const organization = '{"@type":"Organization","name":"AlloCiné","address":{"streetAddress":"Siège","postalCode":"92100","addressLocality":"Boulogne"}}';
    const theater = '{"@type":"MovieTheater","image":"https://img/t.jpg","address":{"streetAddress":"1 rue A","postalCode":"75001","addressLocality":"Paris"}}';
    const result = parseTheaterPage(page({ jsonLd: [organization, theater] }), 'TYPE');

    expect(result.theater.address).toBe('1 rue A');
    expect(result.theater.postal_code).toBe('75001');
    expect(result.theater.image_url).toBe('https://img/t.jpg');
  });

  it('finds the MovieTheater node inside an @graph and with an array @type', () => {
    const graph = JSON.stringify({
      '@context': 'http://schema.org',
      '@graph': [
        { '@type': 'WebSite', address: { streetAddress: 'wrong' } },
        { '@type': ['LocalBusiness', 'MovieTheater'], address: { streetAddress: '3 rue C', postalCode: '13001', addressLocality: 'Marseille' } },
      ],
    });
    const result = parseTheaterPage(page({ jsonLd: [graph] }), 'GRAPH');

    expect(result.theater.address).toBe('3 rue C');
    expect(result.theater.city).toBe('Marseille');
  });

  it('does not take an address from a page without a MovieTheater node', () => {
    const organization = '{"@type":"Organization","address":{"streetAddress":"Siège","postalCode":"92100","addressLocality":"Boulogne"}}';
    const result = parseTheaterPage(page({ jsonLd: [organization], dataTheater: historicalDataTheater }), 'NOTYPE');

    expect(result.theater.address).toBe('');
    expect(result.theater.postal_code).toBe('75009');
    expect(result.theater.city).toBe('Paris');
  });

  it('reads the name from JSON-LD when data-theater is missing or malformed', () => {
    const jsonLd = '{"@type":"MovieTheater","name":"Le Champo"}';

    expect(parseTheaterPage(page({ jsonLd: [jsonLd] }), 'A').theater.name).toBe('Le Champo');
    expect(parseTheaterPage(page({ jsonLd: [jsonLd], dataTheater: '{broken' }), 'B').theater.name).toBe('Le Champo');
  });

  it('reads an ImageObject image from JSON-LD and falls back to data-theater.image', () => {
    const imageObject = '{"@type":"MovieTheater","image":{"@type":"ImageObject","url":"https://img/obj.jpg"}}';
    expect(parseTheaterPage(page({ jsonLd: [imageObject] }), 'IMG').theater.image_url).toBe('https://img/obj.jpg');

    const noImage = '{"@type":"MovieTheater","name":"X"}';
    const result = parseTheaterPage(page({ jsonLd: [noImage], dataTheater: '{"name":"X","image":"https://img/dt.jpg"}' }), 'IMG2');
    expect(result.theater.image_url).toBe('https://img/dt.jpg');
  });

  it('returns empty address fields and no image when neither source has them', () => {
    const result = parseTheaterPage(page({ dataTheater: '{"id":"X","name":"X"}' }), 'NONE');

    expect(result.theater.address).toBe('');
    expect(result.theater.postal_code).toBe('');
    expect(result.theater.city).toBe('');
    expect(result.theater.image_url).toBeUndefined();
  });
});

// Test Suite 5: Data Validation
describe('parseTheaterPage - Data Validation', () => {
  let c0089Html: string;
  let c0089Result: ReturnType<typeof parseTheaterPage>;
  let w7504Result: ReturnType<typeof parseTheaterPage>;
  let c0072Result: ReturnType<typeof parseTheaterPage>;

  beforeAll(() => {
    c0089Html = readFileSync(join(__dirname, '../../fixtures/theater-c0089-page.html'), 'utf-8');
    const w7504Html = readFileSync(join(__dirname, '../../fixtures/theater-w7504-page.html'), 'utf-8');
    const c0072Html = readFileSync(join(__dirname, '../../fixtures/theater-c0072-page.html'), 'utf-8');

    c0089Result = parseTheaterPage(c0089Html, 'C0089');
    w7504Result = parseTheaterPage(w7504Html, 'W7504');
    c0072Result = parseTheaterPage(c0072Html, 'C0072');
  });

  it('should parse valid movie IDs for all theaters', () => {
    [c0089Result, w7504Result, c0072Result].forEach((result) => {
      result.movies.forEach((movieData) => {
        expect(movieData.movie.id).toBeGreaterThan(0);
        expect(Number.isInteger(movieData.movie.id)).toBe(true);
      });
    });
  });

  it('should parse valid ISO dates for showtimes', () => {
    [c0089Result, w7504Result, c0072Result].forEach((result) => {
      result.movies.forEach((movieData) => {
        movieData.showtimes.forEach((showtime) => {
          expect(showtime.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          // Verify it's a valid date
          const date = new Date(showtime.date);
          expect(date.toString()).not.toBe('Invalid Date');
        });
      });
    });
  });

  it('should parse valid source URLs for movies', () => {
    [c0089Result, w7504Result, c0072Result].forEach((result) => {
      result.movies.forEach((movieData) => {
        expect(movieData.movie.source_url).toMatch(/^https:\/\/www\.allocine\.fr/);
        expect(movieData.movie.source_url).toContain('cfilm=');
      });
    });
  });

  it('should calculate week_start correctly', () => {
    [c0089Result, w7504Result, c0072Result].forEach((result) => {
      result.movies.forEach((movieData) => {
        movieData.showtimes.forEach((showtime) => {
          expect(showtime.week_start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          const weekStart = new Date(showtime.week_start);
          expect(weekStart.getDay()).toBe(3); // Wednesday = 3
        });
      });
    });
  });

  it('should generate deterministic showtime IDs based on stable business fields', () => {
    // IDs must be deterministic: same theater+movie+date+time+version+format always → same ID
    // Format: {theater_id}_{movie_id}_{date}_{time}_{version}_{format}
    // This prevents duplicates when the same theater is scraped multiple times in a week,
    // since Allociné's internal internalId/data-showtime-id changes on each HTTP request.
    const resultsByTheater = [
      { result: c0089Result, theaterId: 'C0089' },
      { result: w7504Result, theaterId: 'W7504' },
      { result: c0072Result, theaterId: 'C0072' },
    ];

    resultsByTheater.forEach(({ result, theaterId }) => {
      result.movies.forEach((movieData) => {
        movieData.showtimes.forEach((showtime) => {
          // ID must contain the theater ID to be scoped per theater
          expect(showtime.id).toContain(theaterId);
          // ID must contain the movie ID
          expect(showtime.id).toContain(String(movieData.movie.id));
          // ID must contain the date
          expect(showtime.id).toContain(showtime.date);
          // ID must contain the time
          expect(showtime.id).toContain(showtime.time);
          // New format: {theater_id}_{movie_id}_{date}_{time}_{version}_{format}
          expect(showtime.id).toMatch(/^[A-Z0-9]+_\d+_\d{4}-\d{2}-\d{2}_\d{2}:\d{2}_/);
        });
      });
    });
  });

  it('should generate the same showtime ID when parsing the same data twice (idempotent)', () => {
    // Re-parsing the same HTML must produce identical IDs — no duplicates on repeated scrapes
    const result1 = parseTheaterPage(c0089Html, 'C0089');
    const result2 = parseTheaterPage(c0089Html, 'C0089');

    const ids1 = result1.movies.flatMap(f => f.showtimes.map(s => s.id)).sort();
    const ids2 = result2.movies.flatMap(f => f.showtimes.map(s => s.id)).sort();

    expect(ids1).toEqual(ids2);
    // All IDs must be unique within a single parse (no duplicates)
    expect(ids1.length).toBe(new Set(ids1).size);
  });
});
