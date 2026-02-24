import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities, decodeHtmlEntitiesArray } from './html-decode.js';

describe('decodeHtmlEntities', () => {
  describe('apostrophes and quotes', () => {
    it('should decode numeric apostrophe &#039;', () => {
      const input = "L&#039;histoire d&#039;un voyage";
      const expected = "L'histoire d'un voyage";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode named apostrophe &apos;', () => {
      const input = "L&apos;histoire";
      const expected = "L'histoire";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode double quotes &quot;', () => {
      const input = 'Il a dit &quot;bonjour&quot;';
      const expected = 'Il a dit "bonjour"';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });
  });

  describe('accented characters', () => {
    it('should decode é (&eacute;)', () => {
      const input = "Caf&eacute;";
      const expected = "Café";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode à (&agrave;)', () => {
      const input = "&Agrave; la maison";
      const expected = "À la maison";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode è (&egrave;)', () => {
      const input = "Tr&egrave;s bien";
      const expected = "Très bien";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode ê (&ecirc;)', () => {
      const input = "Th&eacute;&acirc;tre";
      const expected = "Théâtre";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode ï (&iuml;)', () => {
      const input = "Na&iuml;f";
      const expected = "Naïf";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode ô (&ocirc;)', () => {
      const input = "H&ocirc;tel";
      const expected = "Hôtel";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode ç (&ccedil;)', () => {
      const input = "Fran&ccedil;ais";
      const expected = "Français";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });
  });

  describe('special characters', () => {
    it('should decode ampersand &amp;', () => {
      const input = "Vous &amp; moi";
      const expected = "Vous & moi";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode less than &lt; and greater than &gt;', () => {
      const input = "2 &lt; 3 &gt; 1";
      const expected = "2 < 3 > 1";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode non-breaking space &nbsp;', () => {
      const input = "Espace&nbsp;insécable";
      const expected = "Espace\u00A0insécable";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });
  });

  describe('mixed entities', () => {
    it('should decode multiple entities in one string', () => {
      const input = "L&#039;histoire d&#039;un voyage en apn&eacute;e";
      const expected = "L'histoire d'un voyage en apnée";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode complex synopsis with multiple entity types', () => {
      const input = "Th&eacute;&acirc;tre &amp; Com&eacute;die : &quot;L&#039;&ecirc;tre&quot;";
      const expected = "Théâtre & Comédie : \"L'être\"";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });
  });

  describe('edge cases', () => {
    it('should return unchanged string without entities', () => {
      const input = "Aucune entité HTML";
      expect(decodeHtmlEntities(input)).toBe(input);
    });

    it('should handle empty string', () => {
      expect(decodeHtmlEntities("")).toBe("");
    });

    it('should return undefined for undefined input', () => {
      expect(decodeHtmlEntities(undefined)).toBeUndefined();
    });

    it('should handle string with only entities', () => {
      const input = "&eacute;&agrave;&egrave;";
      const expected = "éàè";
      expect(decodeHtmlEntities(input)).toBe(expected);
    });
  });
});

describe('decodeHtmlEntitiesArray', () => {
  it('should decode all strings in array', () => {
    const input = ["Th&eacute;&acirc;tre", "Com&eacute;die", "L&#039;action"];
    const expected = ["Théâtre", "Comédie", "L'action"];
    expect(decodeHtmlEntitiesArray(input)).toEqual(expected);
  });

  it('should handle empty array', () => {
    expect(decodeHtmlEntitiesArray([])).toEqual([]);
  });

  it('should handle array with plain strings', () => {
    const input = ["Drame", "Action", "Aventure"];
    expect(decodeHtmlEntitiesArray(input)).toEqual(input);
  });

  it('should handle array with mixed encoded and plain strings', () => {
    const input = ["Drame", "Com&eacute;die", "Action"];
    const expected = ["Drame", "Comédie", "Action"];
    expect(decodeHtmlEntitiesArray(input)).toEqual(expected);
  });
});
