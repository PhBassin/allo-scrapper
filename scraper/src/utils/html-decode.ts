import he from 'he';

/**
 * Decodes HTML entities in a string using the 'he' library.
 * 
 * NOTE: This file is intentionally duplicated between server and scraper packages.
 * - Server: Uses native DOM-based decoding (no dependencies, better performance)
 * - Scraper: Uses 'he' npm package (robust HTML5 entity support)
 * 
 * This separation allows each package to optimize for its runtime environment.
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
  return he.decode(text);
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
  return texts.map(text => he.decode(text));
}
