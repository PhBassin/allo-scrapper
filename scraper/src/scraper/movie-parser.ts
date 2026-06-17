import * as cheerio from 'cheerio';
import type { MoviePageData } from '../types/scraper.js';

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

function extractPersonName(node: unknown): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const obj = node as { name?: unknown };
  if (typeof obj.name !== 'string') return undefined;
  const trimmed = obj.name.trim();
  return trimmed || undefined;
}

function extractDirectorFromJsonLd(node: Record<string, unknown>): string | undefined {
  const directorNode = node.director;
  if (Array.isArray(directorNode)) {
    const first = directorNode.map(extractPersonName).find((n): n is string => Boolean(n));
    return first?.trim();
  }
  return extractPersonName(directorNode)?.trim();
}

function extractScreenwritersFromJsonLd(node: Record<string, unknown>): string[] {
  const creatorNode = node.creator;
  if (Array.isArray(creatorNode)) {
    return creatorNode
      .map(extractPersonName)
      .filter((n): n is string => typeof n === 'string');
  }
  const single = extractPersonName(creatorNode);
  return single ? [single] : [];
}

function parseJsonLdMovieNode(node: unknown): { director?: string; screenwriters: string[] } | null {
  if (!node || typeof node !== 'object') return null;
  const movieNode = node as Record<string, unknown>;
  if (movieNode['@type'] !== 'Movie') return null;
  return {
    director: extractDirectorFromJsonLd(movieNode),
    screenwriters: extractScreenwritersFromJsonLd(movieNode),
  };
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

    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      const credits = parseJsonLdMovieNode(node);
      if (!credits) continue;
      director = director ?? credits.director;
      screenwriters = uniqueNonEmpty([...screenwriters, ...credits.screenwriters]);
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

export function parseDurationFromText(metaText: string): number | undefined {
  const hoursMinutes = metaText.match(/(\d+)h\s*(\d+)min/);
  if (hoursMinutes) {
    const hours = parseInt(hoursMinutes[1], 10);
    const minutes = parseInt(hoursMinutes[2], 10);
    return hours * 60 + minutes;
  }
  const hoursOnly = metaText.match(/(\d+)h/);
  if (hoursOnly) {
    return parseInt(hoursOnly[1], 10) * 60;
  }
  return undefined;
}

export function extractTrailerUrl($: cheerio.CheerioAPI): string | undefined {
  const modernHref = $('a[href*="video/player_gen"]').first().attr('href');
  const legacyHref = $('.thumbnail-link[href*="video/player_gen"]').first().attr('href');
  const trailerHref = modernHref ?? legacyHref;
  if (!trailerHref) return undefined;

  const normalized = trailerHref.replace(/&amp;/g, '&');
  return normalized.startsWith('http')
    ? normalized
    : `https://www.allocine.fr${normalized}`;
}

// Parse the movie details page from the source website to extract duration and other supplementary info
export function parseMoviePage(html: string): MoviePageData {
  const $ = cheerio.load(html);

  const durationMinutes = parseDurationFromText($('.meta-body-info').first().text());
  const trailerUrl = extractTrailerUrl($);

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
