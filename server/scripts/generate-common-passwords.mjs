#!/usr/bin/env node
/**
 * Regenerate src/utils/common-passwords.txt (the Password policy blocklist,
 * see CONTEXT.md) from the two SecLists source files:
 *
 *   node scripts/generate-common-passwords.mjs <10k-most-common.txt> <100k-most-used-passwords-NCSC.txt>
 *
 * The header comment and the hand-written supplement are kept from the
 * current file; only the list between them is rebuilt. Each source line is
 * decoded from hashcat `$HEX[...]` notation (any case) when needed, trimmed and
 * lowercased, then kept only if it is printable ASCII (no control
 * character: a decoded newline would split the entry over two lines), does not
 * start with '#' (the loader would read it as a comment) and is 12 to 128
 * characters long. A `$HEX[...]` entry with an odd number of hex digits is
 * malformed and dropped. Entries are deduplicated and sorted by UTF-16 code
 * unit. A supplement entry that would not be kept makes the script fail.
 *
 * The helpers are exported for scripts/generate-common-passwords.test.mjs;
 * the file only writes when run directly.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;
const SUPPLEMENT_MARKER = '# --- supplement ---';
const OUTPUT = new URL('../src/utils/common-passwords.txt', import.meta.url);

/**
 * Decode hashcat `$HEX[...]` notation. Returns the line unchanged when it is
 * not in that notation, or null when the hex has an odd number of digits.
 */
export function decodeHashcatHex(line) {
  const match = /^\$hex\[([0-9a-f]*)\]$/i.exec(line);
  if (!match) return line;
  if (match[1].length % 2 !== 0) return null;
  return Buffer.from(match[1], 'hex').toString('utf8');
}

/** Decode, trim and lowercase a source line; null when it is malformed. */
export function normalise(line) {
  const decoded = decodeHashcatHex(line.replace(/\r$/, ''));
  return decoded === null ? null : decoded.trim().toLowerCase();
}

/** True when a normalised entry belongs in the blocklist file. */
export function isKept(entry) {
  if (typeof entry !== 'string') return false;
  const length = [...entry].length;
  return (
    /^[\x20-\x7e]+$/.test(entry) &&
    !entry.startsWith('#') &&
    length >= MIN_LENGTH &&
    length <= MAX_LENGTH
  );
}

/**
 * Rebuild the file content from the current file (header and supplement are
 * kept) and the source files' contents. Throws when the current file has no
 * supplement marker or when a supplement entry would not be kept.
 */
export function buildBlocklist(currentContent, sourceContents) {
  const current = currentContent.split('\n');
  const header = [];
  for (const line of current) {
    if (!line.startsWith('#') || line === SUPPLEMENT_MARKER) break;
    header.push(line);
  }
  const markerIndex = current.indexOf(SUPPLEMENT_MARKER);
  if (markerIndex === -1) {
    throw new Error(`No "${SUPPLEMENT_MARKER}" line in the current file`);
  }
  const supplementLines = current.slice(markerIndex + 1).filter((line) => line.trim() !== '');
  const rejected = supplementLines.filter((line) => !isKept(normalise(line)));
  if (rejected.length > 0) {
    throw new Error(
      `Supplement entries must be printable ASCII, 12 to 128 characters and not start with '#': ${rejected
        .map((line) => JSON.stringify(line))
        .join(', ')}`,
    );
  }
  const supplement = supplementLines.map(normalise);

  const entries = new Set();
  let malformed = 0;
  for (const content of sourceContents) {
    for (const line of content.split('\n')) {
      const entry = normalise(line);
      if (entry === null) malformed += 1;
      else if (isKept(entry)) entries.add(entry);
    }
  }
  for (const entry of supplement) entries.delete(entry);

  const list = [...entries].sort();
  return {
    content: [...header, ...list, SUPPLEMENT_MARKER, ...supplement, ''].join('\n'),
    listCount: list.length,
    supplementCount: supplement.length,
    malformed,
  };
}

function main(sources) {
  if (sources.length === 0) {
    console.error('Usage: node scripts/generate-common-passwords.mjs <source.txt>...');
    process.exit(1);
  }
  let result;
  try {
    result = buildBlocklist(
      readFileSync(OUTPUT, 'utf8'),
      sources.map((source) => readFileSync(source, 'utf8')),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  if (result.malformed > 0) {
    console.warn(`Dropped ${result.malformed} malformed $HEX[...] entries (odd number of hex digits)`);
  }
  writeFileSync(OUTPUT, result.content);
  console.log(`Wrote ${result.listCount} entries plus ${result.supplementCount} supplement entries`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
