import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCinemas, getCinemaSchedule, triggerCinemaScrape, getScrapeStatus } from '../api/client';
import type { Cinema, ShowtimeWithFilm } from '../types';
import ShowtimeList from '../components/ShowtimeList';
import ScrapeButton from '../components/ScrapeButton';
import ScrapeProgress from '../components/ScrapeProgress';
import CinemaDateSelector from '../components/CinemaDateSelector';

interface FilmGroup {
  film: {
    id: number;
    title: string;
    poster_url?: string;
    duration_minutes?: number;
    genres?: string[];
    director?: string;
    press_rating?: number;
    audience_rating?: number;
  };
  showtimes: ShowtimeWithFilm[];
}

export default function CinemaPage() {
  const { id } = useParams<{ id: string }>();
  const [cinema, setCinema] = useState<Cinema | null>(null);
  const [showtimes, setShowtimes] = useState<ShowtimeWithFilm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showProgress, setShowProgress] = useState(false);

  const loadData = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch cinema details and schedule in parallel
      const [cinemas, schedule, scrapeStatus] = await Promise.all([
        getCinemas(),
        getCinemaSchedule(id),
        getScrapeStatus()
      ]);
      
      const foundCinema = cinemas.find(c => c.id === id);
      if (!foundCinema) {
        throw new Error('Cinema not found');
      }
      
      setCinema(foundCinema);
      setShowtimes(schedule.showtimes);

      // Check if scrape is running
      if (scrapeStatus.isRunning) {
        setShowProgress(true);
      }

      // Set default selected date (today or first available)
      if (schedule.showtimes.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const dates = getUniqueDates(schedule.showtimes);
        setSelectedDate(dates.includes(today) ? today : dates[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load cinema data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const getUniqueDates = (showtimes: ShowtimeWithFilm[]): string[] => {
    const dates = new Set(showtimes.map(s => s.date));
    return Array.from(dates).sort();
  };

  const groupByFilm = (showtimes: ShowtimeWithFilm[]): FilmGroup[] => {
    const filmMap = new Map<number, FilmGroup>();

    showtimes.forEach((showtime) => {
      if (!filmMap.has(showtime.film.id)) {
        filmMap.set(showtime.film.id, {
          film: showtime.film,
          showtimes: [],
        });
      }
      filmMap.get(showtime.film.id)!.showtimes.push(showtime);
    });

    return Array.from(filmMap.values());
  };

  const formatDateLabel = useCallback((dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return {
      weekday: date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
      day: date.getDate(),
      month: date.toLocaleDateString('fr-FR', { month: 'short' }),
    };
  }, []);

  const handleScrapeStart = () => {
    setShowProgress(true);
  };

  const handleScrapeComplete = () => {
    // Hide progress and reload data after a delay to avoid flickering
    setTimeout(() => {
      setShowProgress(false);
      loadData();
    }, 2000);
  };

  // ⚡ PERFORMANCE: Memoize derived state calculations to prevent expensive
  // array operations (getUniqueDates, filter, groupByFilm) on every render,
  // especially when showtimes array is large or during unrelated state updates (like scrape progress).
  const dates = useMemo(() => getUniqueDates(showtimes), [showtimes]);
  const selectedShowtimes = useMemo(() => showtimes.filter(s => s.date === selectedDate), [showtimes, selectedDate]);
  const filmGroups = useMemo(() => groupByFilm(selectedShowtimes), [selectedShowtimes]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !cinema) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-red-800 mb-2">Erreur</h2>
        <p className="text-red-600">{error || 'Cinema not found'}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Scrape Button (Sticky) */}
      {cinema && (
        <div className="sticky top-20 z-10 mb-6 flex justify-end">
          <ScrapeButton
            onTrigger={async () => { await triggerCinemaScrape(id!); }}
            onScrapeStart={handleScrapeStart}
            buttonText="🔄 Scraper uniquement ce cinéma"
            loadingText="Scraping en cours..."
            successText="Scraping démarré !"
            className="bg-white/95 shadow-md rounded-lg p-2"
          />
        </div>
      )}

      {/* Scrape Progress */}
      {showProgress && (
        <div className="mb-8">
          <ScrapeProgress onComplete={handleScrapeComplete} />
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-primary hover:underline">← Accueil</Link>
        <span>/</span>
        <span>{cinema.name}</span>
      </div>

      {/* Cinema Header */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{cinema.name}</h1>
        
        {cinema.address && (
          <p className="text-gray-600 mb-1">
            📍 {cinema.address}, {cinema.postal_code} {cinema.city}
          </p>
        )}
        
        {cinema.screen_count != null && cinema.screen_count > 0 && (
          <p className="text-gray-600">
            🎬 {cinema.screen_count} salle{cinema.screen_count > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Date Selector */}
      <CinemaDateSelector
        dates={dates}
        selectedDate={selectedDate}
        showtimes={showtimes}
        onSelectDate={setSelectedDate}
        formatDateLabel={formatDateLabel}
      />

      {/* Films List for Selected Date */}
      <div className="min-h-[300px]">
        {filmGroups.length > 0 ? (
          <div className="space-y-6">
            {filmGroups.map(({ film, showtimes }) => (
              <div key={film.id} className="card p-5 md:p-6 transition hover:shadow-md border border-gray-100">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Poster (hidden on mobile) */}
                  {film.poster_url && (
                    <div className="hidden md:block w-24 flex-shrink-0">
                      <img 
                        src={film.poster_url} 
                        alt={film.title} 
                        className="w-full rounded shadow-sm"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div className="flex-grow">
                    <div className="mb-4">
                      <h2 className="text-xl md:text-2xl font-bold mb-1">
                        <Link to={`/film/${film.id}`} className="hover:text-primary transition">
                          {film.title}
                        </Link>
                      </h2>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 mb-3">
                        {film.duration_minutes && (
                          <span>
                            ⏱ {Math.floor(film.duration_minutes / 60)}h{film.duration_minutes % 60 > 0 ? String(film.duration_minutes % 60).padStart(2, '0') : ''}
                          </span>
                        )}
                        {film.genres && film.genres.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                            {film.genres[0]}
                          </span>
                        )}
                        {film.director && (
                          <span className="hidden sm:inline">de {film.director}</span>
                        )}
                      </div>

                      {/* Ratings */}
                      {(film.press_rating != null && film.press_rating > 0) || (film.audience_rating != null && film.audience_rating > 0) ? (
                        <div className="flex gap-3 mb-4">
                          {film.press_rating != null && film.press_rating > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Presse</span>
                              <span className="font-bold text-sm">★ {film.press_rating.toFixed(1)}</span>
                            </div>
                          )}
                          {film.audience_rating != null && film.audience_rating > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Spectateurs</span>
                              <span className="font-bold text-sm">★ {film.audience_rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <ShowtimeList showtimes={showtimes} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <p className="text-gray-500 font-medium">Aucune séance programmée ce jour-là</p>
            <p className="text-sm text-gray-400 mt-1">Essayez un autre jour de la semaine</p>
          </div>
        )}
      </div>
    </div>
  );
}
