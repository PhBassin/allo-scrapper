import { describe, it, expect } from 'vitest';
import { parseFilmPage } from '../../../src/scraper/film-parser.js';
import { ParserStructureError } from '../../../src/utils/parser-errors.js';
import { validateParserSelectors } from '../../../src/scraper/parser-health-check.js';

describe('parseFilmPage structure validation', () => {
  it('should throw ParserStructureError when .meta-body-info is missing', () => {
    const html = '<html><body><h1>Film page without metadata</h1></body></html>';
    expect(() => parseFilmPage(html)).toThrow(ParserStructureError);
  });
});

describe('validateParserSelectors health check', () => {
  it('should report valid when all known selectors are present in test HTML', () => {
    const result = validateParserSelectors();
    expect(result.valid).toBe(true);
    expect(result.missingSelectors).toEqual([]);
  });
});
