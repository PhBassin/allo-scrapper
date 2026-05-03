import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parseFilmPage } from '../../../src/scraper/film-parser.js';
import { ParserStructureError } from '../../../src/utils/parser-errors.js';
import {
  validateFilmPageStructure,
  validateParserSelectors,
  validateTheaterPageStructure,
} from '../../../src/scraper/parser-health-check.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('parseFilmPage structure validation', () => {
  it('should throw ParserStructureError when .meta-body-info is missing', () => {
    const html = '<html><body><h1>Film page without metadata</h1></body></html>';
    expect(() => parseFilmPage(html)).toThrow(ParserStructureError);
  });
});

describe('validateParserSelectors health check', () => {
  it('reports valid when the provided HTML contains the required selectors', () => {
    const html = '<section id="theaterpage-showtimes-index-ui"><article class="movie-card-theater"></article></section>';
    const result = validateParserSelectors(html, ['#theaterpage-showtimes-index-ui', '.movie-card-theater']);

    expect(result.valid).toBe(true);
    expect(result.missingSelectors).toEqual([]);
  });

  it('reports missing selectors from real theater HTML input', () => {
    const html = '<section id="theaterpage-showtimes-index-ui"></section>';
    const result = validateParserSelectors(html, ['#theaterpage-showtimes-index-ui', '.movie-card-theater']);

    expect(result.valid).toBe(false);
    expect(result.missingSelectors).toEqual(['.movie-card-theater']);
  });

  it('validates theater structure against a real fixture', () => {
    const fixturePath = join(__dirname, '../../fixtures/cinema-c0089-page.html');
    const html = readFileSync(fixturePath, 'utf-8');
    const result = validateTheaterPageStructure(html);

    expect(result.valid).toBe(true);
    expect(result.missingSelectors).toEqual([]);
  });

  it('validates film structure against a real fixture', () => {
    const fixturePath = join(__dirname, '../../fixtures/film-page.html');
    const html = readFileSync(fixturePath, 'utf-8');
    const result = validateFilmPageStructure(html);

    expect(result.valid).toBe(true);
    expect(result.missingSelectors).toEqual([]);
  });
});
