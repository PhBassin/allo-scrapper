import * as cheerio from 'cheerio';

const REQUIRED_THEATER_SELECTORS = [
  '#theaterpage-showtimes-index-ui',
  '.movie-card-theater',
] as const;

const REQUIRED_FILM_SELECTORS = [
  '.meta-body-info',
] as const;

export function validateParserSelectors(
  html: string,
  selectors: readonly string[]
): { valid: boolean; missingSelectors: string[] } {
  const $ = cheerio.load(html);
  const missingSelectors = selectors
    .filter(selector => $(selector).length === 0)
    .map(selector => selector);

  return {
    valid: missingSelectors.length === 0,
    missingSelectors,
  };
}

export function validateTheaterPageStructure(html: string): { valid: boolean; missingSelectors: string[] } {
  return validateParserSelectors(html, REQUIRED_THEATER_SELECTORS);
}

export function validateFilmPageStructure(html: string): { valid: boolean; missingSelectors: string[] } {
  return validateParserSelectors(html, REQUIRED_FILM_SELECTORS);
}
