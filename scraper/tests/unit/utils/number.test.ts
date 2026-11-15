import { describe, it, expect } from 'vitest';
import { parseStrictInt } from '../../../src/utils/number.js';

describe('parseStrictInt', () => {
  it.each([
    ['42', 42],
    ['-7', -7],
    ['  15  ', 15],
    [0, 0],
    [123, 123],
  ])('parses %j as %j', (input, expected) => {
    expect(parseStrictInt(input)).toBe(expected);
  });

  it.each([
    [undefined],
    [null],
    [''],
    ['abc'],
    ['12abc'],
    ['1.5'],
    ['1e3'],
    [1.5],
    ['99999999999999999999'],
  ])('returns NaN for %j', (input) => {
    expect(parseStrictInt(input)).toBeNaN();
  });
});
