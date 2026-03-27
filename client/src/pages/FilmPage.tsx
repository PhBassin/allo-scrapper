import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFilmById } from '../api/client';
import CinemaShowtimes from '../components/CinemaShowtimes';

export default function FilmPage() {
  const { id } = useParams<{ id: string }>();
  
  const filmId = id ? Number(id) : NaN;
  const isInvalidId = Number.isNaN(filmId);

  const { data: film, isLoading, error: queryError } = useQuery({
    queryKey: ['film', filmId],
    queryFn: () => getFilmById(filmId),
    enabled: !isInvalidId
  });

  const error = isInvalidId ? 'Invalid film ID' : (queryError instanceof Error ? queryError.message : (queryError ? 'Failed to load film data' : null));

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
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-primary hover:underline">← Accueil</Link>
        <span>/</span>
        <span>{film.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Film Details */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            {film.poster_url && (
              <img
                src={film.poster_url}
                alt={`Affiche de ${film.title}`}
                className="w-full h-auto object-cover rounded-xl shadow-lg mb-6"
                loading="lazy"
              />
            )}

            <div className="card p-6 space-y-4">
              <h1 className="text-2xl font-bold leading-tight">{film.title}</h1>
              
              <div className="space-y-2 text-sm">
                {film.duration_minutes && (
                  <p>
                    <span className="text-gray-500">Durée:</span> {Math.floor(film.duration_minutes / 60)}h
                    {film.duration_minutes % 60 > 0 ? String(film.duration_minutes % 60).padStart(2, '0') : ''}
                  </p>
                )}
                
                {film.director && (
                  <p><span className="text-gray-500">Réalisateur:</span> {film.director}</p>
                )}

                {film.screenwriters && film.screenwriters.length > 0 && (
                  <p>
                    <span className="text-gray-500">Scénario:</span> {film.screenwriters.join(', ')}
                  </p>
                )}
                
                {film.genres && film.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {film.genres.map(g => (
                      <span key={g} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{g}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Ratings */}
              {(film.press_rating != null && film.press_rating > 0) || (film.audience_rating != null && film.audience_rating > 0) ? (
                <div className="flex gap-4 pt-2 border-t border-gray-100">
                  {film.press_rating != null && film.press_rating > 0 && (
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-gray-400 uppercase">Presse</div>
                      <div className="font-bold text-lg">★ {film.press_rating.toFixed(1)}</div>
                    </div>
                  )}
                  {film.audience_rating != null && film.audience_rating > 0 && (
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-gray-400 uppercase">Public</div>
                      <div className="font-bold text-lg">★ {film.audience_rating.toFixed(1)}</div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right Column: Showtimes & Synopsis */}
        <div className="lg:col-span-2 space-y-8">
          {/* Showtimes Section */}
          <section>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span>📅 Horaires et Cinémas</span>
            </h2>
            <CinemaShowtimes cinemas={film.cinemas} />
          </section>

          {/* Synopsis Section */}
          {film.synopsis && (
            <section className="bg-white rounded-xl border border-gray-100 p-6">
              <h2 className="text-xl font-bold mb-3">Synopsis</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{film.synopsis}</p>
              
              {film.actors && film.actors.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-50">
                  <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Avec</h3>
                  <p className="text-sm text-gray-700">{film.actors.join(', ')}</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
