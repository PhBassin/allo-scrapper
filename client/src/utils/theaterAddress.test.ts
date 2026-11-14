import { describe, it, expect } from 'vitest';
import { formatTheaterAddress, buildGoogleMapsUrl } from './theaterAddress.js';

const MAPS_SEARCH = 'https://www.google.com/maps/search/?api=1&query=';

describe('formatTheaterAddress', () => {
  it('formats a full address as "address, postal_code city"', () => {
    expect(
      formatTheaterAddress({
        address: '24, Place Denfert-Rochereau',
        postal_code: '75014',
        city: 'Paris 14e arrondissement',
      })
    ).toBe('24, Place Denfert-Rochereau, 75014 Paris 14e arrondissement');
  });

  it('formats a city alone with no stray separators', () => {
    expect(formatTheaterAddress({ city: 'Paris 14e arrondissement' })).toBe('Paris 14e arrondissement');
  });

  it('formats a postal code and a city', () => {
    expect(formatTheaterAddress({ postal_code: '75014', city: 'Paris' })).toBe('75014 Paris');
  });

  it('formats an address and a city without a postal code', () => {
    expect(formatTheaterAddress({ address: '1 rue X', city: 'Lyon' })).toBe('1 rue X, Lyon');
  });

  it('formats an address alone', () => {
    expect(formatTheaterAddress({ address: '1 rue X' })).toBe('1 rue X');
  });

  it('returns an empty string when every part is empty', () => {
    expect(formatTheaterAddress({})).toBe('');
    expect(formatTheaterAddress({ address: '', postal_code: '', city: '' })).toBe('');
  });

  it('treats whitespace-only parts as empty and trims the others', () => {
    expect(formatTheaterAddress({ address: '   ', postal_code: ' 75014 ', city: ' Paris ' })).toBe('75014 Paris');
  });
});

describe('buildGoogleMapsUrl', () => {
  it('builds a place search URL from the name and the full address', () => {
    expect(
      buildGoogleMapsUrl({
        name: 'Denfert',
        address: '24, Place Denfert-Rochereau',
        postal_code: '75014',
        city: 'Paris',
      })
    ).toBe(MAPS_SEARCH + encodeURIComponent('Denfert, 24, Place Denfert-Rochereau, 75014 Paris'));
  });

  it('builds the URL from the name and the city only', () => {
    expect(buildGoogleMapsUrl({ name: 'UGC Bercy', city: 'Paris' })).toBe(
      MAPS_SEARCH + 'UGC%20Bercy%2C%20Paris'
    );
  });

  it('builds the URL from the name alone when every address part is empty', () => {
    expect(buildGoogleMapsUrl({ name: 'UGC Bercy', address: '', postal_code: '', city: '' })).toBe(
      MAPS_SEARCH + 'UGC%20Bercy'
    );
  });

  it('URL-encodes special characters', () => {
    const url = buildGoogleMapsUrl({ name: 'Pathé & Co #1', address: "Quai d'Austerlitz", city: 'Paris/13e?' });
    expect(url).toBe(MAPS_SEARCH + 'Path%C3%A9%20%26%20Co%20%231%2C%20Quai%20d\'Austerlitz%2C%20Paris%2F13e%3F');
    const query = new URL(url).searchParams.get('query');
    expect(query).toBe("Pathé & Co #1, Quai d'Austerlitz, Paris/13e?");
    expect(new URL(url).searchParams.get('api')).toBe('1');
  });

  it('never throws on lone UTF-16 surrogates and replaces them with U+FFFD', () => {
    const build = () => buildGoogleMapsUrl({ name: 'Ciné \ud83c', city: '\udc00Paris' });
    expect(build).not.toThrow();
    expect(new URL(build()).searchParams.get('query')).toBe('Ciné \ufffd, \ufffdParis');
  });

  it('keeps well-formed surrogate pairs (emoji) intact', () => {
    const url = buildGoogleMapsUrl({ name: 'Ciné 🎬', city: 'Paris' });
    expect(new URL(url).searchParams.get('query')).toBe('Ciné 🎬, Paris');
  });
});
