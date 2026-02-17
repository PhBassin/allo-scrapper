/**
 * Generates the Allociné URL for a specific cinema's showtimes page.
 * 
 * @param cinemaId The Allociné cinema ID (e.g., 'W7504')
 * @returns The full URL to the cinema's showtimes on Allociné
 */
export function getAllocineCinemaUrl(cinemaId: string): string {
  if (!cinemaId) return '';
  return `https://www.allocine.fr/seance/salle_gen_csalle=${cinemaId}.html`;
}
