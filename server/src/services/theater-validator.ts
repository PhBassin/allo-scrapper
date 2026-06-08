import { ValidationError } from '../utils/errors.js';
import { isValidAllocineUrl } from '../utils/url.js';

export function validateTheaterId(id: string): void {
  if (typeof id !== 'string' || !/^[A-Za-z0-9]+$/.test(id)) {
    throw new ValidationError('Invalid ID format. Must be alphanumeric string.');
  }
  if (id.length > 20) {
    throw new ValidationError('ID is too long (max 20 characters)');
  }
}

export function validateTheaterName(name: string): void {
  if (typeof name !== 'string' || !name || name.length > 100) {
    throw new ValidationError('Name must be a string between 1 and 100 characters');
  }
}

export function validateTheaterUrl(url: string): void {
  if (typeof url !== 'string' || url.length > 2048) {
    throw new ValidationError('URL is too long (max 2048 characters)');
  }
  if (!isValidAllocineUrl(url)) {
    throw new ValidationError('Invalid Allocine URL. Must be https://www.allocine.fr/...');
  }
}

export function validateOptionalUrl(url: string | undefined): void {
  if (url !== undefined) {
    validateTheaterUrl(url);
  }
}

export function validateAddress(address: string | undefined): void {
  if (address !== undefined && (typeof address !== 'string' || address.length > 200)) {
    throw new ValidationError('Address must be at most 200 characters');
  }
}

export function validatePostalCode(postalCode: string | undefined): void {
  if (postalCode !== undefined) {
    if (typeof postalCode !== 'string' || postalCode.length > 10) {
      throw new ValidationError('Postal code must be at most 10 characters');
    }
    if (postalCode && !/^[a-zA-Z0-9]+$/.test(postalCode)) {
      throw new ValidationError('Postal code must be alphanumeric');
    }
  }
}

export function validateCity(city: string | undefined): void {
  if (city !== undefined && (typeof city !== 'string' || city.length > 100)) {
    throw new ValidationError('City must be at most 100 characters');
  }
}

export function validateScreenCount(screenCount: number | undefined | null): void {
  if (screenCount !== undefined && screenCount !== null) {
    if (typeof screenCount !== 'number') {
      throw new ValidationError('Screen count must be a number');
    }
    if (!Number.isInteger(screenCount)) {
      throw new ValidationError('Screen count must be an integer');
    }
    if (screenCount < 1 || screenCount > 50) {
      throw new ValidationError('Screen count must be between 1 and 50');
    }
  }
}

export function validateAtLeastOneField(
  data: Record<string, unknown>,
  fields: string[],
): void {
  const hasField = fields.some((f) => data[f] !== undefined && data[f] !== null && data[f] !== '');
  if (!hasField) {
    throw new ValidationError(`At least one field must be provided: ${fields.join(', ')}`);
  }
}
