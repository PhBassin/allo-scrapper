# Allo-Scrapper

Agrégateur de séances de cinéma basé sur les données Allociné. Le site affiche les films disponibles chaque semaine dans un ensemble configurable de cinémas, avec les séances quotidiennes détaillées.

## Stack technique

| Composant | Technologie | Justification |
|-----------|------------|---------------|
| **Langage** | TypeScript (Node.js) | Typage fort, écosystème riche, même langage front/back |
| **Scraping** | Cheerio | Parsing HTML léger et rapide, pas besoin de headless browser (les données sont dans le HTML statique) |
| **Base de données** | SQLite via `better-sqlite3` | Fichier unique, pas de serveur DB, idéal pour site statique avec historique |
| **Frontend** | Astro | Générateur de site statique performant, adapté au contenu |
| **Style** | Tailwind CSS | Design responsive, utilitaire, rapide à itérer |
| **Automatisation** | GitHub Actions | Cron jobs gratuits pour le scraping quotidien |
| **Hébergement** | GitHub Pages | Gratuit, déploiement automatique depuis GitHub Actions |
| **HTTP Client** | undici / fetch natif | Client HTTP performant intégré à Node.js |

## Architecture

```
allo-scrapper/
├── README.md
├── package.json
├── tsconfig.json
├── astro.config.mjs
├── tailwind.config.mjs
│
├── config/
│   └── cinemas.json              # Liste des cinémas à scraper
│
├── src/
│   ├── scraper/
│   │   ├── index.ts              # Point d'entrée du scraper
│   │   ├── allocine-client.ts    # Récupération des pages HTML
│   │   ├── theater-parser.ts     # Parsing de la page cinéma (séances)
│   │   ├── film-parser.ts        # Parsing de la fiche film (durée, détails)
│   │   └── types.ts              # Types TypeScript partagés
│   │
│   ├── db/
│   │   ├── schema.ts             # Définition du schéma SQLite
│   │   ├── migrations.ts         # Migrations de la base
│   │   └── queries.ts            # Requêtes d'accès aux données
│   │
│   ├── pages/                    # Pages Astro (site statique)
│   │   ├── index.astro           # Accueil : films de la semaine, tous cinémas
│   │   ├── cinema/
│   │   │   └── [id].astro        # Page par cinéma avec séances du jour
│   │   ├── film/
│   │   │   └── [id].astro        # Page détail d'un film
│   │   └── jour/
│   │       └── [date].astro      # Vue par jour (toutes séances)
│   │
│   ├── components/               # Composants Astro
│   │   ├── FilmCard.astro        # Carte film (affiche, titre, infos)
│   │   ├── ShowtimeList.astro    # Liste des séances
│   │   ├── CinemaSelector.astro  # Sélecteur de cinéma
│   │   ├── DatePicker.astro      # Navigation par date
│   │   ├── Header.astro
│   │   └── Footer.astro
│   │
│   ├── layouts/
│   │   └── Layout.astro          # Layout principal
│   │
│   └── styles/
│       └── global.css            # Styles globaux + Tailwind
│
├── data/
│   └── allo-scrapper.db          # Base SQLite (versionnée dans git)
│
├── .github/
│   └── workflows/
│       ├── scrape.yml            # Cron: scraping quotidien + build
│       └── deploy.yml            # Déploiement GitHub Pages
│
└── scripts/
    └── seed-cinemas.ts           # Script d'initialisation des cinémas
```

## Modèle de données (SQLite)

### Table `cinemas`
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT PK | Identifiant Allociné (ex: `W7504`, `C0072`) |
| `name` | TEXT | Nom du cinéma |
| `address` | TEXT | Adresse complète |
| `postal_code` | TEXT | Code postal |
| `city` | TEXT | Ville |
| `screen_count` | INTEGER | Nombre de salles |
| `image_url` | TEXT | URL du logo/image |

### Table `films`
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INTEGER PK | ID Allociné du film (extrait de `cfilm=XXXXX`) |
| `title` | TEXT | Titre du film |
| `original_title` | TEXT | Titre original (si différent) |
| `poster_url` | TEXT | URL de l'affiche |
| `duration_minutes` | INTEGER | Durée en minutes (scrapée depuis la fiche film) |
| `release_date` | TEXT | Date de sortie |
| `rerelease_date` | TEXT | Date de reprise (si applicable) |
| `genres` | TEXT | Genres (JSON array) |
| `nationality` | TEXT | Nationalité |
| `director` | TEXT | Réalisateur(s) |
| `actors` | TEXT | Acteurs principaux (JSON array) |
| `synopsis` | TEXT | Synopsis |
| `certificate` | TEXT | Classification (tout public, -16 ans, etc.) |
| `press_rating` | REAL | Note presse (sur 5) |
| `audience_rating` | REAL | Note spectateurs (sur 5) |
| `allocine_url` | TEXT | Lien vers la fiche Allociné |

### Table `showtimes`
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT PK | ID de la séance Allociné (`data-showtime-id`) |
| `film_id` | INTEGER FK | Référence vers `films.id` |
| `cinema_id` | TEXT FK | Référence vers `cinemas.id` |
| `date` | TEXT | Date de la séance (YYYY-MM-DD) |
| `time` | TEXT | Heure de la séance (HH:MM) |
| `datetime_iso` | TEXT | Date/heure ISO 8601 complète |
| `version` | TEXT | Version (VF, VO, VOST) |
| `format` | TEXT | Format (Numérique, Dolby, etc.) |
| `experiences` | TEXT | Expériences JSON (données `data-experiences`) |
| `week_start` | TEXT | Date du mercredi de la semaine |

### Table `weekly_programs`
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `cinema_id` | TEXT FK | Référence vers `cinemas.id` |
| `film_id` | INTEGER FK | Référence vers `films.id` |
| `week_start` | TEXT | Date du mercredi de début de semaine |
| `is_new_this_week` | INTEGER | 1 si le film est sorti cette semaine |
| `scraped_at` | TEXT | Date/heure du scraping |

## Configuration des cinémas

Fichier `config/cinemas.json` :

```json
[
  {
    "id": "W7504",
    "name": "Épée de Bois",
    "url": "https://www.allocine.fr/seance/salle_gen_csalle=W7504.html"
  },
  {
    "id": "C0072",
    "name": "Le Grand Action",
    "url": "https://www.allocine.fr/seance/salle_gen_csalle=C0072.html"
  }
]
```

Pour ajouter un cinéma, il suffit d'ajouter une entrée avec son identifiant Allociné (visible dans l'URL de la page séances).

## Données scrapées depuis Allociné

### Page cinéma (`/seance/salle_gen_csalle=XXXXX.html`)
Données extraites du HTML (sélecteurs CSS identifiés) :

| Donnée | Sélecteur CSS / Attribut |
|--------|--------------------------|
| Titre du film | `.meta-title-link` |
| ID du film | `href` de `.meta-title-link` → `cfilm=XXXXX` |
| Affiche | `.thumbnail-img[data-src]` |
| Genre | `.meta-body-info .dark-grey-link` |
| Nationalité | `.meta-body-info .nationality` |
| Réalisateur | `.meta-body-direction` (après "De") |
| Acteurs | `.meta-body-actor` (après "Avec") |
| Synopsis | `.synopsis .content-txt` |
| Note presse | `.rating-item .stareval-note` (1er) |
| Note spectateurs | `.rating-item .stareval-note` (2ème) |
| Classification | `.certificate-text` |
| Sorti cette semaine | `.label-status` contenant "sorti cette semaine" |
| Horaires de séance | `.showtimes-hour-item[data-showtime-time]` |
| ID de séance | `.showtimes-hour-item[data-showtime-id]` |
| Version (VF/VO) | `.showtimes-version .text` |
| Expériences | `.showtimes-hour-item[data-experiences]` |
| Dates disponibles | `data-showtimes-dates` sur la section principale |
| Date sélectionnée | `data-selected-date` |
| Info cinéma | `data-theater` (JSON avec nom, adresse, etc.) |

### Fiche film (`/film/fichefilm_gen_cfilm=XXXXX.html`)
Données complémentaires extraites :

| Donnée | Localisation |
|--------|-------------|
| Durée | Texte format "Xh YYmin" dans l'en-tête du film |
| Bande-annonce | Lien vidéo dans la section BA |

## Logique de scraping

### Fréquence
- **Quotidien** (via GitHub Actions cron) : scraping de chaque cinéma pour la date du jour → mise à jour des séances
- **Hebdomadaire** (mercredi) : scraping complet de la semaine (mercredi à mardi) pour capturer tous les nouveaux films

### Processus de scraping
1. Pour chaque cinéma dans `config/cinemas.json` :
   - Récupérer la page du cinéma pour la date cible (`#shwt_date=YYYY-MM-DD`)
   - Parser les films et leurs séances pour cette date
   - Pour chaque nouveau film non encore en base :
     - Récupérer la fiche film (`/film/fichefilm_gen_cfilm=XXXXX.html`)
     - Extraire la durée et les métadonnées complémentaires
   - Insérer/mettre à jour les données en base SQLite
2. Déclencher le build Astro pour régénérer le site statique
3. Déployer sur GitHub Pages

### Gestion des dates
- Chaque page cinéma contient un attribut `data-showtimes-dates` avec la liste des dates disponibles
- Le mercredi, on scrape toutes les dates de la semaine (mercredi à mardi suivant)
- Les autres jours, on ne scrape que la date du jour (mise à jour des séances)

## Installation

```bash
npm install
```

## Scripts disponibles

```bash
# Scraping quotidien (date du jour)
npm run scrape

# Scraping hebdomadaire complet (mercredi → mardi)
npm run scrape:week

# Build du site statique
npm run build

# Tests de régression (base TDD)
npm run test

# Développement local
npm run dev

# Preview du site statique
npm run preview
```

## Consigne TDD (ajout futur de cinémas)

- Avant d'ajouter un nouveau cinéma dans `config/cinemas.json`, commencer par ajouter/adapter un test de régression qui valide le comportement attendu.
- Conserver les tests de parsing (`src/scraper/*.test.ts`) comme garde-fou du fonctionnement actuel du scraper.

## GitHub Actions

### Workflow `scrape.yml`
```yaml
name: Scrape & Build
on:
  schedule:
    - cron: '0 6 * * *'      # Tous les jours à 6h UTC
    - cron: '0 8 * * 3'      # Mercredi à 8h UTC (scrape complet semaine)
  workflow_dispatch: {}        # Déclenchement manuel

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run scrape        # Scraping quotidien
      - run: npm run scrape:week   # Scraping semaine (uniquement le mercredi)
        if: github.event.schedule == '0 8 * * 3'
      - run: npm run build         # Build Astro
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/

  deploy:
    needs: scrape
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

## Pages du site

### 1. Accueil (`/`)
- Vue d'ensemble de la semaine en cours (mercredi → mardi)
- Liste des films disponibles, groupés par cinéma ou par film
- Filtres : cinéma, genre, version (VF/VO), date
- Badge "Nouveau cette semaine" sur les films sortis le mercredi

### 2. Page cinéma (`/cinema/[id]`)
- Informations du cinéma (nom, adresse, nombre de salles)
- Films programmés cette semaine
- Séances du jour sélectionné
- Navigation par date

### 3. Page film (`/film/[id]`)
- Fiche complète : affiche, synopsis, durée, genre, réalisateur, acteurs
- Notes presse et spectateurs
- Liste des cinémas qui projettent ce film avec leurs séances
- Historique des semaines de programmation

### 4. Vue par jour (`/jour/[date]`)
- Toutes les séances de tous les cinémas pour une date donnée
- Regroupement par film ou par cinéma

## Dépendances principales

```json
{
  "dependencies": {
    "astro": "^5.x",
    "@astrojs/tailwind": "^6.x",
    "tailwindcss": "^4.x",
    "better-sqlite3": "^11.x",
    "cheerio": "^1.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/better-sqlite3": "^7.x",
    "@types/node": "^22.x",
    "tsx": "^4.x"
  }
}
```
