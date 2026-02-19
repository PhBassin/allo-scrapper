/**
 * Generates the cinema showtimes page URL for a specific cinema.
 * 
 * @param cinemaId The cinema ID (e.g., 'W7504')
 * @returns The full URL to the cinema's showtimes page
 */
export function getCinemaUrl(cinemaId: string): string {
  if (!cinemaId) return '';
  return `https://www.example-cinema-site.com/seance/salle_gen_csalle=${cinemaId}.html`;
}
