import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWeeklyFilms, getCinemas } from '../api/client';
import type { FilmWithCinemas, Cinema } from '../types';
import FilmCard from '../components/FilmCard';
import ScrapeButton from '../components/ScrapeButton';
import ScrapeProgress from '../components/ScrapeProgress';

export default function HomePage() {
  const [films, setFilms] = useState<FilmWithCinemas[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [weekStart, setWeekStart] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [filmsData, cinemasData] = await Promise.all([
        getWeeklyFilms(),
        getCinemas()
      ]);
      
      setFilms(filmsData.films);
      setWeekStart(filmsData.weekStart);
      setCinemas(cinemasData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getWeekEndDate = (startStr: string) => {
    const start = new Date(startStr);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return formatDate(end.toISOString());
  };

  const handleScrapeStart = () => {
    setShowProgress(true);
    // Optionally reload data after some time
    setTimeout(() => {
      loadData();
      setShowProgress(false);
    }, 5000);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-red-800 mb-2">Erreur</h2>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Films de la semaine</h1>
            {weekStart && (
              <p className="text-gray-600">
                Du {formatDate(weekStart)} au {getWeekEndDate(weekStart)}
              </p>
            )}
          </div>
          <ScrapeButton onScrapeStart={handleScrapeStart} />
        </div>

        {/* Scrape Progress */}
        {showProgress && (
          <div className="mb-6">
            <ScrapeProgress />
          </div>
        )}

        {/* Cinema Links */}
        <div className="mt-4 flex flex-wrap gap-3">
          {cinemas.map((cinema) => (
            <Link
              key={cinema.id}
              to={`/cinema/${cinema.id}`}
              className="px-4 py-2 bg-white border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-yellow-50 transition font-medium"
            >
              {cinema.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Films List */}
      {films.length > 0 ? (
        <div className="space-y-6">
          {films.map((film) => (
            <div key={film.id}>
              <FilmCard film={film} />
              <div className="mt-2 ml-4 text-sm text-gray-600">
                <span className="font-semibold">Programmé dans: </span>
                {film.cinemas.map((cinema, idx) => (
                  <span key={cinema.id}>
                    {idx > 0 && ', '}
                    <Link 
                      to={`/cinema/${cinema.id}`} 
                      className="text-primary hover:underline"
                    >
                      {cinema.name}
                    </Link>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-gray-600 text-lg mb-4">
            Aucun film programmé pour le moment.
          </p>
          <p className="text-gray-500 text-sm mb-4">
            Utilisez le bouton ci-dessus pour lancer le scraping manuel et collecter les données des cinémas.
          </p>
        </div>
      )}
    </div>
  );
}
