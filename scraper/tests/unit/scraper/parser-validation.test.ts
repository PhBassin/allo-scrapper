import { describe, it, expect } from 'vitest';
import { parseTheaterPage } from '../../../src/scraper/theater-parser.js';
import { parseFilmPage } from '../../../src/scraper/film-parser.js';
import { ParserStructureError } from '../../../src/utils/parser-errors.js';

describe('parseTheaterPage structure validation', () => {
  it('should throw ParserStructureError when #theaterpage-showtimes-index-ui is missing', () => {
    const html = '<html><body><h1>Some random page</h1></body></html>';
    expect(() => parseTheaterPage(html, 'C0089')).toThrow(ParserStructureError);
  });

  it('should throw ParserStructureError when .movie-card-theater is missing but page has showtimes UI', () => {
    const html = `
      <div id="theaterpage-showtimes-index-ui" data-theater='{"name":"Test Cinema"}' data-showtimes-dates='["2026-04-25"]' data-selected-date="2026-04-25">
        <p>No films today</p>
      </div>
    `;
    expect(() => parseTheaterPage(html, 'C0089')).toThrow(ParserStructureError);
  });
});

describe('parseFilmPage structure validation', () => {
  it('should throw ParserStructureError when .meta-body-info is missing', () => {
    const html = '<html><body><h1>Film page without metadata</h1></body></html>';
    expect(() => parseFilmPage(html)).toThrow(ParserStructureError);
  });
});
