# SAAS-PLAN.md — Allo-Scrapper → SaaS

Plan de transformation de l'application en mode multi-tenant SaaS.

---

## Architecture : Core Library + SaaS Overlay

L'app actuelle devient un **core standalone** extensible via un système de plugins.
Un package `@allo-scrapper/saas` s'y branche **sans modifier le comportement du core**.
Le même Docker peut tourner en mode standalone ou SaaS via `SAAS_ENABLED=true`.

```
                    ┌───────────────────────┐
                    │  ics-web (Docker)      │
                    │                        │
  SAAS_ENABLED=true │  server/src/index.ts  │
  ─────────────────►│  createApp([saasPlugin])│
                    │         │              │
                    │    ┌────▼────┐         │
                    │    │  core   │ ← inchangé en comportement
                    │    │ routes  │
                    │    └────┬────┘
                    │         │ + plugin hooks
                    │    ┌────▼────┐
                    │    │  saas   │ ← nouveau package
                    │    │ routes  │
                    │    └─────────┘
                    └───────────────────────┘
```

### Structure du monorepo

```
allo-scrapper/
├── server/          ← MODIFIÉ: ~56 lignes (app.ts, index.ts, migrations.ts)
├── client/          ← MODIFIÉ: ~25 lignes (App.tsx routing conditionnel)
├── scraper/         ← INCHANGÉ
├── migrations/      ← INCHANGÉ (core migrations)
└── packages/
    └── saas/        ← NOUVEAU workspace @allo-scrapper/saas
        ├── src/plugin.ts           ← export saasPlugin: AppPlugin
        ├── src/middleware/         ← tenant (search_path), quota
        ├── src/routes/             ← register, org/:slug/*, billing, superadmin
        ├── src/services/           ← OrgService, BillingService
        ├── src/db/                 ← org-queries, subscription-queries
        └── migrations/             ← 4 SQL SaaS (plans, orgs, subscriptions, usage)
```

### Interface `AppPlugin` (pivot de l'architecture)

Ajout de ~15 lignes à `server/src/app.ts` :

```ts
export interface AppPlugin {
  name: string;
  beforeRoutes?:     (app: Express, db: DB) => void;  // middleware additionnels
  registerRoutes?:   (app: Express, db: DB) => void;  // routes additionnelles
  afterRoutes?:      (app: Express, db: DB) => void;  // overrides finaux
  getMigrationDirs?: () => string[];                  // migrations SaaS
}

export function createApp(plugins: AppPlugin[] = []) {
  // ... code existant INCHANGÉ ...
  for (const plugin of plugins) plugin.registerRoutes?.(app, db);
  return app;
}
```

**Garanties :**
- ✅ `createApp()` sans plugin = comportement actuel identique
- ✅ Pages React core réutilisées dans SaaS (zéro duplication), préfixées `/org/:slug`
- ✅ Migrations SaaS séparées des migrations core
- ✅ Un seul binaire Docker pour les deux modes

### Chargement conditionnel dans `index.ts`

```ts
const plugins: AppPlugin[] = [];
if (process.env.SAAS_ENABLED === 'true') {
  const { saasPlugin } = await import('@allo-scrapper/saas');
  plugins.push(saasPlugin);
}
const app = createApp(plugins);
```

### Routing client conditionnel (`App.tsx`)

```tsx
const SAAS_MODE = import.meta.env.VITE_SAAS_ENABLED === 'true';

// Mode SaaS : pages existantes réutilisées sous /org/:slug/*
// Mode standalone : routes actuelles inchangées
```

### Ordre d'implémentation

```
Étape 1 — Plugin interface (app.ts + index.ts + migrations.ts) ~56 lignes
Étape 2 — Scaffold packages/saas/ (package.json + structure)
Étape 3 — Migrations SaaS (4 fichiers SQL)
Étape 4 — OrgService + tenant middleware (SET search_path)
Étape 5 — Routes SaaS (register, org/:slug/*)
Étape 6 — Client SaaS (App.tsx + TenantContext + RegisterPage)
Étape 7 — Plans & quotas
Étape 8 — Billing Stripe
Étape 9 — Superadmin portal
```

---

## Décisions architecturales

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Isolation des données | **Schema PostgreSQL par org** | Isolation maximale, pas de risque de fuite cross-tenant |
| Métadonnées films | **Partagées** (schema `public`) | Évite la duplication, les films sont la même donnée pour tous |
| Routing | **Path** : `/org/{slug}/...` | Plus simple qu'un subdomain, compatible avec les proxies actuels |
| Billing | **Stripe** intégré en Phase 4 | Solution standard, webhooks fiables |
| Base de données | **Nouvelle base propre** | Évite les conflits de migration legacy |

---

## Architecture cible

```
PostgreSQL
├── public  (données globales)
│   ├── organizations          ← liste des orgs, plan, statut
│   ├── plans                  ← Free / Starter / Pro / Enterprise
│   ├── subscriptions          ← billing Stripe par org
│   ├── films                  ← métadonnées films partagées ✅
│   └── org_migrations         ← suivi migrations par org
│
└── org_{slug}  (isolé par tenant)
    ├── users                  ← membres de l'org
    ├── cinemas                ← cinémas configurés
    ├── showtimes              ← séances scrappées
    ├── reports                ← rapports hebdomadaires
    ├── scrape_schedules       ← planification cron par cinéma
    ├── scrape_attempts        ← historique des scrapes
    ├── org_settings           ← white-label (remplace app_settings)
    └── rate_limit_configs     ← limites API par org
```

---

## Phase 1 — Multi-tenancy (schema par org) 🏗️

> **Prérequis bloquant pour toutes les autres phases.**

### 1.1 Schema global — nouvelles tables

```sql
-- Plans disponibles
CREATE TABLE plans (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,                  -- Free, Starter, Pro, Enterprise
  max_cinemas INT,                            -- NULL = illimité
  max_users   INT,
  max_scrapes_per_month INT,
  scrape_frequency_min  INT,                  -- intervalle minimum entre scrapes
  price_monthly_cents   INT DEFAULT 0,
  price_yearly_cents    INT DEFAULT 0,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly  TEXT,
  features    JSONB DEFAULT '{}'::jsonb       -- flags de fonctionnalités
);

-- Organisations / tenants
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,           -- utilisé dans /org/{slug}
  plan_id     INT REFERENCES plans(id) DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'trial', -- trial | active | suspended | canceled
  schema_name TEXT NOT NULL,                 -- 'org_' || slug
  trial_ends_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Suivi usage mensuel par org (pour billing + enforcement)
CREATE TABLE org_usage (
  id              SERIAL PRIMARY KEY,
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  month           DATE NOT NULL,              -- 1er du mois
  cinemas_count   INT DEFAULT 0,
  scrapes_count   INT DEFAULT 0,
  api_calls_count BIGINT DEFAULT 0,
  UNIQUE (org_id, month)
);

-- Migrations appliquées par org-schema
CREATE TABLE org_migrations (
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  migration_name  TEXT NOT NULL,
  applied_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (org_id, migration_name)
);
```

### 1.2 Migration runner par org

- À la création d'une org : `CREATE SCHEMA org_{slug}`
- Appliquer toutes les migrations org-level dans l'ordre
- Stocker chaque migration appliquée dans `public.org_migrations`
- Les nouvelles migrations globales sont appliquées à toutes les orgs au démarrage

```ts
// Exemple : migration 001_create_cinemas.sql appliquée dans org_moncinema
SET search_path TO org_moncinema;
CREATE TABLE cinemas (id, name, url, ...);
```

### 1.3 Middleware de résolution du tenant

```ts
// server/src/middleware/tenant.ts
// 1. Extraire le slug depuis le path : /org/:slug/...
// 2. Charger l'org depuis public.organizations
// 3. Vérifier statut (active | trial)
// 4. SET search_path TO org_{slug}, public sur la connexion DB
// 5. Attacher org à req.org

export const resolveTenant = async (req, res, next) => {
  const slug = req.params.slug;
  const org = await getOrgBySlug(slug);
  if (!org || org.status === 'suspended') return res.status(403).json(...);
  req.org = org;
  await db.query(`SET search_path TO ${org.schema_name}, public`);
  next();
};
```

### 1.4 Adaptation du JWT

Ajouter `org_id` et `org_slug` dans le payload du token JWT :

```json
{
  "sub": "user_id",
  "org_id": "uuid",
  "org_slug": "mon-cinema",
  "role": "admin",
  "permissions": [...]
}
```

### 1.5 Refactoring des routes API

Toutes les routes passent de :
```
/api/cinemas
/api/films
/api/reports
```
À :
```
/api/org/:slug/cinemas
/api/org/:slug/films
/api/org/:slug/reports
```

Les queries SQL n'ont **plus besoin de `org_id`** dans les WHERE (le schema isole déjà).

**Effort estimé : 3–4 semaines**

---

## Phase 2 — Onboarding self-service 🚪

### 2.1 Routes publiques (sans auth)

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/register` | Page d'inscription |
| `POST` | `/api/auth/register` | Crée org + schema + admin user |
| `GET` | `/api/auth/verify-email/:token` | Valide l'email |
| `GET` | `/join/:token` | Accepter une invitation |

### 2.2 Flow de création d'org (`POST /api/auth/register`)

```
1. Valider les inputs (nom, slug disponible, email, password)
2. Créer l'enregistrement dans public.organizations
3. CREATE SCHEMA org_{slug}
4. Appliquer toutes les migrations org-level
5. Créer le user admin dans org_{slug}.users
6. Envoyer email de vérification
7. Démarrer période d'essai (14 jours)
8. Retourner JWT
```

### 2.3 Wizard d'onboarding (frontend)

Nouvelle route `/register` avec stepper 4 étapes :

- **Étape 1** — Votre organisation (nom, slug → preview URL `/org/{slug}`)
- **Étape 2** — Votre compte admin (email, mot de passe)
- **Étape 3** — Ajouter votre premier cinéma (URL Allociné)
- **Étape 4** — Lancer le premier scrape → animation progression

### 2.4 Invitations membres

```ts
POST /api/org/:slug/invitations
// body: { email, role_id }
// → génère token unique (exp 48h), envoie email avec lien /join/:token

GET /join/:token
// → vérifie token, propose formulaire création compte
// → crée user dans org_{slug}.users avec le rôle défini
```

Limite d'invitations actives selon le plan (`max_users`).

**Effort estimé : 2 semaines**

---

## Phase 3 — Plans & quotas 📊

### Grille tarifaire suggérée

| Plan | Prix | Cinémas | Users | Scrapes/mois | Fréquence min |
|------|------|---------|-------|--------------|---------------|
| **Free** (essai 14j) | 0 € | 1 | 1 | 4 | 7 jours |
| **Starter** | 19 €/mois | 5 | 3 | 20 | 2 jours |
| **Pro** | 49 €/mois | 20 | 10 | 100 | 6 heures |
| **Enterprise** | Sur devis | ∞ | ∞ | ∞ | 1 heure |

### Enforcement des quotas

```ts
// server/src/middleware/quota.ts
export const checkQuota = (resource: 'cinemas' | 'users' | 'scrapes') =>
  async (req, res, next) => {
    const plan = await getPlan(req.org.plan_id);
    const usage = await getUsage(req.org.id);
    if (usage[resource] >= plan[`max_${resource}`]) {
      return res.status(402).json({ error: 'QUOTA_EXCEEDED', upgrade_url: '...' });
    }
    next();
  };

// Usage dans les routes :
router.post('/cinemas', requireAuth, checkQuota('cinemas'), createCinema);
```

### Tracking d'usage

- Incrémenter `org_usage.cinemas_count` à chaque ajout de cinéma
- Incrémenter `org_usage.scrapes_count` après chaque scrape réussi
- Reset mensuel automatique via cron (`0 0 1 * *`)

**Effort estimé : 1 semaine**

---

## Phase 4 — Billing Stripe 💳

### 4.1 Nouvelles tables (schema public)

```sql
CREATE TABLE subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID UNIQUE REFERENCES organizations(id),
  stripe_customer_id        TEXT UNIQUE,
  stripe_subscription_id    TEXT UNIQUE,
  plan_id                   INT REFERENCES plans(id),
  status                    TEXT,           -- active | trialing | past_due | canceled
  trial_ends_at             TIMESTAMPTZ,
  current_period_start      TIMESTAMPTZ,
  current_period_end        TIMESTAMPTZ,
  cancel_at_period_end      BOOLEAN DEFAULT false,
  updated_at                TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 Flows billing

```
Inscription (trial)
  └─ 14 jours gratuits sans CB
  └─ J-3 : email de rappel "votre essai expire bientôt"
  └─ J0 expiration : org passe en Free ou demande CB

Souscription
  └─ POST /api/org/:slug/billing/checkout
  └─ → Stripe Checkout Session (hosted page)
  └─ → Webhook checkout.session.completed → activate subscription

Upgrade / Downgrade
  └─ GET /api/org/:slug/billing/portal
  └─ → Stripe Customer Portal (géré par Stripe)

Paiement échoué
  └─ Webhook invoice.payment_failed
  └─ → Email notification
  └─ → Grace period 7 jours (org reste active)
  └─ → J+7 sans paiement : org suspendue (status = 'suspended')

Annulation
  └─ Webhook customer.subscription.deleted
  └─ → Org passe en plan Free ou désactivée selon config
```

### 4.3 Webhooks Stripe à implémenter

| Événement | Action |
|-----------|--------|
| `checkout.session.completed` | Activer la subscription, changer le plan |
| `customer.subscription.updated` | Sync plan_id, statut, dates |
| `customer.subscription.deleted` | Downgrade vers Free ou suspension |
| `invoice.payment_failed` | Démarrer grace period, notifier |
| `invoice.paid` | Confirmer renouvellement, reset usage mensuel |

### 4.4 Variables d'environnement à ajouter

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
APP_URL=https://app.domaine.fr
```

**Effort estimé : 2–3 semaines**

---

## Phase 5 — Portail Superadmin 🛡️

Accessible uniquement aux comptes système (`is_superadmin = true` dans `public.users`).

Route dédiée : `/superadmin` (JWT scope `superadmin` séparé, non inter-opérable avec les JWTs org).

### Pages du portail

| Page | Contenu |
|------|---------|
| **Dashboard** | MRR, ARR, churn mensuel, nouvelles orgs cette semaine, orgs actives |
| **Organisations** | Liste avec statut / plan / usage / dernière activité. Filtres + recherche |
| **Détail org** | Membres, cinémas, historique scrapes, settings, logs d'erreur |
| **Actions** | Suspendre / réactiver, changer plan (override), reset trial |
| **Impersonation** | Se connecter en tant qu'une org (audit loggé) |
| **Billing** | Vue des subscriptions Stripe, factures, disputes |

### Impersonation

```ts
POST /api/superadmin/impersonate
// body: { org_slug }
// → génère un JWT temporaire (exp 1h) avec scope org + flag impersonation
// → loggé dans public.audit_log
```

**Effort estimé : 1 semaine**

---

## Phase 6 — White-label par org 🎨

> Quasi gratuit grâce au système white-label déjà implémenté.

### Ce qui change

- `app_settings` (singleton global) → `org_settings` dans chaque schema org
- La table est identique, juste déplacée dans le bon schema
- L'API `/api/settings` devient `/api/org/:slug/settings`

### Option : domaine custom (plan Enterprise)

```
moncinema.fr  →  [Nginx/Traefik]  →  app.domaine.fr/org/moncinema
```

- Stocker `custom_domain` dans `organizations`
- Certificat SSL auto via Let's Encrypt (certbot + DNS challenge)
- Nginx : `server_name moncinema.fr` → `proxy_pass` avec header `X-Org-Slug`

**Effort estimé : 3 jours** (sans domaine custom) / **+1 semaine** (avec domaine custom)

---

## Phase 7 — Infrastructure SaaS 🚀

### 7.1 Frontend — Path routing multi-tenant

```tsx
// React Router
<Routes>
  <Route path="/" element={<LandingPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/org/:slug/*" element={
    <TenantProvider>  {/* charge l'org, injecte dans le contexte */}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cinema/:id" element={<CinemaPage />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
      </Routes>
    </TenantProvider>
  } />
  <Route path="/superadmin/*" element={<SuperAdminRoutes />} />
</Routes>
```

### 7.2 Isolation des workers scraper

```
Redis
├── scrape:jobs:org_moncinema   ← queue dédiée par org
├── scrape:jobs:org_autreorg
└── scrape:progress:{jobId}     ← SSE progress (inchangé)
```

- Workers consomment leur queue dédiée
- Rate limiting per-org sur les requêtes vers Allociné
- Pas de starvation d'une org par une autre (round-robin entre queues)

### 7.3 Connexions DB

```ts
// Pool de connexions avec search_path dynamique
// Option A : connexion unique + SET search_path par requête (simple)
// Option B : pool de connexions dédiées par org (performances élevées, complexe)

// Recommandation : Option A pour démarrer, Option B si >100 orgs actives
```

### 7.4 Backup & restore par org

```bash
# Export d'une org complète
pg_dump --schema=org_moncinema $DATABASE_URL > backup_moncinema_$(date +%Y%m%d).sql

# API pour les admins org
GET /api/org/:slug/export   → télécharge un JSON complet (cinémas, séances, settings)
```

### 7.5 Observabilité multi-tenant

- Ajouter `org_id` dans tous les logs structurés
- Métriques Prometheus labellisées par `org_slug`
- Dashboards Grafana : vue globale + drill-down par org

**Effort estimé : 2 semaines**

---

## Récapitulatif & ordre d'exécution

```
Phase 1 (multi-tenancy)           ← COMMENCER ICI — bloquant
  ├── Phase 2 (onboarding)
  ├── Phase 3 (plans & quotas)
  │     ├── Phase 4 (billing Stripe)
  │     └── Phase 5 (superadmin)
  └── Phase 6 (white-label/org)   ← trivial une fois Phase 1 faite
Phase 7 (infra)                   ← en parallèle dès Phase 1 stable
```

| Phase | Description | Effort | Priorité |
|-------|-------------|--------|---------|
| 1 | Multi-tenancy — schema par org | 3–4 semaines | 🔴 Bloquant |
| 2 | Onboarding self-service | 2 semaines | 🔴 Critique |
| 3 | Plans & quotas | 1 semaine | 🟠 Important |
| 4 | Billing Stripe | 2–3 semaines | 🟠 Important |
| 5 | Portail Superadmin | 1 semaine | 🟡 Utile |
| 6 | White-label par org | 3 jours | 🟢 Facile |
| 7 | Infrastructure SaaS | 2 semaines | 🟠 Important |
| **Total** | | **~12–14 semaines** | |

---

## Variables d'environnement à ajouter

```env
# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=

# Email (onboarding, invitations, notifications billing)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=

# App
APP_URL=https://app.domaine.fr
SUPERADMIN_JWT_SECRET=   # secret séparé pour les JWTs superadmin
```

---

## Références

- [Stripe Billing Docs](https://stripe.com/docs/billing)
- [PostgreSQL Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [Row Level Security (alternative à schema par org)](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
