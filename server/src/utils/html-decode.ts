/**
 * Decodes HTML entities in a string using a lightweight native implementation.
 *
 * Converts HTML entities like `&#039;`, `&eacute;`, `&amp;` to their
 * corresponding characters: `'`, `é`, `&`.
 *
 * @param text - String potentially containing HTML entities
 * @returns Decoded string, or undefined if input is undefined
 *
 * @example
 * decodeHtmlEntities("L&#039;histoire d&#039;un voyage")
 * // Returns: "L'histoire d'un voyage"
 *
 * decodeHtmlEntities("Caf&eacute; &amp; th&eacute;")
 * // Returns: "Café & thé"
 */
export function decodeHtmlEntities(text: string | undefined): string | undefined {
  if (text === undefined) {
    return undefined;
  }
  return decodeEntities(text);
}

/**
 * Decodes HTML entities in an array of strings.
 *
 * @param texts - Array of strings potentially containing HTML entities
 * @returns Array of decoded strings
 *
 * @example
 * decodeHtmlEntitiesArray(["Th&eacute;&acirc;tre", "Com&eacute;die"])
 * // Returns: ["Théâtre", "Comédie"]
 */
export function decodeHtmlEntitiesArray(texts: string[]): string[] {
  return texts.map(text => decodeEntities(text));
}

// ---------------------------------------------------------------------------
// Internal implementation — no external dependencies
// ---------------------------------------------------------------------------

/** Named HTML entities → Unicode character mapping (subset covering French text and common web entities) */
const NAMED_ENTITIES: Record<string, string> = {
  // Core XML entities
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  // Common web entities
  nbsp: '\u00A0', copy: '\u00A9', reg: '\u00AE', trade: '\u2122',
  mdash: '\u2014', ndash: '\u2013', laquo: '\u00AB', raquo: '\u00BB',
  hellip: '\u2026', euro: '\u20AC', pound: '\u00A3', yen: '\u00A5',
  // Latin Extended-A (accented characters used in French and other European languages)
  Agrave: '\u00C0', Aacute: '\u00C1', Acirc: '\u00C2', Atilde: '\u00C3',
  Auml: '\u00C4', Aring: '\u00C5', AElig: '\u00C6', Ccedil: '\u00C7',
  Egrave: '\u00C8', Eacute: '\u00C9', Ecirc: '\u00CA', Euml: '\u00CB',
  Igrave: '\u00CC', Iacute: '\u00CD', Icirc: '\u00CE', Iuml: '\u00CF',
  ETH: '\u00D0', Ntilde: '\u00D1', Ograve: '\u00D2', Oacute: '\u00D3',
  Ocirc: '\u00D4', Otilde: '\u00D5', Ouml: '\u00D6', Oslash: '\u00D8',
  Ugrave: '\u00D9', Uacute: '\u00DA', Ucirc: '\u00DB', Uuml: '\u00DC',
  Yacute: '\u00DD', THORN: '\u00DE', szlig: '\u00DF',
  agrave: '\u00E0', aacute: '\u00E1', acirc: '\u00E2', atilde: '\u00E3',
  auml: '\u00E4', aring: '\u00E5', aelig: '\u00E6', ccedil: '\u00E7',
  egrave: '\u00E8', eacute: '\u00E9', ecirc: '\u00EA', euml: '\u00EB',
  igrave: '\u00EC', iacute: '\u00ED', icirc: '\u00EE', iuml: '\u00EF',
  eth: '\u00F0', ntilde: '\u00F1', ograve: '\u00F2', oacute: '\u00F3',
  ocirc: '\u00F4', otilde: '\u00F5', ouml: '\u00F6', oslash: '\u00F8',
  ugrave: '\u00F9', uacute: '\u00FA', ucirc: '\u00FB', uuml: '\u00FC',
  yacute: '\u00FD', thorn: '\u00FE', yuml: '\u00FF',
  // Additional French punctuation
  OElig: '\u0152', oelig: '\u0153', Scaron: '\u0160', scaron: '\u0161',
  Yuml: '\u0178',
  // Curly quotes
  lsquo: '\u2018', rsquo: '\u2019', sbquo: '\u201A',
  ldquo: '\u201C', rdquo: '\u201D', bdquo: '\u201E',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#(\d+)|#x([0-9a-fA-F]+)|([A-Za-z]+));/g, (_, _full, decimal, hex, named) => {
    if (decimal) {
      return String.fromCharCode(parseInt(decimal, 10));
    }
    if (hex) {
      return String.fromCharCode(parseInt(hex, 16));
    }
    if (named && named in NAMED_ENTITIES) {
      return NAMED_ENTITIES[named];
    }
    return _;
  });
}
