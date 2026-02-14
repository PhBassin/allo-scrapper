import * as cheerio from 'cheerio';
import type { TheaterPageData, Cinema, FilmShowtimeData, Film, Showtime } from './types.js';

// Parser la page cinéma d'Allociné
export function parseTheaterPage(html: string, cinemaId: string): TheaterPageData {
  const $ = cheerio.load(html);

  // Extraire les données du cinéma depuis l'attribut data-theater
  const theaterSection = $('#theaterpage-showtimes-index-ui');
  const theaterDataStr = theaterSection.attr('data-theater');
  
  let cinema: Cinema = {
    id: cinemaId,
    name: '',
    address: '',
    postal_code: '',
    city: '',
    screen_count: 0,
  };

  if (theaterDataStr) {
    try {
      const theaterData = JSON.parse(theaterDataStr);
      cinema = {
        id: cinemaId,
        name: theaterData.name || '',
        address: theaterData.location?.address || '',
        postal_code: theaterData.location?.postalCode || '',
        city: theaterData.location?.city || '',
        screen_count: theaterData.screenCount || 0,
        image_url: theaterData.image,
      };
    } catch (e) {
      console.warn('⚠️  Could not parse theater data JSON');
    }
  }

  // Extraire les dates disponibles
  const datesDataStr = theaterSection.attr('data-showtimes-dates');
  let dates: string[] = [];
  if (datesDataStr) {
    try {
      dates = JSON.parse(datesDataStr);
    } catch (e) {
      console.warn('⚠️  Could not parse showtimes dates');
    }
  }

  // Date sélectionnée
  const selectedDate = theaterSection.attr('data-selected-date') || '';

  // Parser chaque film
  const films: FilmShowtimeData[] = [];
  $('.movie-card-theater').each((_, element) => {
    try {
      const filmData = parseFilmCard($, element, cinemaId, selectedDate);
      if (filmData) {
        films.push(filmData);
      }
    } catch (error) {
      console.error('Error parsing film card:', error);
    }
  });

  return {
    cinema,
    films,
    dates,
    selected_date: selectedDate,
  };
}

// Parser une carte de film individuelle
function parseFilmCard(
  $: cheerio.CheerioAPI,
  element: cheerio.Element,
  cinemaId: string,
  date: string
): FilmShowtimeData | null {
  const $card = $(element);

  // Extraire l'ID du film depuis le lien
  const titleLink = $card.find('.meta-title-link');
  const href = titleLink.attr('href') || '';
  const filmIdMatch = href.match(/cfilm=(\d+)/);
  if (!filmIdMatch) {
    console.warn('⚠️  Could not extract film ID from:', href);
    return null;
  }
  const filmId = parseInt(filmIdMatch[1], 10);

  // Titre
  const title = titleLink.text().trim();

  // Affiche
  const posterImg = $card.find('.thumbnail-img');
  const posterUrl = posterImg.attr('data-src') || posterImg.attr('src') || '';

  // Genres
  const genres: string[] = [];
  $card.find('.meta-body-info .dark-grey-link').each((_, el) => {
    const genre = $(el).text().trim();
    if (genre) genres.push(genre);
  });

  // Nationalité
  const nationality = $card.find('.meta-body-info .nationality').text().trim();

  // Réalisateur
  let director = '';
  const directionDiv = $card.find('.meta-body-direction');
  if (directionDiv.length) {
    // Enlever le "De " au début
    director = directionDiv.text().trim().replace(/^De\s+/, '');
  }

  // Acteurs
  const actors: string[] = [];
  const actorDiv = $card.find('.meta-body-actor');
  if (actorDiv.length) {
    // Enlever le "Avec " au début et séparer par virgules
    const actorText = actorDiv.text().trim().replace(/^Avec\s+/, '');
    actorText.split(',').forEach((actor) => {
      const trimmed = actor.trim();
      if (trimmed) actors.push(trimmed);
    });
  }

  // Synopsis
  const synopsis = $card.find('.synopsis .content-txt').text().trim();

  // Classification
  const certificate = $card.find('.certificate-text').text().trim();

  // Notes
  let pressRating: number | undefined;
  let audienceRating: number | undefined;
  
  const ratingItems = $card.find('.rating-item');
  if (ratingItems.length >= 1) {
    const pressNote = $(ratingItems[0]).find('.stareval-note').text().trim();
    if (pressNote) {
      pressRating = parseFloat(pressNote.replace(',', '.'));
    }
  }
  if (ratingItems.length >= 2) {
    const audienceNote = $(ratingItems[1]).find('.stareval-note').text().trim();
    if (audienceNote) {
      audienceRating = parseFloat(audienceNote.replace(',', '.'));
    }
  }

  // Label "sorti cette semaine"
  const isNewThisWeek = $card.find('.label-status').text().toLowerCase().includes('sorti cette semaine');

  // Date de sortie / reprise
  let releaseDate: string | undefined;
  let rereleaseDate: string | undefined;
  
  $card.find('.meta-body-item').each((_, item) => {
    const $item = $(item);
    const label = $item.find('.light').text().trim();
    
    if (label === 'Date de sortie') {
      const dateText = $item.find('.date').text().trim();
      releaseDate = parseDateText(dateText);
    } else if (label === 'Date de reprise') {
      const dateText = $item.text().replace(label, '').trim();
      rereleaseDate = parseDateText(dateText);
    }
  });

  const film: Film = {
    id: filmId,
    title,
    poster_url: posterUrl || undefined,
    genres,
    nationality: nationality || undefined,
    director: director || undefined,
    actors,
    synopsis: synopsis || undefined,
    certificate: certificate || undefined,
    press_rating: pressRating,
    audience_rating: audienceRating,
    release_date: releaseDate,
    rerelease_date: rereleaseDate,
    allocine_url: `https://www.allocine.fr${href}`,
  };

  // Parser les séances
  const showtimes = parseShowtimes($, $card, filmId, cinemaId, date);

  return {
    film,
    showtimes,
    is_new_this_week: isNewThisWeek,
  };
}

// Parser les séances d'un film
function parseShowtimes(
  $: cheerio.CheerioAPI,
  $card: cheerio.Cheerio<cheerio.Element>,
  filmId: number,
  cinemaId: string,
  defaultDate: string
): Showtime[] {
  const showtimes: Showtime[] = [];

  // Déterminer le mercredi de la semaine pour week_start
  const weekStart = getWeekStart(defaultDate);

  $card.find('.showtimes-version').each((_, versionBlock) => {
    const $version = $(versionBlock);
    
    // Version (VF/VO)
    const versionText = $version.find('.text').text().trim();
    let version = 'VF';
    if (versionText.toLowerCase().includes('vo')) {
      version = 'VO';
    } else if (versionText.toLowerCase().includes('vost')) {
      version = 'VOST';
    }

    // Extraire la date depuis le texte si disponible
    const dateMatch = versionText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    let showtimeDate = defaultDate;
    if (dateMatch) {
      showtimeDate = parseDateFromText(dateMatch[1], dateMatch[2], dateMatch[3]);
    }

    // Parser chaque horaire
    $version.find('.showtimes-hour-item').each((_, hourItem) => {
      const $hour = $(hourItem);
      
      const showtimeId = $hour.attr('data-showtime-id');
      const datetimeIso = $hour.attr('data-showtime-time');
      const experiencesStr = $hour.attr('data-experiences');
      
      if (!showtimeId || !datetimeIso) return;

      // Extraire l'heure
      const time = $hour.find('.showtimes-hour-item-value').text().trim();

      // Parser les expériences
      let experiences: string[] = [];
      if (experiencesStr) {
        try {
          experiences = JSON.parse(experiencesStr);
        } catch (e) {
          // Ignorer les erreurs de parsing
        }
      }

      // Extraire le format depuis les expériences
      let format: string | undefined;
      for (const exp of experiences) {
        if (exp.includes('Format.')) {
          format = exp.replace('Format.', '').replace('.', ' ');
          break;
        }
      }

      showtimes.push({
        id: showtimeId,
        film_id: filmId,
        cinema_id: cinemaId,
        date: showtimeDate,
        time,
        datetime_iso: datetimeIso,
        version,
        format,
        experiences,
        week_start: weekStart,
      });
    });
  });

  return showtimes;
}

// Utilitaire: parser une date textuelle ("31 décembre 2025")
function parseDateText(dateText: string): string | undefined {
  const match = dateText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (!match) return undefined;
  
  return parseDateFromText(match[1], match[2], match[3]);
}

// Utilitaire: convertir jour/mois/année en YYYY-MM-DD
function parseDateFromText(day: string, monthName: string, year: string): string {
  const months: { [key: string]: string } = {
    janvier: '01',
    février: '02',
    mars: '03',
    avril: '04',
    mai: '05',
    juin: '06',
    juillet: '07',
    août: '08',
    septembre: '09',
    octobre: '10',
    novembre: '11',
    décembre: '12',
  };

  const month = months[monthName.toLowerCase()] || '01';
  const dayPadded = day.padStart(2, '0');

  return `${year}-${month}-${dayPadded}`;
}

// Utilitaire: obtenir le mercredi de la semaine d'une date
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay(); // 0 = dimanche, 3 = mercredi
  
  // Calculer le décalage vers le mercredi précédent
  let offset = dayOfWeek - 3; // mercredi = 3
  if (offset < 0) {
    offset += 7; // Si on est lundi/mardi, aller au mercredi précédent
  }
  
  const wednesday = new Date(date);
  wednesday.setDate(date.getDate() - offset);
  
  return wednesday.toISOString().split('T')[0];
}
