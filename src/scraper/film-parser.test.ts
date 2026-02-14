import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFilmPage } from './film-parser.js';

test('parseFilmPage extrait la durée et la bande-annonce', () => {
  const html = `
    <div class="meta-body-info">Drame, 1h 40min</div>
    <a class="thumbnail-link" href="/video/player_gen_cmedia=19555555&cfilm=12345.html"></a>
  `;

  const result = parseFilmPage(html);

  assert.equal(result.duration_minutes, 100);
  assert.equal(
    result.trailer_url,
    'https://www.allocine.fr/video/player_gen_cmedia=19555555&cfilm=12345.html',
  );
});

test('parseFilmPage gère une durée sans minutes', () => {
  const html = `<div class="meta-body-info">Aventure, 2h</div>`;

  const result = parseFilmPage(html);

  assert.equal(result.duration_minutes, 120);
  assert.equal(result.trailer_url, undefined);
});
