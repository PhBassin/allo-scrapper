import * as cheerio from 'cheerio';
import type { FilmPageData } from '../types/scraper.js';

function uniqueNonEmpty(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    if (!raw) continue;
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

function parseJsonLdCredits($: cheerio.CheerioAPI): {
  director?: string;
  screenwriters: string[];
} {
  let director: string | undefined;
  let screenwriters: string[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const nodes = Array.isArray(parsed)
      ? parsed
      : [parsed];

    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const movieNode = node as Record<string, unknown>;
      if (movieNode['@type'] !== 'Movie') continue;

      const directorNode = movieNode.director;
      if (typeof directorNode === 'object' && directorNode && 'name' in directorNode) {
        const name = (directorNode as { name?: unknown }).name;
        if (typeof name === 'string' && name.trim()) {
          director = director ?? name.trim();
        }
      } else if (Array.isArray(directorNode)) {
        const firstDirector = directorNode
          .map(item => (item && typeof item === 'object' && 'name' in item ? (item as { name?: unknown }).name : undefined))
          .find(name => typeof name === 'string' && name.trim());

        if (typeof firstDirector === 'string') {
          director = director ?? firstDirector.trim();
        }
      }

      const creatorNode = movieNode.creator;
      if (Array.isArray(creatorNode)) {
        const names = creatorNode
          .map(item => (item && typeof item === 'object' && 'name' in item ? (item as { name?: unknown }).name : undefined))
          .filter((name): name is string => typeof name === 'string');
        screenwriters = uniqueNonEmpty([...screenwriters, ...names]);
      } else if (creatorNode && typeof creatorNode === 'object' && 'name' in creatorNode) {
        const name = (creatorNode as { name?: unknown }).name;
        if (typeof name === 'string') {
          screenwriters = uniqueNonEmpty([...screenwriters, name]);
        }
      }
    }
  });

  return { director, screenwriters };
}

function parseVisualCredits($: cheerio.CheerioAPI): {
  director?: string;
  screenwriters: string[];
} {
  let director: string | undefined;
  let screenwriters: string[] = [];

  $('.meta-body-item.meta-body-direction').each((_, el) => {
    const $item = $(el);
    const label = $item.find('.light').first().text().trim().toLowerCase();
    const names = $item
      .find('.dark-grey-link')
      .map((__, link) => $(link).text().trim())
      .get();

    const cleanedNames = uniqueNonEmpty(names);
    if (!cleanedNames.length) return;

    if (label === 'de') {
      director = director ?? cleanedNames[0];
      return;
    }

    if (label === 'par') {
      screenwriters = uniqueNonEmpty([...screenwriters, ...cleanedNames]);
    }
  });

  return { director, screenwriters };
}

// Parse the film details page from the source website to extract duration and other supplementary info
export function parseFilmPage(html: string): FilmPageData {
  const $ = cheerio.load(html);

  let durationMinutes: number | undefined;

  const metaText = $('.meta-body-info').first().text();
  const durationMatch = metaText.match(/(\d+)h\s*(\d+)min/);

  if (durationMatch) {
    const hours = parseInt(durationMatch[1], 10);
    const minutes = parseInt(durationMatch[2], 10);
    durationMinutes = hours * 60 + minutes;
  } else {
    const hoursOnlyMatch = metaText.match(/(\d+)h/);
    if (hoursOnlyMatch) {
      durationMinutes = parseInt(hoursOnlyMatch[1], 10) * 60;
    }
  }

  let trailerUrl: string | undefined;
  const modernTrailerHref = $('a[href*="video/player_gen"]').first().attr('href');
  const legacyTrailerHref = $('.thumbnail-link[href*="video/player_gen"]').first().attr('href');
  const trailerHref = modernTrailerHref ?? legacyTrailerHref;

  if (trailerHref) {
    const normalizedHref = trailerHref.replace(/&amp;/g, '&');
    trailerUrl = normalizedHref.startsWith('http')
      ? normalizedHref
      : `https://www.allocine.fr${normalizedHref}`;
  }

  const jsonLdCredits = parseJsonLdCredits($);
  const visualCredits = parseVisualCredits($);

  const director = jsonLdCredits.director ?? visualCredits.director;
  const screenwriters = uniqueNonEmpty([
    ...jsonLdCredits.screenwriters,
    ...visualCredits.screenwriters,
  ]);

  return {
    duration_minutes: durationMinutes,
    trailer_url: trailerUrl,
    director,
    screenwriters: screenwriters.length > 0 ? screenwriters : undefined,
  };
}
