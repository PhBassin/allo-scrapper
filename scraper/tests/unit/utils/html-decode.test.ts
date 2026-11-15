import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities, decodeHtmlEntitiesArray } from '../../../src/utils/html-decode.js';

describe('decodeHtmlEntities', () => {
  it('returns undefined for undefined input', () => {
    expect(decodeHtmlEntities(undefined)).toBeUndefined();
  });

  it('decodes decimal entities', () => {
    expect(decodeHtmlEntities('L&#039;histoire')).toBe("L'histoire");
  });

  it('decodes hexadecimal entities', () => {
    expect(decodeHtmlEntities('Caf&#xE9;')).toBe('Café');
  });

  it('decodes named entities', () => {
    expect(decodeHtmlEntities('Caf&eacute; &amp; th&eacute;')).toBe('Café & thé');
  });

  it('leaves unknown named entities untouched', () => {
    expect(decodeHtmlEntities('&unknown; text')).toBe('&unknown; text');
  });

  it('leaves plain text untouched', () => {
    expect(decodeHtmlEntities('Plain text')).toBe('Plain text');
  });
});

describe('decodeHtmlEntitiesArray', () => {
  it('decodes every string of the array', () => {
    expect(decodeHtmlEntitiesArray(['Th&eacute;&acirc;tre', 'Com&eacute;die'])).toEqual(['Théâtre', 'Comédie']);
  });
});
