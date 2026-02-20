import * as cheerio from 'cheerio';
import type { FilmPageData } from '../types/scraper.js';

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
  const trailerLink = $('.thumbnail-link[href*="video/player_gen"]').first();
  if (trailerLink.length) {
    const href = trailerLink.attr('href');
    if (href) {
      trailerUrl = `https://www.example-cinema-site.com${href}`;
    }
  }

  return {
    duration_minutes: durationMinutes,
    trailer_url: trailerUrl,
  };
}
