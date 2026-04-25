import * as cheerio from 'cheerio';

const KNOWN_GOOD_THEATER_HTML = `
  <section id="theaterpage-showtimes-index-ui">
    <article class="movie-card-theater"></article>
  </section>
`;

const KNOWN_GOOD_FILM_HTML = `
  <div class="meta-body-info">1h 30min</div>
`;

const REQUIRED_SELECTORS = [
  {
    selector: '#theaterpage-showtimes-index-ui',
    html: KNOWN_GOOD_THEATER_HTML,
  },
  {
    selector: '.movie-card-theater',
    html: KNOWN_GOOD_THEATER_HTML,
  },
  {
    selector: '.meta-body-info',
    html: KNOWN_GOOD_FILM_HTML,
  },
] as const;

export function validateParserSelectors(): { valid: boolean; missingSelectors: string[] } {
  const missingSelectors = REQUIRED_SELECTORS
    .filter(({ selector, html }) => cheerio.load(html)(selector).length === 0)
    .map(({ selector }) => selector);

  return {
    valid: missingSelectors.length === 0,
    missingSelectors,
  };
}
