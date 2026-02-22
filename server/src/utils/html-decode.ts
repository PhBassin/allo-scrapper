import { decode } from 'he';

/**
 * Decodes HTML entities in a string.
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
  return decode(text);
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
  return texts.map(text => decode(text));
}
