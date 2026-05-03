# Story 7.2 — Refactor Theme Variables Contract Implementation Plan

> **For Hermes:** utiliser `majordome-subagent-dev-loop` pour exécuter ce plan patch par patch, avec vérification locale avant `CR`, puis `GP` obligatoire après `CR`, avant toute autre décision. Après `GP`, attendre un ordre explicite de Maitre Opelkad avant tout `CS`, `DS`, `push-flow` ou merge-related action.

**Goal:** unifier le contrat de thème white-label entre client, serveur et package SaaS afin qu’une seule nomenclature de clés de settings et de variables CSS soit utilisée en lecture, écriture, import/export et rendu.

**Architecture:** faire du contrat serveur/SaaS la source canonique (`color_surface`, `color_text_primary`, `font_primary`, etc.), puis retirer progressivement les alias legacy côté client (`color_text`, `color_border`, `font_family_heading`, `font_family_body`). Conserver au besoin une courte phase de compatibilité aux frontières d’import/export, mais ne plus propager les noms legacy dans les types UI, contextes et hooks.

**Tech Stack:** React + TypeScript client, Express + TypeScript serveur, package SaaS partagé, Vitest, Playwright ciblé si besoin.

---

## Contexte établi

Constats relevés dans l’état actuel du repo :

- **Contrat canonique côté serveur** déjà exprimé avec les noms modernes dans `server/src/types/settings.ts` et `packages/saas/src/db/types.ts` :
  - `color_surface`
  - `color_text_primary`
  - `color_text_secondary`
  - `font_primary`
  - `font_secondary`
- **Client encore majoritairement legacy** dans `client/src/api/settings.ts`, `client/src/contexts/SettingsProvider.tsx`, `client/src/pages/admin/SettingsPage.tsx`, `client/src/hooks/useTheme.test.tsx` :
  - `color_text`
  - `color_border`
  - `font_family_heading`
  - `font_family_body`
- **Ponts de compatibilité déjà présents** :
  - `client/src/api/settings.ts` avec `normalizeSettingsResponse()` et `toServerSettingsUpdate()`
  - `packages/saas/src/routes/org-settings.ts` avec `normalizeImportSettings()` qui accepte encore les anciennes clés à l’import
- **Génération CSS déjà canonique** dans `server/src/services/theme-generator.ts`, avec variables modernes + alias CSS legacy `--theme-*` pour compatibilité de rendu.

## Décision de contrat

### Contrat JSON canonique cible

Le client, le serveur et SaaS doivent converger vers ces clés applicatives :

- `site_name`
- `logo_base64`
- `favicon_base64`
- `color_primary`
- `color_secondary`
- `color_accent`
- `color_background`
- `color_surface`
- `color_text_primary`
- `color_text_secondary`
- `color_success`
- `color_error`
- `font_primary`
- `font_secondary`
- `footer_text`
- `footer_links`
- `email_from_name`
- `email_from_address`
- `email_logo_base64` si encore nécessaire côté client admin
- `scrape_mode`
- `scrape_days`

### Compatibilité transitoire autorisée

Pendant la migration, les **seules** zones autorisées à accepter les noms legacy sont :

- import JSON (`/api/settings/import` et `/api/org/:slug/settings/import`)
- éventuellement lecture défensive d’anciens exports fixtures/tests

Les noms legacy ne doivent plus être le contrat principal des types client ni de l’état React.

---

## Task 1: Figer le contrat canonique côté client API

**Objective:** faire du client API le point d’entrée canonique des noms de thème.

**Files:**
- Modify: `client/src/api/settings.ts`
- Test: `client/src/api/settings.test.ts` si présent, sinon enrichir les tests consommateurs existants

**Étapes:**
1. Remplacer `AppSettingsPublic`, `AppSettings` et `AppSettingsUpdate` côté client pour utiliser les noms canoniques (`color_surface`, `color_text_primary`, `font_primary`, etc.).
2. Réduire `LegacyThemeShape` à un rôle strictement défensif de lecture d’anciens payloads.
3. Adapter `normalizeSettingsResponse()` pour produire **uniquement** la forme canonique en sortie.
4. Adapter `toServerSettingsUpdate()` pour devenir un simple passage quasi direct, sans remap depuis les champs legacy du formulaire.
5. Conserver, si nécessaire, un normaliseur d’import legacy dédié, explicitement limité aux anciens JSON.

**Verification:**
- Les types exportés par `client/src/api/settings.ts` n’exposent plus `color_text`, `color_border`, `font_family_heading`, `font_family_body` comme contrat normal.
- Les appels `getPublicSettings`, `getAdminSettings`, `updateSettings`, `importSettings` retournent tous la forme canonique.

---

## Task 2: Propager le contrat canonique dans le contexte React

**Objective:** supprimer la duplication legacy dans l’état partagé du client.

**Files:**
- Modify: `client/src/contexts/SettingsContext.ts`
- Modify: `client/src/contexts/SettingsProvider.tsx`

**Étapes:**
1. Mettre à jour `SettingsContextType` pour refléter les types canoniques venant de `client/src/api/settings.ts`.
2. Dans `SettingsProvider.tsx`, supprimer les reconstructions d’objet public avec clés legacy.
3. Faire circuler `adminSettings` et `publicSettings` avec les mêmes noms canoniques autant que possible.

**Verification:**
- `SettingsProvider` ne reconstruit plus `color_text`, `color_border`, `font_family_heading`, `font_family_body`.
- Le contexte devient un simple transport de données canoniques.

---

## Task 3: Migrer l’écran admin Settings vers les clés canoniques

**Objective:** aligner la UI d’édition avec le contrat serveur réel.

**Files:**
- Modify: `client/src/pages/admin/SettingsPage.tsx`
- Test: `client/src/pages/admin/SettingsPage.test.tsx`

**Étapes:**
1. Mettre à jour `getInitialFormData()` pour lire `color_surface`, `color_text_primary`, `font_primary`, `font_secondary`.
2. Mettre à jour les contrôles du formulaire :
   - `Text Color` → `color_text_primary`
   - `Border Color` ou l’équivalent métier à renommer vers `color_surface` si c’est bien la sémantique retenue
   - `Heading Font` → `font_primary`
   - `Body Font` → `font_secondary`
3. Revoir les labels UI si nécessaire pour éviter la confusion entre « border » et « surface ».
4. Mettre à jour les mocks de tests pour utiliser le contrat canonique.

**Verification:**
- Les valeurs du formulaire round-trip correctement avec `updateSettings()` sans couche legacy implicite.
- Les tests de visibilité/permissions restent verts après renommage du contrat.

---

## Task 4: Aligner `useTheme` et les tests de rendu client

**Objective:** faire dépendre le rendu du thème des mêmes clés que celles servies par le backend.

**Files:**
- Modify: `client/src/hooks/useTheme.ts`
- Modify: `client/src/hooks/useTheme.test.tsx`
- Optional review: composants ou tests qui consomment encore les noms legacy

**Étapes:**
1. Recalculer `themeVersion` à partir des champs canoniques :
   - `color_surface`
   - `color_text_primary`
   - `font_primary`
   - `font_secondary`
2. Mettre à jour les fixtures de `useTheme.test.tsx` pour refléter le contrat canonique.
3. Vérifier qu’aucune logique de cache d’URL thème ne dépend encore des noms legacy.

**Verification:**
- `useTheme.test.tsx` valide toujours le refresh du lien `theme.css` lors d’un changement de settings.
- Les assertions portent sur les champs canoniques.

---

## Task 5: Durcir les frontières serveur et SaaS

**Objective:** rendre explicite que le contrat principal est canonique, avec compatibilité legacy seulement aux frontières contrôlées.

**Files:**
- Modify: `server/src/routes/settings.ts`
- Modify: `packages/saas/src/routes/org-settings.ts`
- Review: `server/src/types/settings.ts`
- Review: `packages/saas/src/db/types.ts`
- Test: `server/src/routes/settings.test.ts`
- Test: `packages/saas/src/services/org-settings-service.test.ts`
- Add/extend tests if needed under `packages/saas/src/routes/`

**Étapes:**
1. Corriger dans `server/src/routes/settings.ts` les validations/limites qui utilisent encore `font_family_heading` et `font_family_body`, pour les faire pointer sur `font_primary` / `font_secondary`.
2. Vérifier que le routeur serveur principal refuse/ignore proprement les payloads mal formés sans réintroduire de noms legacy comme contrat implicite.
3. Conserver dans `packages/saas/src/routes/org-settings.ts` la compatibilité import legacy, mais documenter/tester qu’elle est cantonnée à `normalizeImportSettings()`.
4. Ajouter des tests dédiés qui prouvent :
   - payload canonique accepté
   - ancien export legacy accepté seulement à l’import
   - sortie API publique/admin toujours canonique

**Verification:**
- Les routeurs ne publient plus de contrat legacy hors import défensif.
- Les validations serveur et SaaS parlent le même langage de champs.

---

## Task 6: Nettoyer et verrouiller les tests de non-régression

**Objective:** prouver la convergence du contrat sur toutes les couches.

**Files:**
- Modify: `server/src/services/theme-generator.test.ts`
- Modify: `server/src/routes/settings.test.ts`
- Modify: `client/src/pages/admin/SettingsPage.test.tsx`
- Modify: `client/src/hooks/useTheme.test.tsx`
- Modify: tests additionnels pertinents dans `packages/saas/src/...`

**Étapes:**
1. Remplacer les fixtures legacy restantes par des fixtures canoniques.
2. Conserver uniquement des tests legacy là où la compatibilité est volontaire (imports historiques).
3. Ajouter une assertion croisée utile : les mêmes settings canoniques produisent les mêmes variables CSS attendues côté serveur.

**Verification commands:**
- `docker exec allo-scrapper-client-dev sh -lc 'cd /app && npm run test:run --workspace=client -- src/hooks/useTheme.test.tsx src/pages/admin/SettingsPage.test.tsx'`
- `docker exec allo-scrapper-server-dev sh -lc 'cd /app && npm run test:run --workspace=allo-scrapper-server -- src/services/theme-generator.test.ts src/routes/settings.test.ts'`
- `docker exec allo-scrapper-server-dev sh -lc 'cd /app && npm run test:run --workspace=@allo-scrapper/saas -- src/services/org-settings-service.test.ts'`

**Expected:** suites vertes, sans dépendance principale aux noms legacy.

---

## Risques et points d’attention

1. **Confusion sémantique `color_surface` vs `color_border`**
   - Le legacy mappe aujourd’hui `color_border` vers `color_surface`.
   - Il faut confirmer en CS si le champ UI doit réellement devenir `surface`, ou si un vrai champ `border` manque au modèle.

2. **Caches / import-export historiques**
   - Des fixtures ou exports existants peuvent encore contenir les anciennes clés.
   - Ne pas casser l’import historique ; isoler cette compatibilité.

3. **Tests E2E fragiles autour des settings**
   - Les flows Playwright/import ont déjà montré de la fragilité.
   - Limiter le périmètre de 7.2 au contrat de données + tests ciblés avant d’étendre aux E2E.

4. **Duplication client public/admin**
   - `SettingsProvider` reconstruit encore manuellement `publicSettings` à partir d’`adminSettings`.
   - Source probable de dérive future si non simplifiée.

---

## Définition de fini proposée pour 7.2

La story peut être considérée terminée quand :

- le client manipule le contrat canonique de thème de bout en bout ;
- le serveur et SaaS publient un contrat JSON canonique identique ;
- les noms legacy n’existent plus que dans la compatibilité d’import historique ;
- les tests ciblés client, serveur et SaaS passent ;
- aucune couche active ne dépend encore des noms `color_text`, `color_border`, `font_family_heading`, `font_family_body` comme contrat principal.

---

## Exécution BMAD recommandée

Prochaine séquence BMAD de référence :

1. **CS** — matérialiser la story 7.2 en implementation artifact à partir de ce plan
2. **VS** — valider le périmètre exact, surtout `color_surface` vs `color_border`
3. **DS** — exécution patch par patch via sous-agent indépendant
4. **CR local** — revue BMAD locale avant toute décision de suite
5. **GP** — étape obligatoire immédiatement après `CR`
6. **WAIT** — après `GP`, attendre un ordre explicite de Maitre Opelkad avant tout `CS`, `DS`, `push-flow` ou merge-related action
