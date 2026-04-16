# Notes — Epics & Stories allo-scrapper

> Phase 4 — Amélioration de la qualité et couverture de tests  
> 7 epics · 31 stories · Effort estimé : **86–120h**

---

## Vue d'ensemble

| Epic | Titre | Priorité | Effort | Stories |
|------|-------|----------|--------|---------|
| **Epic 0** | Test Infrastructure Setup *(Technical Blocker)* | ⚡ Sprint 0 | 16–24h | 0.1 → 0.4 |
| **Epic 1** | Multi-Tenant Security & Isolation Hardening | 🔴 BLOCKER | 20–28h | 1.1 → 1.6 |
| **Epic 2** | Scraper Job Queue Reliability & Failure Handling | 🔴 HIGH | 16–20h | 2.1 → 2.6 |
| **Epic 3** | Real-Time Communication & Protection (SSE + Rate Limiting) | 🔴 HIGH | 18–24h | 3.1 → 3.8 |
| **Epic 4** | Database Migration Reliability & Idempotency | 🟡 MEDIUM | 8–12h | 4.1 → 4.3 |
| **Epic 5** | White-Label Theme Consistency & Validation | 🟢 LOW | 4–6h | 5.1 → 5.2 |
| **Epic 6** | Email Template Validation & Branding | 🟢 LOW | 4–6h | 6.1 → 6.2 |

**Ordre d'implémentation recommandé :** Epic 0 → 1 → 2 → 3 → 4 → 5 → 6

---

## Epic 0 — Test Infrastructure Setup *(Technical Blocker)*

**Objectif :** Playwright tourne en parallèle (workers > 1), fixtures multi-tenant disponibles, Redis Testcontainers en CI.  
**Doit être terminé avant Epic 1.**

### Story 0.1 — Enable Playwright Parallel Execution
*En tant que QA engineer, je veux lancer les tests E2E avec workers > 1.*

- `workers: 4` dans `playwright.config.ts` → tous les tests passent sans flakiness
- Réduction du temps d'exécution d'au moins 50%
- CI tourne avec `workers: 2` minimum

### Story 0.2 — Implement Multi-Tenant Test Fixture API
*En tant que QA engineer, je veux une API pour créer/nettoyer des orgs de test.*

- `POST /test/seed-org` → crée org avec 2 users, 3 cinemas, 10 schedules
- `DELETE /test/cleanup-org/:id` → supprime tout en < 500ms
- Endpoint retourne 404 en mode production
- 4 appels parallèles simultanés sans conflits ni deadlocks
- Cleanup < 200ms par org

### Story 0.3 — Setup Redis Testcontainers in CI
*En tant que QA engineer, je veux Redis démarré automatiquement en CI.*

- Container Redis accessible sur `localhost:6379` depuis les tests
- Nettoyage automatique après les tests
- Démarrage automatique en local avec `npm test`
- Logs Redis inclus dans l'output CI en cas d'échec

### Story 0.4 — Create Auto-Cleanup Test Utilities
*En tant que QA engineer, je veux des utilitaires de nettoyage automatique après chaque test.*

- `test.afterEach(cleanup)` supprime toutes les données créées en < 500ms
- En cas de crash avant cleanup → hook global supprime toutes les orgs de test
- Chaque test ne supprime que ses propres données (isolation parallèle)

---

## Epic 1 — Multi-Tenant Security & Isolation Hardening

**Objectif :** Isolation totale des organisations en mode SaaS + observabilité avec org_id dans toutes les traces.  
**Requiert :** Stories 0.2, 0.4 (et 0.1 pour les stories 1.3–1.5)

### Story 1.1 — Implement org_id Validation Middleware
*En tant que security engineer, je veux que tous les appels API valident l'org_id du JWT.*

- `GET /api/cinemas?org_id=B` depuis org A → 403 + log de la tentative
- Requête sans org_id → filtrage automatique par middleware sur org A
- `POST` avec `org_id` forgé dans le body → écrasé par l'org_id du JWT

### Story 1.2 — Add org_id to All Observability Traces
*En tant que DevOps engineer, je veux que toutes les traces OpenTelemetry incluent l'org_id.*

- Tous les spans incluent `org_id` comme attribut (y compris spans enfants)
- Jobs scraper : métadonnées Redis + événements SSE incluent org_id
- Logs Winston : JSON structuré `{ org_id, user_id, endpoint, error }` → filtrable dans Loki

### Story 1.3 — E2E Multi-Tenant Cinema Isolation Test
*En tant que QA engineer, je veux valider l'isolation des cinémas entre organisations.*

- User org A ne voit que ses cinémas dans `data-testid="cinema-list"`
- Navigation directe vers `/cinemas/:id` d'une autre org → `data-testid="403-error-message"`
- Aucun ID de cinéma étranger dans les réponses API
- Test < 2 min (single worker), < 5 min (workers=4)

### Story 1.4 — E2E Multi-Tenant User Management Isolation Test
*En tant que QA engineer, je veux valider l'isolation des utilisateurs.*

- Admin A voit uniquement ses users dans `data-testid="user-management-table"`
- `PUT /api/users/:id` (user org B) → 403 + log violation de sécurité
- `DELETE /api/users/:id` (user org B) → 403 + alerte dans les logs

### Story 1.5 — E2E Multi-Tenant Schedule Isolation Test
*En tant que QA engineer, je veux valider l'isolation des programmes.*

- User org A voit uniquement ses schedules dans `data-testid="schedule-calendar"`
- `GET /api/schedules?cinema_id=<B>` → 403
- Toutes les entrées de réponse ont `org_id=A`

### Story 1.6 — API-Level Tenant Isolation Enforcement Tests
*En tant que QA engineer, je veux des tests d'intégration validant le filtrage SQL par org_id.*

- Toutes les requêtes DB incluent automatiquement `WHERE org_id = :authenticated_org_id`
- Impossible d'omettre accidentellement le filtre (ajouté par middleware)
- Nouvelle table org-scoped → contrainte `NOT NULL` + index sur `org_id`

---

## Epic 2 — Scraper Job Queue Reliability & Failure Handling

**Objectif :** Jobs de scraping fiables sous charge (100+ jobs simultanés), DLQ pour les échecs, API admin.  
**Requiert :** Story 0.3 (pour 2.3) et Story 0.2 (pour 2.5)

> **Note DLQ UI :** Story 2.6 est API-only pour le MVP. L'UI admin (table, filtres, pagination) peut être ajoutée dans un futur epic (+8–12h estimés).

### Story 2.1 — Implement Dead-Letter Queue for Failed Scraper Jobs
*En tant que DevOps engineer, je veux que les jobs échoués aillent en DLQ après 3 tentatives.*

- 3 échecs avec backoff exponentiel (1s, 2s, 4s) → job en DLQ
- `GET /api/scraper/dlq` → liste paginée des jobs échoués (tri par date, 50/page)
- Retry depuis l'admin panel → job re-queué, compteur remis à 0

### Story 2.2 — Add Exponential Backoff Retry Logic for Redis Failures
*En tant que backend developer, je veux que les timeouts Redis retentent avec backoff exponentiel.*

- Timeout → retry 1s → 2s → 4s → DLQ si le 3ème échoue
- Crash Redis mid-dequeue → job marqué failed + retry
- Tests unitaires valident les délais `[1s, 2s, 4s]` et l'absence de boucle infinie

### Story 2.3 — Redis Job Queue Load Testing (100+ Concurrent Jobs)
*En tant que QA engineer, je veux valider zéro perte de job sous charge.*

- 100 jobs simultanés → tous traités, `p-limit` respecté (max 5 simultanés)
- Queue depth décroît régulièrement, aucun job bloqué > 2 min
- Échec d'un job en cours de charge → retry sans interrompre les autres

### Story 2.4 — Redis Reconnection Handling During Job Processing
*En tant que backend developer, je veux que les déconnexions Redis soient gérées gracieusement.*

- Déconnexion → pause + reconnexion avec backoff, jobs in-flight NON marqués comme failed
- Reconnexion réussie → jobs repris depuis le dernier checkpoint, pas de doublons
- 3 échecs de reconnexion → tous les jobs in-flight en DLQ + alerte critique

### Story 2.5 — E2E Scraper Progress Tracking with 10+ Concurrent Jobs
*En tant que QA engineer, je veux valider le suivi en temps réel sous charge.*

- 10 scrapes simultanés → tous affichent la progression via `data-testid="scrape-progress-card"`
- Tous les `data-testid="scrape-status-completed"` visibles en < 2 min
- Échec d'un scrape → erreur affichée, autres scrapes continuent

### Story 2.6 — DLQ API Endpoints (API-Only, No UI)
*En tant qu'admin, je veux des endpoints API pour consulter et relancer les jobs échoués.*

- `GET /api/admin/scraper/dlq` → JSON paginé avec `{ job_id, cinema_id, org_id, failure_reason, retry_count, timestamp }`
- `POST /api/admin/scraper/dlq/:job_id/retry` → re-queue, remove from DLQ, 200 OK
- ID invalide → 404 `"DLQ job not found"`
- Non-admin → 403 `"Admin privileges required"`

---

## Epic 3 — Real-Time Communication & Protection (SSE + Rate Limiting)

**Objectif :** Connexions SSE stables sur 10+ minutes, reconnexion automatique, rate limiting sans faux positifs.  
**Requiert :** Story 0.1 (pour 3.2, 3.3, 3.4)

> ⚠️ **Ordre d'implémentation obligatoire :**
> 1. **Story 3.7** (localhost exemption) — MUST BE FIRST
> 2. **Story 3.1** (SSE heartbeat) — SECOND
> 3. **Story 3.5** (burst scenarios) — THIRD
> 4. Stories 3.2, 3.3, 3.4, 3.6, 3.8 — peuvent être parallèles

### Story 3.1 — Implement SSE Heartbeat Mechanism *(2nd)*
*En tant que backend developer, je veux que le serveur envoie des pings SSE toutes les 30 secondes.*

- Ping `{ type: "ping", timestamp: <ISO8601> }` toutes les 30s → connexion reste ouverte
- Scrape en cours 10+ min → pings ET events de progression coexistent
- Inactivité 15 min → fermeture gracieuse + log

**Deployment:** 🟡 SAFE — aucun breaking change, rollback safe

### Story 3.2 — Implement Client SSE Reconnection Logic *(parallèle)*
*En tant que frontend developer, je veux que le client détecte les heartbeats manqués et se reconnecte.*

- Pas de ping pendant 60s → `data-testid="sse-connection-status"` = "Reconnecting..."
- Reconnexion réussie → statut "Connected", reprise des events (event IDs idempotents)
- Après reconnexion → `data-testid="scrape-progress-percentage"` et `scrape-progress-eta` mis à jour

**Deployment:** 🟡 SAFE — client-side uniquement, dégradation gracieuse

### Story 3.3 — SSE Long-Running Connection Validation *(parallèle)*
*En tant que QA engineer, je veux valider que les connexions SSE tiennent 10+ minutes.*

- Connexion reste ouverte toute la durée du scrape
- Pings toutes les 30s + events de progression reçus
- Chaque event a un ID unique et croissant, client peut reprendre depuis le dernier ID

**Deployment:** 🟢 TEST-ONLY

### Story 3.4 — SSE Concurrent Client Load Test *(parallèle)*
*En tant que QA engineer, je veux valider 50+ clients SSE simultanés.*

- 50 clients → pings reçus toutes les 30s, latence < 1s, mémoire stable < 512MB
- Broadcast à 50 clients → tous reçoivent l'event en < 1s
- Arrêt gracieux du serveur → tous les clients reçoivent l'event `close` en < 5s

**Deployment:** 🟢 TEST-ONLY

### Story 3.5 — Rate Limiting Burst Scenario Tests *(3rd)*
*En tant que QA engineer, je veux valider que les bursts légitimes ne sont pas bloqués.*

- 3 requêtes en 10 secondes → toutes réussissent (200 OK)
- 5 rechargements de page en 5 secondes → aucun rate limiting
- 11 requêtes en 60 secondes → 11ème → 429 + `data-testid="429-error-message"` + retry-after

**Deployment:** 🟡 SAFE

### Story 3.6 — Rate Limiting Window Reset Validation *(parallèle)*
*En tant que QA engineer, je veux valider que la fenêtre de rate limiting se réinitialise.*

- Après 60s → requête réussit, compteur à 0
- Header `Retry-After: 60` dans la réponse 429 + `data-testid="rate-limit-reset-timer"` countdown
- User A rate-limited → User B peut encore faire des requêtes (compteurs indépendants)

**Deployment:** 🟢 TEST-ONLY

### Story 3.7 — Localhost Exemption for Docker Health Probes *(MUST BE FIRST)*
*En tant que DevOps engineer, je veux que les requêtes localhost soient exemptées du rate limiting.*

- Requête depuis `127.0.0.1` ou `::1` → aucun rate limiting, jamais de 429
- Requête depuis IP externe → rate limiting normal (10 req/min sur `/api/health`)
- 20 requêtes en 10s depuis localhost → toutes réussies

**Deployment:** 🔴 BLOCKER — doit être déployé AVANT tout changement de rate limiting

### Story 3.8 — Rate Limiting Documentation *(parallèle)*
*En tant que développeur, je veux que les fenêtres de rate limiting soient documentées dans le README.*

- Section README avec tableau `Endpoint | Limit (req/min) | Exemptions`
- Documentation du comportement `retry-after` + exemples de code pour gérer les 429
- Guide pour tester le rate limiting en dev

**Deployment:** 🟢 DOCUMENTATION-ONLY

---

## Epic 4 — Database Migration Reliability & Idempotency

**Objectif :** Migrations SQL sûres et re-jouables sur bases fraîches ET existantes, validées en CI.

> **Test matrix à appliquer sur chaque migration :**
> 1. Fresh DB + run once → SUCCESS
> 2. Fresh DB + run twice → SUCCESS (no error on 2nd run)
> 3. Populated DB + run once → SUCCESS
> 4. Populated DB + run twice → SUCCESS

### Story 4.1 — Enforce Migration Idempotency Checks in Migrations
*En tant que backend developer, je veux que les migrations vérifient l'existence des éléments avant de les créer.*

- Ajout de colonne → vérification `information_schema` + log "skipping" si existant
- Création de table → `CREATE TABLE IF NOT EXISTS`
- Création d'index → vérification préalable

**Rollback :** Transaction atomique (BEGIN/COMMIT) → rollback auto en cas d'échec

### Story 4.2 — Add Verification Steps to All Migrations
*En tant que DBA, je veux que les migrations incluent une étape de vérification post-exécution.*

- Après `ALTER TABLE` → query `information_schema.columns` pour confirmer
- Si l'élément est absent → `RAISE EXCEPTION` → rollback de toute la transaction
- Echec de vérification → état DB inchangé + log détaillé

### Story 4.3 — CI Pipeline Migration Idempotency Validation
*En tant que DevOps engineer, je veux que la CI exécute chaque migration deux fois pour valider l'idempotence.*

- CI exécute toutes les migrations sur fresh DB, puis les re-exécute
- Migration non-idempotente → CI fail + message indiquant quelle migration est problématique + PR bloquée
- Toutes idempotentes → log "All migrations are idempotent" → merge débloqué

---

## Epic 5 — White-Label Theme Consistency & Validation

**Objectif :** Changements de thème appliqués uniformément, tests de régression, CSP strict mode.

### Story 5.1 — Theme Switching E2E Regression Tests
*En tant que QA engineer, je veux valider que les thèmes s'appliquent à tous les composants.*

- Changement couleur primaire `#FF5733` → tous les boutons utilisent cette couleur, aucun conflit CSS
- Changement font → tous les `h1–h6` utilisent la police configurée
- Navigation sur plusieurs pages → thème cohérent partout, aucun branding par défaut visible

### Story 5.2 — CSP Strict Mode Validation
*En tant que security engineer, je veux valider que la CSP interdit unsafe-inline et unsafe-eval.*

- Header `Content-Security-Policy` présent dans les réponses HTTP
- `script-src` n'inclut PAS `unsafe-inline` ni `unsafe-eval`
- Aucun style inline dans le HTML avec thème appliqué
- Aucune violation CSP dans la console du navigateur pendant les tests E2E

---

## Epic 6 — Email Template Validation & Branding

**Objectif :** Emails rendus correctement dans 6 clients mail, branding white-label cohérent.

> **Test matrix email clients :**
> - Gmail Web (Chrome)
> - Gmail Mobile (iOS)
> - Outlook 2016
> - Outlook 2019
> - Apple Mail (macOS)
> - iOS Mail

### Story 6.1 — Email Template Cross-Client Rendering Tests
*En tant que QA engineer, je veux valider le rendu des emails dans les principaux clients.*

- HTML valide (pas de balises non fermées), layout table-based (compatible Outlook)
- Rendu correct dans les 6 clients du test matrix (via Litmus ou Email on Acid)
- PR doit inclure les screenshots des 6 clients

### Story 6.2 — Email Template Branding Consistency
*En tant qu'admin, je veux que les emails reflètent le branding white-label de mon organisation.*

- Email de reset de mot de passe → couleur header, footer text, From Name/Address = config org
- Mise à jour du branding → nouveaux emails reflètent le nouveau branding (pas rétroactif)
- Pas de branding configuré → fallback sur le branding Allo-Scrapper par défaut (complet, pas de placeholders)

---

## Annexe — Dépendances inter-epics

```
Epic 0 ─────────────────────────────┐
   │ Stories 0.1, 0.2, 0.3, 0.4     │
   ▼                                 │
Epic 1 (requiert 0.2, 0.4, et 0.1 pour 1.3–1.5)
Epic 2 (requiert 0.3 pour 2.3, et 0.2 pour 2.5)
Epic 3 (requiert 0.1 pour 3.2, 3.3, 3.4)
Epic 4 ─ indépendant
Epic 5 ─ indépendant
Epic 6 ─ indépendant
```

**Dépendances internes Epic 3 (ordre obligatoire) :**

```
3.7 → 3.1 → 3.5 → { 3.2, 3.3, 3.4, 3.6, 3.8 } (parallèles)
```

---

## Annexe — Métriques qualité

| Métrique | Valeur |
|----------|--------|
| Total epics | 7 (Epic 0–6) |
| Total stories | 31 |
| Stories avec Given/When/Then | 31/31 (100%) |
| Stories indépendantes (no forward deps) | 31/31 (100%) |
| FRs couverts | 9/9 (100%) |
| Effort estimé (réaliste) | 86–120h |
| Effort initial naïf | 48–64h |
