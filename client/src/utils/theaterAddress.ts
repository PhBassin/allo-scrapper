import type { Theater } from '../types/index.js';

type TheaterAddressParts = Pick<Theater, 'address' | 'postal_code' | 'city'>;

const GOOGLE_MAPS_SEARCH_URL = 'https://www.google.com/maps/search/?api=1&query=';

// A high surrogate not followed by a low one, or a low surrogate not preceded by a high one.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Replaces lone UTF-16 surrogates with U+FFFD, like `String.prototype.toWellFormed`
 * (ES2024, outside this project's `lib`), so `encodeURIComponent` never throws.
 */
function toWellFormed(value: string): string {
  return value.replace(LONE_SURROGATE, '\uFFFD');
}

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
 * Joins a Theater's name and its already formatted address (see
 * `formatTheaterAddress`) into one location line: `name, address`.
 * Returns the name alone when the address is empty.
 */
export function formatTheaterLocation(name: string, formattedAddress: string): string {
  return [name.trim(), formattedAddress].filter(Boolean).join(', ');
}

/**
 * Builds the Google Maps place-search URL for a Theater, querying its name
 * followed by its already formatted address (see `formatTheaterAddress`).
 */
export function buildGoogleMapsUrl(name: string, formattedAddress: string): string {
  const query = formatTheaterLocation(name, formattedAddress);
  return GOOGLE_MAPS_SEARCH_URL + encodeURIComponent(toWellFormed(query));
}
