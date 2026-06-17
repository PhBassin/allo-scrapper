import { describe, it, expect } from 'vitest';
import { load } from 'cheerio';
import {
  parseMoviePage,
  parseDurationFromText,
  extractTrailerUrl,
} from './movie-parser.js';

describe('parseDurationFromText', () => {
  it('parses hours and minutes', () => {
    expect(parseDurationFromText('2h 30min')).toBe(150);
    expect(parseDurationFromText('1h 45min')).toBe(105);
  });

  it('parses hours only', () => {
    expect(parseDurationFromText('2h')).toBe(120);
  });

  it('returns undefined for missing duration', () => {
    expect(parseDurationFromText('')).toBeUndefined();
    expect(parseDurationFromText('no duration here')).toBeUndefined();
  });
});

describe('extractTrailerUrl', () => {
  it('returns absolute URL unchanged (after &amp; normalization)', () => {
    const html = '<a class="trailer" href="https://www.allocine.fr/video/player_gen_abc.html"></a>';
    const $ = load(html);
    expect(extractTrailerUrl($)).toBe('https://www.allocine.fr/video/player_gen_abc.html');
  });

  it('prepends host for relative URL', () => {
    const html = '<a class="trailer" href="/video/player_gen_abc.html"></a>';
    const $ = load(html);
    expect(extractTrailerUrl($)).toBe('https://www.allocine.fr/video/player_gen_abc.html');
  });

  it('normalizes &amp; entities', () => {
    const html = '<a class="trailer" href="/video/player_gen_cmedia=1&amp;cfilm=2.html"></a>';
    const $ = load(html);
    expect(extractTrailerUrl($)).toBe(
      'https://www.allocine.fr/video/player_gen_cmedia=1&cfilm=2.html'
    );
  });

  it('prefers modern trailer over legacy', () => {
    const html = `
      <a class="trailer" href="/video/player_gen_modern.html"></a>
      <a class="thumbnail-link" href="/video/player_gen_legacy.html"></a>
    `;
    const $ = load(html);
    expect(extractTrailerUrl($)).toBe('https://www.allocine.fr/video/player_gen_modern.html');
  });

  it('returns undefined when no trailer', () => {
    const $ = load('<html><body></body></html>');
    expect(extractTrailerUrl($)).toBeUndefined();
  });
});

describe('parseMoviePage', () => {
  it('extracts director and screenwriters from JSON-LD', () => {
    const html = `
      <div class="meta-body-info">2h 30min</div>
      <a class="thumbnail-link" href="/video/player_gen_cmedia=20629685&amp;cfilm=1000007317.html"></a>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Movie",
        "director": {
          "@type": "Person",
          "name": "Josh Safdie"
        },
        "creator": [
          { "@type": "Person", "name": "Josh Safdie" },
          { "@type": "Person", "name": "Ronald Bronstein" }
        ]
      }
      </script>
    `;

    const result = parseMoviePage(html);

    expect(result.duration_minutes).toBe(150);
    expect(result.trailer_url).toBe(
      'https://www.allocine.fr/video/player_gen_cmedia=20629685&cfilm=1000007317.html'
    );
    expect(result.director).toBe('Josh Safdie');
    expect(result.screenwriters).toEqual(['Josh Safdie', 'Ronald Bronstein']);
  });

  it('accepts director as array of persons', () => {
    const html = `
      <div class="meta-body-info"></div>
      <script type="application/ld+json">
      {
        "@type": "Movie",
        "director": [
          { "@type": "Person", "name": "  Co-Director A  " },
          { "@type": "Person", "name": "Co-Director B" }
        ]
      }
      </script>
    `;

    const result = parseMoviePage(html);
    expect(result.director).toBe('Co-Director A');
  });

  it('ignores non-Movie nodes in JSON-LD array', () => {
    const html = `
      <div class="meta-body-info"></div>
      <script type="application/ld+json">
      [
        { "@type": "WebPage", "name": "ignored" },
        { "@type": "Movie", "director": { "name": "  Real Director  " } }
      ]
      </script>
    `;

    const result = parseMoviePage(html);
    expect(result.director).toBe('Real Director');
  });

  it('skips malformed JSON-LD blocks without throwing', () => {
    const html = `
      <div class="meta-body-info"></div>
      <script type="application/ld+json">{ broken</script>
      <script type="application/ld+json">
      { "@type": "Movie", "director": { "name": "Valid" } }
      </script>
    `;

    const result = parseMoviePage(html);
    expect(result.director).toBe('Valid');
  });

  it('falls back to visual De/Par blocks when JSON-LD is missing', () => {
    const html = `
      <div class="meta-body-info">1h 45min</div>
      <div class="meta-body-item meta-body-direction meta-body-oneline">
        <span class="light">De</span>
        <span class="dark-grey-link">Luca Guadagnino</span>
      </div>
      <div class="meta-body-item meta-body-direction meta-body-oneline">
        <span class="light">Par</span>
        <span class="dark-grey-link">Justin Kuritzkes</span>,
        <span class="dark-grey-link">Sam Writer</span>
      </div>
    `;

    const result = parseMoviePage(html);

    expect(result.duration_minutes).toBe(105);
    expect(result.director).toBe('Luca Guadagnino');
    expect(result.screenwriters).toEqual(['Justin Kuritzkes', 'Sam Writer']);
  });

  it('extracts trailer URL from modern trailer anchor markup', () => {
    const html = `
      <div class="meta-body-info">1h 10min</div>
      <a class="trailer roller-item" href="/video/player_gen_cmedia=19600934&amp;cfilm=296168.html"></a>
    `;

    const result = parseMoviePage(html);

    expect(result.trailer_url).toBe(
      'https://www.allocine.fr/video/player_gen_cmedia=19600934&cfilm=296168.html'
    );
  });

  it('merges JSON-LD and visual screenwriters (deduped)', () => {
    const html = `
      <div class="meta-body-info"></div>
      <script type="application/ld+json">
      { "@type": "Movie", "creator": [{ "name": "Alice" }] }
      </script>
      <div class="meta-body-item meta-body-direction">
        <span class="light">Par</span>
        <span class="dark-grey-link">Alice</span>,
        <span class="dark-grey-link">Bob</span>
      </div>
    `;

    const result = parseMoviePage(html);
    expect(result.screenwriters).toEqual(['Alice', 'Bob']);
  });
});
