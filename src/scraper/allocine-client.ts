// Client HTTP pour récupérer les pages Allociné

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function fetchTheaterPage(
  cinemaId: string,
  date?: string
): Promise<string> {
  let url = `https://www.allocine.fr/seance/salle_gen_csalle=${cinemaId}.html`;
  
  if (date) {
    url += `?date=${date}#shwt_date=${date}`;
  }

  console.log(`🔍 Fetching theater page: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch theater page ${cinemaId}: ${response.status} ${response.statusText}`
    );
  }

  return response.text();
}

export async function fetchFilmPage(filmId: number): Promise<string> {
  const url = `https://www.allocine.fr/film/fichefilm_gen_cfilm=${filmId}.html`;

  console.log(`🎬 Fetching film page: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch film page ${filmId}: ${response.status} ${response.statusText}`
    );
  }

  return response.text();
}

// Ajouter un délai entre les requêtes pour éviter le rate limiting
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
