# Plan d'externalisation du Backend et de la Base de Données

Actuellement, l'application fonctionne avec une base de données SQLite locale (`data/allo-scrapper.db`) qui est versionnée dans Git. Le scraper s'exécute lors du build ou via une GitHub Action qui commite la base de données mise à jour.

Pour externaliser cette architecture, nous allons migrer vers une base de données hébergée et séparer la logique de mise à jour.

## 1. Migration de la Base de Données (SQLite -> Turso)

**Pourquoi Turso (libSQL) ?**
- Compatible avec SQLite (migration facile depuis `better-sqlite3`).
- Offre une offre gratuite généreuse pour ce type de projet.
- Permet des répliques en bordure (Edge) pour des lectures rapides.
- Élimine le besoin de commiter le fichier `.db` dans Git (réduit la taille du repo et évite les conflits).

**Étapes :**
1.  Créer un compte et une base de données sur [Turso](https://turso.tech).
2.  Installer le client `@libsql/client`.
3.  Remplacer `better-sqlite3` par `@libsql/client` dans `src/db/schema.ts` et `src/db/queries.ts`.
4.  Configurer les variables d'environnement (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`).
5.  Créer un script de migration pour transférer les données existantes de SQLite local vers Turso.

## 2. Externalisation du Backend (Scraper)

Le "backend" est ici le script de scraping (`src/scraper/index.ts`).

**Objectif :**
Le scraper ne doit plus dépendre du cycle de build du site frontend. Il doit être une entité autonome qui met à jour la base de données distante.

**Étapes :**
1.  **Désolidariser du Build :** Retirer `npm run scrape` de la commande `build`. Le build du site ne fera que *lire* la base de données distante.
2.  **Automatisation Indépendante :** 
    - Conserver la GitHub Action `scrape.yml` mais supprimer l'étape de commit (`git commit ...`).
    - Le script mettra directement à jour la base Turso via l'API.
3.  **(Optionnel) API :** Si besoin d'accès temps réel, exposer une API simple (ex: Cloudflare Worker ou Vercel Function) pour interroger la DB, mais pour un site statique, l'accès direct à la DB au build suffit.

## 3. Mise à jour du Frontend (Astro)

Le frontend doit être capable de se connecter à la base distante lors de la génération statique (SSG).

**Étapes :**
1.  Mettre à jour la configuration Astro pour injecter les variables d'environnement Turso lors du build (local et CI/CD).
2.  Adapter les composants Astro pour utiliser le nouveau client DB asynchrone (libSQL est souvent async, contrairement à `better-sqlite3` qui est synchrone).

## Résumé des Tâches Techniques

- [ ] `npm install @libsql/client dotenv`
- [ ] Refactoriser `src/db/schema.ts` pour supporter libSQL.
- [ ] Refactoriser `src/db/queries.ts` (passer en `async/await`).
- [ ] Créer script `scripts/migrate-to-turso.ts`.
- [ ] Mettre à jour `src/scraper/index.ts` pour utiliser la nouvelle connexion DB.
- [ ] Mettre à jour les pages Astro (`src/pages/**/*.astro`) pour utiliser `await` lors des appels DB.
- [ ] Mettre à jour les GitHub Actions (Secrets: `TURSO_URL`, `TURSO_TOKEN`).
