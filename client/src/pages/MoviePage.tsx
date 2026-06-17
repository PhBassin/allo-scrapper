import { useParams } from 'react-router-dom';
import { useMovieQuery } from '../hooks/useMovieQuery.js';
import { LoadingSpinner, ErrorMessage } from '../components/ui/PageStates.js';
import { MovieBreadcrumb } from './MoviePage/MovieBreadcrumb.js';
import { MovieHero } from './MoviePage/MovieHero.js';
import { MovieShowtimesSection } from './MoviePage/MovieShowtimesSection.js';
import { MovieSynopsis } from './MoviePage/MovieSynopsis.js';

export default function MoviePage() {
  const { id } = useParams<{ id: string }>();
  const { movie, isLoading, error } = useMovieQuery(id);

  if (isLoading) return <LoadingSpinner />;
  if (error || !movie) return <ErrorMessage message={error ?? 'Movie not found'} />;

  return (
    <div className="max-w-5xl mx-auto">
      <MovieBreadcrumb title={movie.title} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <MovieHero movie={movie} />
        <div className="lg:col-span-2 space-y-8">
          <MovieShowtimesSection movie={movie} />
          <MovieSynopsis synopsis={movie.synopsis} actors={movie.actors} />
        </div>
      </div>
    </div>
  );
}
