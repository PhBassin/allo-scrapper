import type { RateLimitConfig } from '../api/rate-limits.js';

export type RateLimitFieldKey =
  | 'windowMs'
  | 'generalMax'
  | 'authMax'
  | 'registerMax'
  | 'protectedMax'
  | 'scraperMax'
  | 'publicMax'
  | 'healthMax';

export interface RateLimitFieldDef {
  key: RateLimitFieldKey;
  label: string;
  description: string;
  min: number;
  max: number;
  defaultValue: number;
  /**
   * If set, the input value is multiplied by this factor before being saved
   * (e.g. windowMs is stored in ms but the input is in minutes).
   * If null, the value is stored as-is.
   */
  valueFactor?: number;
}

export const RATE_LIMIT_FIELDS: ReadonlyArray<RateLimitFieldDef> = [
  {
    key: 'windowMs',
    label: 'Global Window (minutes)',
    description: 'Default time window for most rate limiters',
    min: 1,
    max: 60,
    defaultValue: 900000,
    valueFactor: 60000,
  },
  {
    key: 'generalMax',
    label: 'General API Limit',
    description: 'Max requests per window for general API endpoints',
    min: 10,
    max: 1000,
    defaultValue: 100,
  },
  {
    key: 'authMax',
    label: 'Login Limit',
    description: 'Max login attempts per window (failed only)',
    min: 3,
    max: 50,
    defaultValue: 5,
  },
  {
    key: 'registerMax',
    label: 'Registration Limit',
    description: 'Max registration attempts per hour',
    min: 1,
    max: 20,
    defaultValue: 3,
  },
  {
    key: 'protectedMax',
    label: 'Protected Endpoints Limit',
    description: 'Max requests per window for authenticated endpoints',
    min: 10,
    max: 500,
    defaultValue: 60,
  },
  {
    key: 'scraperMax',
    label: 'Scraper Limit',
    description: 'Max scrape requests per window (expensive operations)',
    min: 5,
    max: 100,
    defaultValue: 10,
  },
  {
    key: 'publicMax',
    label: 'Public Endpoints Limit',
    description: 'Max requests per window for public read endpoints',
    min: 20,
    max: 1000,
    defaultValue: 100,
  },
  {
    key: 'healthMax',
    label: 'Health Check Limit',
    description: 'Max health check requests per minute (localhost exempt)',
    min: 5,
    max: 100,
    defaultValue: 10,
  },
];

export function displayValue(
  field: RateLimitFieldDef,
  formData: Partial<RateLimitConfig>
): number {
  const raw = formData[field.key];
  const fallback = field.valueFactor
    ? Math.round(field.defaultValue / field.valueFactor)
    : field.defaultValue;
  if (raw == null) return fallback;
  if (field.valueFactor) return Math.round(raw / field.valueFactor);
  return raw;
}

export function toStoredValue(
  field: RateLimitFieldDef,
  displayInput: number
): number {
  return field.valueFactor ? displayInput * field.valueFactor : displayInput;
}
