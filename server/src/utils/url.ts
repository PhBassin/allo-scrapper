/**
 * URL utility functions for Allocine cinema URL validation and parsing.
 *
 * Extracted from the legacy server/src/services/scraper/utils.ts so that
 * the server can validate URLs for incoming API requests without depending
 * on the scraper codebase (which now lives in the scraper/ microservice).
 */

/**
 * Validates that the URL is a valid Allociné URL (https://www.allocine.fr/...)
 */
export function isValidAllocineUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'www.allocine.fr';
  } catch {
    return false;
  }
}

/**
 * Extracts the Allocine cinema ID (e.g., C0013) from a URL.
 * Strictly validates that the URL originates from www.allocine.fr to prevent SSRF.
 */
export function extractCinemaIdFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    // Strict domain validation
    if (parsedUrl.hostname !== 'www.allocine.fr') {
      return null;
    }
  } catch {
    // Invalid URL format
    return null;
  }

  const match = url.match(/(?:-salle=|_csalle=)([A-Z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Cleans an Allocine cinema URL by stripping fragments (#) and query parameters (?).
 * Returns a clean URL like https://www.allocine.fr/seance/salle_gen_csalle=W7517.html
 */
export function cleanCinemaUrl(url: string): string {
  // Remove everything from the first ? or # onwards
  return url.split(/[?#]/)[0];
}
