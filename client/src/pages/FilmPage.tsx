import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getFilmById } from '../api/client';
import type { Film } from '../types';

export default function FilmPage() {
  const { id } = useParams<{ id: string }>();
  const [film, setFilm] = useState<Film | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;

      const filmId = Number(id);
      if (Number.isNaN(filmId)) {
        setError('Invalid film ID');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        const data = await getFilmById(filmId);
        setFilm(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load film data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !film) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-red-800 mb-2">Erreur</h2>
        <p className="text-red-600">{error || 'Film not found'}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-primary hover:underline">← Accueil</Link>
        <span>/</span>
        <span>{film.title}</span>
      </div>

      {/* Film Header */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold">{film.title}</h1>
        {film.original_title && film.original_title !== film.title && (
          <p className="text-gray-600 mt-2 italic">{film.original_title}</p>
        )}
      </div>

      {/* Film Details Card */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {film.poster_url && (
            <img
              src={film.poster_url}
              alt={`Affiche de ${film.title}`}
              className="w-48 h-72 object-cover rounded shadow-lg"
              loading="lazy"
            />
          )}

          <div className="space-y-3">
            {film.duration_minutes && (
              <p>
                <strong>Durée:</strong> {Math.floor(film.duration_minutes / 60)}h
                {film.duration_minutes % 60 > 0 ? String(film.duration_minutes % 60).padStart(2, '0') : ''}
              </p>
            )}
            
            {film.director && (
              <p><strong>Réalisateur:</strong> {film.director}</p>
            )}
            
            {film.genres && film.genres.length > 0 && (
              <p><strong>Genres:</strong> {film.genres.join(', ')}</p>
            )}
            
            {film.nationality && (
              <p><strong>Nationalité:</strong> {film.nationality}</p>
            )}
            
            {film.certificate && (
              <p><strong>Classification:</strong> {film.certificate}</p>
            )}

            {/* Ratings */}
            {(film.press_rating || film.audience_rating) && (
              <div className="flex gap-4 pt-2">
                {film.press_rating && (
                  <div>
                    <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Presse
                    </span>
                    <span className="ml-2 font-bold text-lg">★ {film.press_rating.toFixed(1)}</span>
                  </div>
                )}
                {film.audience_rating && (
                  <div>
                    <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Spectateurs
                    </span>
                    <span className="ml-2 font-bold text-lg">★ {film.audience_rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            )}
            
            {film.synopsis && (
              <div className="pt-4">
                <strong className="block mb-2">Synopsis:</strong>
                <p className="text-gray-700 leading-relaxed">{film.synopsis}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
