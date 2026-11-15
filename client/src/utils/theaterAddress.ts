import type { Theater } from '../types/index.js';

type TheaterAddressParts = Pick<Theater, 'address' | 'postal_code' | 'city'>;

const GOOGLE_MAPS_SEARCH_URL = 'https://www.google.com/maps/search/?api=1&query=';

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * Replaces lone UTF-16 surrogates with U+FFFD, like `String.prototype.toWellFormed`
 * (ES2024, outside this project's `lib`), so `encodeURIComponent` never throws.
 * A char-code loop rather than a regex: lookbehind breaks Safari before 16.4.
 */
function toWellFormed(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (isHighSurrogate(code) && i + 1 < value.length && isLowSurrogate(value.charCodeAt(i + 1))) {
      result += value[i] + value[i + 1];
      i++;
    } else if (isHighSurrogate(code) || isLowSurrogate(code)) {
      result += '\uFFFD';
    } else {
      result += value[i];
    }
  }
  return result;
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
