import { describe, it, expect } from 'vitest';
import { parseFilmPage } from './film-parser.js';

describe('parseFilmPage', () => {
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

    const result = parseFilmPage(html);

    expect(result.duration_minutes).toBe(150);
    expect(result.trailer_url).toBe(
      'https://www.allocine.fr/video/player_gen_cmedia=20629685&cfilm=1000007317.html'
    );
    expect(result.director).toBe('Josh Safdie');
    expect(result.screenwriters).toEqual(['Josh Safdie', 'Ronald Bronstein']);
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

    const result = parseFilmPage(html);

    expect(result.duration_minutes).toBe(105);
    expect(result.director).toBe('Luca Guadagnino');
    expect(result.screenwriters).toEqual(['Justin Kuritzkes', 'Sam Writer']);
  });

  it('extracts trailer URL from modern trailer anchor markup', () => {
    const html = `
      <div class="meta-body-info">1h 10min</div>
      <a class="trailer roller-item" href="/video/player_gen_cmedia=19600934&amp;cfilm=296168.html"></a>
    `;

    const result = parseFilmPage(html);

    expect(result.trailer_url).toBe(
      'https://www.allocine.fr/video/player_gen_cmedia=19600934&cfilm=296168.html'
    );
  });
});
