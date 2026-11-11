import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildBlocklist,
  decodeHashcatHex,
  isKept,
  normalise,
} from './generate-common-passwords.mjs';

const MARKER = '# --- supplement ---';

function current(supplement) {
  return ['# header', '# more header', 'oldentry1234', MARKER, ...supplement, ''].join('\n');
}

describe('generate-common-passwords', () => {
  describe('decodeHashcatHex', () => {
    it('decodes $HEX[...] in any case', () => {
      expect(decodeHashcatHex('$HEX[70617373776f726431323334]')).toBe('password1234');
      expect(decodeHashcatHex('$hex[70617373776F726431323334]')).toBe('password1234');
    });

    it('returns a plain line unchanged', () => {
      expect(decodeHashcatHex('password1234')).toBe('password1234');
    });

    it('refuses an odd number of hex digits instead of truncating it', () => {
      expect(decodeHashcatHex('$HEX[70617373776f72643132333]')).toBeNull();
      expect(normalise('$HEX[70617373776f72643132333]')).toBeNull();
    });
  });

  describe('isKept', () => {
    it('keeps a printable ASCII entry of 12 to 128 characters', () => {
      expect(isKept('correct horse')).toBe(true);
      expect(isKept('a'.repeat(128))).toBe(true);
    });

    it('drops an entry carrying a control character', () => {
      expect(isKept(normalise('$HEX[70617373776f72640a3132333435363738]'))).toBe(false);
      expect(isKept('password\r12345678')).toBe(false);
      expect(isKept('password\t12345678')).toBe(false);
      expect(isKept('password\x7f12345678')).toBe(false);
    });

    it('drops short, long, comment-like, non-ASCII and malformed entries', () => {
      expect(isKept('admin123')).toBe(false);
      expect(isKept('a'.repeat(129))).toBe(false);
      expect(isKept('#hashtag12345')).toBe(false);
      expect(isKept('pässwörd12345')).toBe(false);
      expect(isKept(null)).toBe(false);
    });
  });

  describe('buildBlocklist', () => {
    it('rebuilds the list between the header and the supplement', () => {
      const source = [
        'Password1234',
        '$HEX[70617373776f72640a3132333435363738]',
        '$HEX[70617373776f72643132333]',
        'short',
        'password1234',
        'mysupplement12',
        '',
      ].join('\r\n');
      const result = buildBlocklist(current(['MySupplement12']), [source]);

      expect(result.content).toBe(
        ['# header', '# more header', 'password1234', MARKER, 'mysupplement12', ''].join('\n'),
      );
      expect(result.listCount).toBe(1);
      expect(result.supplementCount).toBe(1);
      expect(result.malformed).toBe(1);
    });

    it('fails on a supplement entry that would not be kept', () => {
      expect(() => buildBlocklist(current(['admin123']), [])).toThrow(/"admin123"/);
      expect(() => buildBlocklist(current(['#hashtag12345']), [])).toThrow(/"#hashtag12345"/);
    });

    it('fails when the current file has no supplement marker', () => {
      expect(() => buildBlocklist('# header\nentry12345678\n', [])).toThrow(/supplement/);
    });

    it('accepts the supplement of the committed blocklist', () => {
      const file = readFileSync(new URL('../src/utils/common-passwords.txt', import.meta.url), 'utf8');
      expect(() => buildBlocklist(file, [])).not.toThrow();
    });
  });
});
