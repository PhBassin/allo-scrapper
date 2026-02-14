import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTheaterPage } from './theater-parser.js';

test('parseTheaterPage extrait le cinéma, les films et les séances', () => {
  const html = `
    <section
      id="theaterpage-showtimes-index-ui"
      data-theater='{"name":"Cinema Test","location":{"address":"1 rue du Test","postalCode":"75001","city":"Paris"},"screenCount":5,"image":"https://img.example/cinema.jpg"}'
      data-showtimes-dates='["2025-01-15","2025-01-16"]'
      data-selected-date="2025-01-15"
    ></section>

    <div class="movie-card-theater">
      <a class="meta-title-link" href="/film/fichefilm_gen_cfilm=12345.html">Film Test</a>
      <img class="thumbnail-img" src="https://img.example/poster.jpg" />
      <div class="meta-body-info">
        <a class="dark-grey-link">Drame</a>
        <span class="nationality">France</span>
      </div>
      <div class="meta-body-direction">De Jane Doe</div>
      <div class="meta-body-actor">Avec A, B</div>
      <div class="synopsis"><div class="content-txt">Synopsis film</div></div>
      <div class="certificate-text">Tout public</div>
      <div class="rating-item"><span class="stareval-note">4,1</span></div>
      <div class="rating-item"><span class="stareval-note">3,8</span></div>
      <div class="label-status">Sorti cette semaine</div>
      <div class="meta-body-item">
        <span class="light">Date de sortie</span>
        <span class="date">15 janvier 2025</span>
      </div>

      <div class="showtimes-version">
        <span class="text">VO</span>
        <a
          class="showtimes-hour-item"
          data-showtime-id="st1"
          data-showtime-time="2025-01-15T20:30:00"
          data-experiences='["Format.Projection.Digital","Localization.Language.Original"]'
        >
          <span class="showtimes-hour-item-value">20:30</span>
        </a>
      </div>
    </div>
  `;

  const result = parseTheaterPage(html, 'W7504');

  assert.equal(result.cinema.id, 'W7504');
  assert.equal(result.cinema.name, 'Cinema Test');
  assert.deepEqual(result.dates, ['2025-01-15', '2025-01-16']);
  assert.equal(result.selected_date, '2025-01-15');
  assert.equal(result.films.length, 1);
  assert.equal(result.films[0].film.id, 12345);
  assert.equal(result.films[0].film.title, 'Film Test');
  assert.equal(result.films[0].film.release_date, '2025-01-15');
  assert.equal(result.films[0].is_new_this_week, true);
  assert.equal(result.films[0].showtimes.length, 1);
  assert.equal(result.films[0].showtimes[0].id, 'st1');
  assert.equal(result.films[0].showtimes[0].date, '2025-01-15');
  assert.equal(result.films[0].showtimes[0].version, 'VO');
  assert.equal(result.films[0].showtimes[0].format, 'Projection Digital');
});

test('parseTheaterPage ignore les cartes sans id film', () => {
  const html = `
    <section id="theaterpage-showtimes-index-ui" data-selected-date="2025-01-15"></section>
    <div class="movie-card-theater">
      <a class="meta-title-link" href="/film/sans-id.html">Film Sans ID</a>
    </div>
  `;

  const result = parseTheaterPage(html, 'W7504');

  assert.equal(result.films.length, 0);
});

test("parseTheaterPage utilise la date ISO de la séance pour les jours suivants", () => {
  const html = `
    <section id="theaterpage-showtimes-index-ui" data-selected-date="2025-01-15"></section>
    <div class="movie-card-theater">
      <a class="meta-title-link" href="/film/fichefilm_gen_cfilm=12345.html">Film Test</a>
      <div class="showtimes-version">
        <span class="text">VF</span>
        <a
          class="showtimes-hour-item"
          data-showtime-id="st-next-day"
          data-showtime-time="2025-01-16T10:00:00+01:00"
        >
          <span class="showtimes-hour-item-value">10:00</span>
        </a>
      </div>
    </div>
  `;

  const result = parseTheaterPage(html, 'W7504');

  assert.equal(result.films.length, 1);
  assert.equal(result.films[0].showtimes.length, 1);
  assert.equal(result.films[0].showtimes[0].date, '2025-01-16');
});
