import type { Theater } from '../types/index.js';

type TheaterAddressParts = Pick<Theater, 'address' | 'postal_code' | 'city'>;

const GOOGLE_MAPS_SEARCH_URL = 'https://www.google.com/maps/search/?api=1&query=';

/**
 * Formats a Theater's address from its non-empty parts:
 * `address, postal_code city`, with no stray separators when a part is missing.
 * Returns an empty string when every part is empty.
 */
export function formatTheaterAddress({ address, postal_code, city }: TheaterAddressParts): string {
  const locality = [postal_code?.trim(), city?.trim()].filter(Boolean).join(' ');
  return [address?.trim(), locality].filter(Boolean).join(', ');
}

/**
 * Builds the Google Maps place-search URL for a Theater, querying its name
 * followed by its non-empty address parts.
 */
export function buildGoogleMapsUrl(theater: TheaterAddressParts & Pick<Theater, 'name'>): string {
  const query = [theater.name.trim(), formatTheaterAddress(theater)].filter(Boolean).join(', ');
  return GOOGLE_MAPS_SEARCH_URL + encodeURIComponent(query);
}
