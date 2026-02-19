import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseFilmPage } from './film-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('parseFilmPage', () => {
  let validHtml: string;

  beforeAll(() => {
    // Correct relative path to the fixture from this test file
    const fixturePath = join(__dirname, '../../../tests/fixtures/film-page.html');
    validHtml = readFileSync(fixturePath, 'utf-8');
  });

  it('should parse duration from valid HTML (hours and minutes)', () => {
    const result = parseFilmPage(validHtml);
    expect(result.duration_minutes).toBe(135); // 2h 15min = 120 + 15
  });

  it('should parse trailer URL from valid HTML', () => {
    const result = parseFilmPage(validHtml);
    // The parser prepends the base URL
    expect(result.trailer_url).toBe('https://www.example-cinema-site.com/video/player_gen_cmedia=19598288&cfilm=296180.html');
  });

  it('should parse duration with only hours', () => {
    const html = '<div class="meta-body-info">Duration: 2h</div>';
    const result = parseFilmPage(html);
    expect(result.duration_minutes).toBe(120);
  });

  it('should handle missing duration', () => {
    const html = '<div class="meta-body-info">No duration info</div>';
    const result = parseFilmPage(html);
    expect(result.duration_minutes).toBeUndefined();
  });

  it('should handle missing trailer', () => {
    const html = '<div>No trailer here</div>';
    const result = parseFilmPage(html);
    expect(result.trailer_url).toBeUndefined();
  });

  it('should handle empty HTML', () => {
    const result = parseFilmPage('');
    expect(result.duration_minutes).toBeUndefined();
    expect(result.trailer_url).toBeUndefined();
  });
});
