/**
 * Safely parses a string into an integer.
 * Unlike parseInt, this strictly rejects strings containing non-numeric characters (like '123abc').
 *
 * @param value The value to parse
 * @returns The parsed integer, or NaN if the value is invalid or not strictly numeric
 */
export function parseStrictInt(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return NaN;
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : NaN;
  }

  const strValue = String(value).trim();

  // Only allow optional negative sign followed by digits
  if (!/^-?\d+$/.test(strValue)) {
    return NaN;
  }

  const parsed = Number(strValue);

  if (!Number.isSafeInteger(parsed)) {
    return NaN;
  }

  return parsed;
}
