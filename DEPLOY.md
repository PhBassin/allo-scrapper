# Guide de déploiement GitHub Pages

## Configuration initiale

### 1. Créer un repo GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/VOTRE_USERNAME/allo-scrapper.git
git push -u origin main
```

### 2. Activer GitHub Pages

1. Allez dans **Settings** → **Pages** de votre repo
2. Dans **Source**, sélectionnez **GitHub Actions**
3. Sauvegardez

### 3. Configurer le site dans astro.config.mjs

Modifiez `astro.config.mjs` pour correspondre à votre configuration :

```javascript
export default defineConfig({
  integrations: [tailwind()],
  output: 'static',
  site: 'https://VOTRE_USERNAME.github.io',
  base: '/allo-scrapper', // Nom de votre repo
});
```

### 4. Activer les permissions du workflow

1. Allez dans **Settings** → **Actions** → **General**
2. Dans **Workflow permissions**, sélectionnez **Read and write permissions**
3. Cochez **Allow GitHub Actions to create and approve pull requests**
4. Sauvegardez

## Utilisation

### Scraping manuel

Pour déclencher un scraping manuellement depuis GitHub :

1. Allez dans l'onglet **Actions**
2. Sélectionnez le workflow **Scrape & Deploy**
3. Cliquez sur **Run workflow** → **Run workflow**

### Scraping automatique

Le workflow s'exécute automatiquement :
- **Mercredi à 8h UTC** : scraping complet de la semaine (mer→mar)

### Ajouter des cinémas

Modifiez `config/cinemas.json` :

```json
[
  {
    "id": "W7504",
    "name": "Épée de Bois",
    "url": "https://www.allocine.fr/seance/salle_gen_csalle=W7504.html"
  },
  {
    "id": "NOUVEAU_ID",
    "name": "Nouveau Cinéma",
    "url": "https://www.allocine.fr/seance/salle_gen_csalle=NOUVEAU_ID.html"
  }
]
```

Pour trouver l'ID d'un cinéma :
1. Allez sur Allociné
2. Recherchez le cinéma
3. Cliquez sur "Séances"
4. L'ID est dans l'URL : `csalle=XXXXX`

Commitez et pushez les changements, le workflow se déclenchera automatiquement.

## Développement local

```bash
# Installer les dépendances
npm install

# Lancer le scraper
npm run scrape

# Lancer le site en mode développement
npm run dev

# Builder le site
npm run build

# Prévisualiser le build
npm run preview
```

## Structure des données

La base SQLite (`data/allo-scrapper.db`) contient :
- **cinemas** : informations sur les cinémas
- **films** : métadonnées complètes des films
- **showtimes** : horaires des séances
- **weekly_programs** : programmation hebdomadaire

La base est versionnée dans Git et mise à jour automatiquement par le workflow.

## Troubleshooting

### Le workflow échoue avec "permission denied"
→ Vérifiez les permissions dans Settings → Actions → General

### Les pages ne se construisent pas
→ Assurez-vous que `astro.config.mjs` contient le bon `base` (nom du repo)

### La base de données n'est pas mise à jour
→ Vérifiez les logs du workflow dans Actions

### Les images ne s'affichent pas
→ Vérifiez que les URLs des affiches Allociné sont correctes dans la base
