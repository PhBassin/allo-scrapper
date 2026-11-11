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
 * lowercased, then kept only if it is ASCII, does not start with '#' (the
 * loader would read it as a comment) and is 12 to 128 characters long.
 * Entries are deduplicated and sorted by UTF-16 code unit.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;
const SUPPLEMENT_MARKER = '# --- supplement ---';
const OUTPUT = new URL('../src/utils/common-passwords.txt', import.meta.url);

const sources = process.argv.slice(2);
if (sources.length === 0) {
  console.error('Usage: node scripts/generate-common-passwords.mjs <source.txt>...');
  process.exit(1);
}

function decodeHashcatHex(line) {
  const match = /^\$hex\[([0-9a-f]*)\]$/i.exec(line);
  return match ? Buffer.from(match[1], 'hex').toString('utf8') : line;
}

function normalise(line) {
  return decodeHashcatHex(line.replace(/\r$/, '')).trim().toLowerCase();
}

function isKept(entry) {
  const length = [...entry].length;
  return (
    /^[\x00-\x7f]+$/.test(entry) &&
    !entry.startsWith('#') &&
    length >= MIN_LENGTH &&
    length <= MAX_LENGTH
  );
}

const current = readFileSync(OUTPUT, 'utf8').split('\n');
const header = [];
for (const line of current) {
  if (!line.startsWith('#')) break;
  header.push(line);
}
const markerIndex = current.indexOf(SUPPLEMENT_MARKER);
if (markerIndex === -1) {
  console.error(`No "${SUPPLEMENT_MARKER}" line in the current file`);
  process.exit(1);
}
const supplement = current.slice(markerIndex + 1).map(normalise).filter((line) => line !== '');

const entries = new Set();
for (const source of sources) {
  for (const line of readFileSync(source, 'utf8').split('\n')) {
    const entry = normalise(line);
    if (isKept(entry)) entries.add(entry);
  }
}
for (const entry of supplement) entries.delete(entry);

const list = [...entries].sort();
writeFileSync(OUTPUT, [...header, ...list, SUPPLEMENT_MARKER, ...supplement, ''].join('\n'));
console.log(`Wrote ${list.length} entries plus ${supplement.length} supplement entries`);
