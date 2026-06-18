import { isAllocineUrl, validateName, validateUrl } from '../../../utils/theaterValidators.js';

/**
 * Allocine URLs are the canonical source for our scraper. Any URL we accept
 * here must point at the Allocine website so the scraper microservice can
 * fetch the cinema's showtimes page.
 *
 * Shared URL/name validators live in `utils/theaterValidators.ts`; only the
 * ID regex/length are AddTheaterModal-specific and stay local.
 */
const THEATER_ID_REGEX = /^[A-Za-z0-9]+$/;
const MAX_THEATER_ID_LENGTH = 20;

export interface SmartFormErrors {
  url?: string;
  submit?: string;
}

export interface ManualFormErrors {
  id?: string;
  name?: string;
  url?: string;
  submit?: string;
}

/**
 * Validate a single URL for the Smart Add tab. Returns an error message
 * or `undefined` if the URL is acceptable.
 */
export function validateSmartUrl(url: string): string | undefined {
  if (!url.trim()) return 'URL is required';
  if (!isAllocineUrl(url)) return 'Must be an Allocine URL (https://www.allocine.fr/...)';
  return validateUrl(url);
}

/**
 * Validate all fields for the Manual Add tab. Returns a (possibly empty)
 * errors map; the caller should treat any non-empty object as a validation
 * failure.
 */
export function validateManual(id: string, name: string, url: string): ManualFormErrors {
  const errors: ManualFormErrors = {};

  if (!id.trim()) {
    errors.id = 'ID is required';
  } else if (!THEATER_ID_REGEX.test(id)) {
    errors.id = 'ID must be alphanumeric only';
  } else if (id.length > MAX_THEATER_ID_LENGTH) {
    errors.id = `ID must be at most ${MAX_THEATER_ID_LENGTH} characters`;
  }

  const nameError = validateName(name);
  if (nameError) errors.name = nameError;

  if (!url.trim()) {
    errors.url = 'URL is required';
  } else {
    const urlError = validateUrl(url);
    if (urlError) errors.url = urlError;
  }

  return errors;
}