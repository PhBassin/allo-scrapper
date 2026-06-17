export function hasRating(rating: number | null | undefined): boolean {
  return rating != null && rating > 0;
}

export function deriveMovieError(
  isInvalidId: boolean,
  queryError: unknown
): string | null {
  if (isInvalidId) return 'Invalid movie ID';
  if (queryError instanceof Error) return queryError.message;
  if (queryError) return 'Failed to load movie data';
  return null;
}
