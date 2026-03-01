# 🎨 Plan d'implémentation : Système de Marque Blanche

**Date de création :** 01/03/2026  
**Dernière mise à jour :** 01/03/2026  
**Objectif :** Transformer Allo-Scrapper en plateforme marque blanche avec personnalisation avancée + gestion complète des utilisateurs

**Statut global : ~95% COMPLÉTÉ** 🎉

---

## 🎯 Statut d'implémentation (01/03/2026)

| Phase | Nom | Statut | Issues | PRs |
|-------|-----|--------|--------|-----|
| **1** | Database Setup & Migrations | ✅ **COMPLETE** | #194, #195 | #202 |
| **2** | Backend - Settings API | ✅ **COMPLETE** | #196 | #198 |
| **3** | Backend - User Management API | ✅ **COMPLETE** | #205 | #206 |
| **4** | Backend - Theme CSS Generator | ✅ **COMPLETE** | #204 | #204 |
| **5** | Backend - Integration & Docker | ✅ **COMPLETE** | #214 | #214 |
| **6** | Frontend - API Client & Contexts | ✅ **COMPLETE** | #197 | #199 |
| **7** | Frontend - UI Components | ⚠️ **PARTIAL** | - | - |
| **8** | Frontend - Admin Structure | ✅ **DIFFERENT** | #197 | #199 |
| **9** | Frontend - Branding Tab | ✅ **COMPLETE** | #197 | #199 |
| **10** | Frontend - Users Tab | ✅ **COMPLETE** | #211 | #212 |
| **11** | Frontend - System Tab | ⏳ **IN PROGRESS** | #231 | - |
| **12** | Frontend - Apply Theme Globally | ✅ **COMPLETE** | #209 | #210 |
| **13** | Documentation & Docker | ✅ **COMPLETE** | #207 | #208 |
| **14** | E2E Tests | ✅ **COMPLETE** | - | - |

### 📊 Résumé des réalisations

**✅ Fonctionnalités complètes (13/14 phases):**
- ✅ Base de données : 5 migrations (004-007 + user roles)
- ✅ Backend API : Settings, Users, Theme Generator (2,380 lignes de tests)
- ✅ Frontend : SettingsPage (5 tabs), UsersPage, RequireAdmin
- ✅ Thème dynamique : useTheme hook + /api/theme.css
- ✅ Documentation : ADMIN_PANEL.md (601 lignes) + API.md
- ✅ E2E Tests : 664 lignes (theme-application.spec.ts + user-management.spec.ts)

**⏳ En cours (Phase 11 - System Tab):**
- ✅ Export/Import config : Déjà implémenté dans SettingsPage
- ❌ System Info Dashboard : À implémenter (Issue #231)
- ❌ Migrations Viewer : À implémenter
- ❌ Health Metrics : À implémenter

**📝 Notes d'implémentation:**
- **Phase 7** : UI Components Library intentionnellement sautée (réutilisation composants existants)
- **Phase 8** : Approche différente adoptée (pages séparées `/admin/settings` et `/admin/users` au lieu d'une page unique avec tabs - meilleur UX)

---

## 📋 Vue d'ensemble

### Fonctionnalités principales

1. **Branding personnalisable**
   - Nom du site, logo, favicon
   - Palette de couleurs complète (9 couleurs)
   - Typographies Google Fonts
   - Footer personnalisable avec liens

2. **Gestion des utilisateurs**
   - Système de rôles (admin/user)
   - CRUD utilisateurs via interface admin
   - Reset password, changement de rôle
   - Protection dernier admin

3. **Interface admin avec onglets**
   - Tab 1: Branding (personnalisation visuelle)
   - Tab 2: Utilisateurs (gestion utilisateurs)
   - Tab 3: Cinémas (gestion existante)
   - Tab 4: Système (export/import config)

4. **Export/Import configuration**
   - Téléchargement JSON de la config
   - Import avec validation

---

## 🏗️ Architecture

### Base de données

#### Table `app_settings` (singleton)
```sql
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_name TEXT NOT NULL DEFAULT 'Allo-Scrapper',
  logo_base64 TEXT,
  favicon_base64 TEXT,
  color_primary TEXT NOT NULL DEFAULT '#FECC00',
  color_secondary TEXT NOT NULL DEFAULT '#1F2937',
  color_accent TEXT NOT NULL DEFAULT '#3B82F6',
  color_background TEXT NOT NULL DEFAULT '#F9FAFB',
  color_text TEXT NOT NULL DEFAULT '#111827',
  color_link TEXT NOT NULL DEFAULT '#2563EB',
  color_success TEXT NOT NULL DEFAULT '#10B981',
  color_warning TEXT NOT NULL DEFAULT '#F59E0B',
  color_error TEXT NOT NULL DEFAULT '#EF4444',
  font_family_heading TEXT NOT NULL DEFAULT 'system-ui, -apple-system, sans-serif',
  font_family_body TEXT NOT NULL DEFAULT 'system-ui, -apple-system, sans-serif',
  footer_text TEXT DEFAULT 'Données fournies par le site source - Mise à jour hebdomadaire',
  footer_copyright TEXT DEFAULT '{site_name} © {year}',
  footer_links JSONB DEFAULT '[]'::jsonb,
  email_from_name TEXT DEFAULT 'Allo-Scrapper',
  email_header_color TEXT DEFAULT '#FECC00',
  email_footer_text TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id)
);
```

#### Extension table `users`
```sql
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user'));
UPDATE users SET role = 'admin' WHERE username = 'admin';
CREATE INDEX idx_users_role ON users(role);
```

### Backend (Express.js)

#### Nouveaux fichiers
- `server/src/db/settings-queries.ts` - Requêtes settings
- `server/src/db/user-queries.ts` - Requêtes users management
- `server/src/middleware/admin.ts` - Middleware requireAdmin
- `server/src/routes/settings.ts` - API settings
- `server/src/routes/users.ts` - API users management
- `server/src/services/theme-generator.ts` - Génération CSS dynamique
- `server/src/utils/image-validator.ts` - Validation images base64
- `server/src/types/settings.ts` - Types AppSettings
- `server/src/types/user.ts` - Types UserPublic, UserRole

#### Endpoints API

**Settings API :**
- `GET /api/settings` - Public (sans updatedBy)
- `PUT /api/settings` - Admin only
- `POST /api/settings/reset` - Admin only
- `POST /api/settings/logo` - Admin only
- `POST /api/settings/favicon` - Admin only
- `GET /api/settings/export` - Admin only (JSON download)
- `POST /api/settings/import` - Admin only (JSON upload)
- `GET /api/theme.css` - Public (CSS dynamique)

**Users API :**
- `GET /api/users` - Admin only
- `POST /api/users` - Admin only
- `DELETE /api/users/:id` - Admin only (avec guards)
- `PUT /api/users/:id/role` - Admin only
- `PUT /api/users/:id/reset-password` - Admin only

### Frontend (React)

#### Nouveaux fichiers

**Pages :**
- `client/src/pages/AdminPage.tsx` - Page admin avec tabs

**Composants Admin :**
- `client/src/components/admin/BrandingTab.tsx`
- `client/src/components/admin/UsersTab.tsx`
- `client/src/components/admin/SystemTab.tsx`
- `client/src/components/admin/TabNavigation.tsx`
- `client/src/components/admin/AdminGuard.tsx`
- `client/src/components/admin/ColorPicker.tsx`
- `client/src/components/admin/LogoUploader.tsx`
- `client/src/components/admin/FontSelector.tsx`
- `client/src/components/admin/FooterEditor.tsx`
- `client/src/components/admin/UserList.tsx`
- `client/src/components/admin/UserForm.tsx`
- `client/src/components/admin/UserEditModal.tsx`
- `client/src/components/admin/ConfigExport.tsx`
- `client/src/components/admin/ConfigImport.tsx`

**Composants UI :**
- `client/src/components/ui/Button.tsx`
- `client/src/components/ui/Input.tsx`
- `client/src/components/ui/Modal.tsx`
- `client/src/components/ui/ConfirmDialog.tsx`

**Hooks :**
- `client/src/hooks/useSettings.ts`
- `client/src/hooks/useUsers.ts`
- `client/src/hooks/useTheme.ts`

---

## 📝 TODO List - Implémentation par phases

### ✅ Phase 1 : Database Setup & Migrations

**Issue GitHub :** `#1` - `feat(db): add app_settings table for white-label branding`  
**Issue GitHub :** `#2` - `feat(db): add user roles system (admin/user)`  
**Branch :** `feature/white-label-db-setup`

- [ ] Créer migration `migrations/004_add_app_settings.sql`
  - [ ] Table avec singleton constraint
  - [ ] Valeurs par défaut
  - [ ] Tests singleton constraint
- [ ] Créer migration `migrations/005_add_user_roles.sql`
  - [ ] Ajouter colonne role
  - [ ] Promouvoir admin par défaut
  - [ ] Index sur role
  - [ ] Safety check au moins 1 admin
- [ ] Tests migrations
  - [ ] Test fresh DB
  - [ ] Test rollback
  - [ ] Vérifier valeurs par défaut
- [ ] Update `server/src/db/schema.ts`
  - [ ] Ajouter initialization app_settings
  - [ ] Tests unitaires schema init
- [ ] Commits
  - [ ] `feat(db): add app_settings table for white-label configuration`
  - [ ] `feat(db): add user roles system (admin/user)`
  - [ ] `test(db): add schema initialization tests`

---

### ✅ Phase 2 : Backend - Settings API (TDD)

**Issue GitHub :** `#3` - `feat(api): add settings management endpoints`  
**Branch :** `feature/settings-api`

- [ ] Créer types TypeScript
  - [ ] `server/src/types/settings.ts` (AppSettings, FooterLink, etc.)
  - [ ] `server/src/types/user.ts` (UserRole, UserPublic, etc.)
- [ ] TDD - Settings Queries
  - [ ] Écrire tests `server/src/db/settings-queries.test.ts`
  - [ ] Implémenter `server/src/db/settings-queries.ts`
    - [ ] getSettings()
    - [ ] updateSettings()
    - [ ] resetSettings()
    - [ ] exportSettings()
    - [ ] importSettings()
- [ ] TDD - Image Validator
  - [ ] Installer `sharp`: `cd server && npm install sharp @types/sharp`
  - [ ] Écrire tests `server/src/utils/image-validator.test.ts`
  - [ ] Implémenter `server/src/utils/image-validator.ts`
    - [ ] validateImageBase64()
    - [ ] compressImage()
    - [ ] validateImageDimensions()
- [ ] TDD - Settings Routes
  - [ ] Écrire tests `server/src/routes/settings.test.ts`
  - [ ] Implémenter `server/src/routes/settings.ts`
    - [ ] GET /api/settings (public)
    - [ ] PUT /api/settings (admin)
    - [ ] POST /api/settings/reset (admin)
    - [ ] POST /api/settings/logo (admin)
    - [ ] POST /api/settings/favicon (admin)
    - [ ] GET /api/settings/export (admin)
    - [ ] POST /api/settings/import (admin)
- [ ] Middleware Admin
  - [ ] Modifier `server/src/middleware/auth.ts` (ajouter role)
  - [ ] Créer `server/src/middleware/admin.ts`
  - [ ] Tests middleware requireAdmin
- [ ] Commits
  - [ ] `feat(api): add settings database queries`
  - [ ] `feat(api): add image validation and compression utility`
  - [ ] `feat(api): add settings management endpoints`
  - [ ] `feat(api): add admin role middleware`

---

### ✅ Phase 3 : Backend - Users Management API (TDD)

**Issue GitHub :** `#4` - `feat(api): add user management endpoints for admin`  
**Branch :** `feature/users-management-api`

- [ ] TDD - User Queries
  - [ ] Écrire tests `server/src/db/user-queries.test.ts`
  - [ ] Implémenter `server/src/db/user-queries.ts`
    - [ ] getAllUsers()
    - [ ] createUser()
    - [ ] deleteUser() (avec guards)
    - [ ] updateUserRole()
    - [ ] resetUserPassword()
    - [ ] getAdminCount()
- [ ] TDD - Users Routes
  - [ ] Écrire tests `server/src/routes/users.test.ts`
  - [ ] Implémenter `server/src/routes/users.ts`
    - [ ] GET /api/users (admin)
    - [ ] POST /api/users (admin)
    - [ ] DELETE /api/users/:id (admin, guards)
    - [ ] PUT /api/users/:id/role (admin)
    - [ ] PUT /api/users/:id/reset-password (admin)
- [ ] Modifier route auth/login
  - [ ] Inclure `role` dans JWT payload
  - [ ] Inclure `role` dans response
  - [ ] Tests login avec role
- [ ] Commits
  - [ ] `feat(api): add user management database queries`
  - [ ] `feat(api): add user management endpoints`
  - [ ] `feat(auth): include role in JWT payload and login response`

---

### ✅ Phase 4 : Backend - Theme CSS Generator

**Issue GitHub :** `#5` - `feat(api): add dynamic CSS theme generation`  
**Branch :** `feature/theme-css-generator`

- [ ] TDD - Theme Generator
  - [ ] Écrire tests `server/src/services/theme-generator.test.ts`
  - [ ] Implémenter `server/src/services/theme-generator.ts`
    - [ ] generateThemeCSS()
    - [ ] Google Fonts import si nécessaire
    - [ ] CSS variables :root
- [ ] Route /api/theme.css
  - [ ] Ajouter dans `server/src/app.ts`
  - [ ] Tests e2e /api/theme.css
  - [ ] Cache headers (1h)
- [ ] Commits
  - [ ] `feat(api): add dynamic CSS theme generator`
  - [ ] `feat(api): add /api/theme.css endpoint`

---

### ✅ Phase 5 : Backend - Integration & Docker

**Issue GitHub :** `#6` - `chore(backend): integrate all backend components`  
**Branch :** `feature/backend-integration`

- [ ] Enregistrer routes
  - [ ] Modifier `server/src/routes/index.ts`
  - [ ] Ajouter `/api/settings`
  - [ ] Ajouter `/api/users`
- [ ] Update types exports
  - [ ] Vérifier tous types exportés
- [ ] Docker build test
  - [ ] `docker compose build ics-web`
  - [ ] `docker compose up -d`
  - [ ] Vérifier migrations appliquées
- [ ] Tests end-to-end backend
  - [ ] `cd server && npm run test:run`
  - [ ] Vérifier coverage >= 80%
- [ ] Commits
  - [ ] `chore(backend): register settings and users routes`
  - [ ] `test(backend): verify Docker build succeeds`

---

### ✅ Phase 6 : Frontend - Setup & Hooks

**Issue GitHub :** `#7` - `feat(client): add settings and users API client`  
**Branch :** `feature/frontend-api-client`

- [ ] Types TypeScript
  - [ ] Ajouter dans `client/src/types/index.ts`
  - [ ] AppSettings, UserPublic, UserRole
- [ ] API Client
  - [ ] Modifier `client/src/api/client.ts`
  - [ ] Ajouter fonctions settings API
  - [ ] Ajouter fonctions users API
- [ ] Hook useSettings
  - [ ] Créer `client/src/hooks/useSettings.ts`
  - [ ] Tests `client/src/hooks/useSettings.test.ts`
- [ ] Hook useUsers
  - [ ] Créer `client/src/hooks/useUsers.ts`
  - [ ] Tests `client/src/hooks/useUsers.test.ts`
- [ ] Hook useTheme
  - [ ] Créer `client/src/hooks/useTheme.ts`
  - [ ] Applique CSS variables dynamiquement
- [ ] Commits
  - [ ] `feat(client): add settings and users TypeScript types`
  - [ ] `feat(client): add settings and users API client functions`
  - [ ] `feat(client): add useSettings hook`
  - [ ] `feat(client): add useUsers hook`
  - [ ] `feat(client): add useTheme hook for dynamic CSS`

---

### ✅ Phase 7 : Frontend - UI Components Library

**Issue GitHub :** `#8` - `feat(client): create reusable UI components`  
**Branch :** `feature/ui-components`

- [ ] Installer dépendances (optionnel)
  - [ ] `cd client && npm install react-colorful` (color picker)
  - [ ] `cd client && npm install react-easy-crop` (image crop)
- [ ] Composants de base
  - [ ] `client/src/components/ui/Button.tsx`
    - [ ] Variants: primary, secondary, danger
    - [ ] Tests unitaires
  - [ ] `client/src/components/ui/Input.tsx`
    - [ ] Label, error state
    - [ ] Tests unitaires
  - [ ] `client/src/components/ui/Modal.tsx`
    - [ ] Backdrop, close, animations
    - [ ] Tests unitaires
  - [ ] `client/src/components/ui/ConfirmDialog.tsx`
    - [ ] Dialog de confirmation
    - [ ] Tests unitaires
- [ ] Commits
  - [ ] `feat(client): add reusable Button component`
  - [ ] `feat(client): add reusable Input component`
  - [ ] `feat(client): add Modal and ConfirmDialog components`

---

### ✅ Phase 8 : Frontend - Admin Page Structure

**Issue GitHub :** `#9` - `feat(client): create admin panel page with tabs`  
**Branch :** `feature/admin-page-structure`

- [ ] Admin Guard
  - [ ] Créer `client/src/components/admin/AdminGuard.tsx`
  - [ ] Redirect si pas admin
  - [ ] Tests
- [ ] Tab Navigation
  - [ ] Créer `client/src/components/admin/TabNavigation.tsx`
  - [ ] Tests
- [ ] Admin Page
  - [ ] Créer `client/src/pages/AdminPage.tsx`
  - [ ] Structure avec 4 tabs (vides)
  - [ ] Tests
- [ ] Ajouter route
  - [ ] Modifier `client/src/App.tsx`
  - [ ] Route `/admin` avec ProtectedRoute + AdminGuard
- [ ] Lien Admin dans Layout
  - [ ] Modifier `client/src/components/Layout.tsx`
  - [ ] Ajouter lien "Admin" si user.role === 'admin'
  - [ ] Modifier AuthContext pour ajouter role
- [ ] Tests e2e
  - [ ] Test accès admin vs user
  - [ ] `e2e/admin-access.spec.ts`
- [ ] Commits
  - [ ] `feat(client): add AdminGuard component`
  - [ ] `feat(client): add TabNavigation component`
  - [ ] `feat(client): create admin panel page structure`
  - [ ] `feat(client): add admin route and navigation link`

---

### ✅ Phase 9 : Frontend - Branding Tab

**Issue GitHub :** `#10` - `feat(admin): implement branding customization UI`  
**Branch :** `feature/admin-branding-tab`

- [ ] Color Picker
  - [ ] Créer `client/src/components/admin/ColorPicker.tsx`
  - [ ] Preview + hex input
  - [ ] Tests
- [ ] Logo Uploader
  - [ ] Créer `client/src/components/admin/LogoUploader.tsx`
  - [ ] File upload → base64 conversion
  - [ ] Preview
  - [ ] Tests
- [ ] Font Selector
  - [ ] Créer `client/src/components/admin/FontSelector.tsx`
  - [ ] Liste Google Fonts + preview
  - [ ] Tests
- [ ] Footer Editor
  - [ ] Créer `client/src/components/admin/FooterEditor.tsx`
  - [ ] Gestion liens
  - [ ] Tests
- [ ] Branding Tab
  - [ ] Créer `client/src/components/admin/BrandingTab.tsx`
  - [ ] Formulaire complet
  - [ ] Live preview
  - [ ] Tests
- [ ] Tests e2e
  - [ ] `e2e/admin-branding.spec.ts`
  - [ ] Update site name
  - [ ] Upload logo
  - [ ] Change colors
- [ ] Commits
  - [ ] `feat(admin): add ColorPicker component`
  - [ ] `feat(admin): add LogoUploader component`
  - [ ] `feat(admin): add FontSelector component with Google Fonts`
  - [ ] `feat(admin): add FooterEditor component`
  - [ ] `feat(admin): implement branding tab with live preview`

---

### ✅ Phase 10 : Frontend - Users Tab

**Issue GitHub :** `#11` - `feat(admin): implement user management UI`  
**Branch :** `feature/admin-users-tab`

- [ ] User List
  - [ ] Créer `client/src/components/admin/UserList.tsx`
  - [ ] Tableau avec actions
  - [ ] Tests
- [ ] User Form
  - [ ] Créer `client/src/components/admin/UserForm.tsx`
  - [ ] Modal création
  - [ ] Tests
- [ ] User Edit Modal
  - [ ] Créer `client/src/components/admin/UserEditModal.tsx`
  - [ ] Édition role, reset password
  - [ ] Tests
- [ ] Users Tab
  - [ ] Créer `client/src/components/admin/UsersTab.tsx`
  - [ ] Intégration complète
  - [ ] Tests
- [ ] Tests e2e
  - [ ] `e2e/admin-users.spec.ts`
  - [ ] Create user
  - [ ] Change role
  - [ ] Delete user
  - [ ] Prevent delete last admin
- [ ] Commits
  - [ ] `feat(admin): add UserList component`
  - [ ] `feat(admin): add UserForm component`
  - [ ] `feat(admin): add UserEditModal component`
  - [ ] `feat(admin): implement users management tab`

---

### ⏳ Phase 11 : System Information & Diagnostics Dashboard

**Issue GitHub :** [`#231`](https://github.com/PhBassin/allo-scrapper/issues/231) - `feat(admin): add system information and diagnostics dashboard`  
**Branch :** `feature/admin-system-tab`  
**Statut :** ⏳ EN COURS (Export/Import déjà fait, reste System Info Dashboard)

**Ce qui est déjà fait ✅:**
- ✅ Config Export/Import : Implémenté dans `client/src/pages/admin/SettingsPage.tsx`

**À implémenter ⏳:**

#### Backend - Database Layer (TDD)

- [ ] **System Queries** (`server/src/db/system-queries.ts`)
  - [ ] Écrire tests `server/src/db/system-queries.test.ts`
  - [ ] Implémenter `getAppliedMigrations()` - Liste migrations depuis `schema_migrations`
  - [ ] Implémenter `getPendingMigrations()` - Comparer fichiers migrations avec DB
  - [ ] Implémenter `getDatabaseStats()` - Taille DB, nombre de tables, records par table
  - [ ] Tests : migrations appliquées, migrations pendantes, stats DB, edge cases

#### Backend - System Info Service (TDD)

- [ ] **System Info Service** (`server/src/services/system-info.ts`)
  - [ ] Écrire tests `server/src/services/system-info.test.ts`
  - [ ] Implémenter `getAppInfo()` - Version (package.json), buildDate, environment, nodeVersion
  - [ ] Implémenter `getServerHealth()` - Uptime, memoryUsage (heap/RSS), platform, arch
  - [ ] Implémenter `getScraperStatus()` - activeJobs, lastScrapeTime, totalCinemas
  - [ ] Tests : app info, server health, scraper status, memory formatting

#### Backend - System API Routes (TDD)

- [ ] **System Routes** (`server/src/routes/system.ts`)
  - [ ] Écrire tests `server/src/routes/system.test.ts`
  - [ ] Implémenter `GET /api/system/info` (admin only) - App + Server + Database info
  - [ ] Implémenter `GET /api/system/migrations` (admin only) - Applied + Pending migrations
  - [ ] Implémenter `GET /api/system/health` (admin only) - Health checks + status
  - [ ] Tests : tous endpoints, auth admin, gestion erreurs, 403/401
  - [ ] Enregistrer routes dans `server/src/app.ts`
  - [ ] Update `server/src/app.test.ts` avec tests routes system

#### Frontend - API Client

- [ ] **System API Client** (`client/src/api/system.ts`)
  - [ ] Créer types TypeScript (AppInfo, ServerHealth, Migration, DatabaseStats, etc.)
  - [ ] Implémenter `getSystemInfo(): Promise<SystemInfo>`
  - [ ] Implémenter `getMigrations(): Promise<MigrationsInfo>`
  - [ ] Implémenter `getHealth(): Promise<HealthStatus>`

#### Frontend - System Page Components

- [ ] **System Page** (`client/src/pages/admin/SystemPage.tsx`)
  - [ ] Créer page principale avec layout dashboard
  - [ ] Implémenter auto-refresh (30s pour health metrics)
  - [ ] Gestion états : loading, error, success
  - [ ] Tests `client/src/pages/admin/SystemPage.test.tsx`

- [ ] **App Info Card** (`client/src/components/admin/AppInfoCard.tsx`)
  - [ ] Afficher version, build date, environment, Node.js version
  - [ ] Badge pour environment (production/development)

- [ ] **Health Metrics Card** (`client/src/components/admin/HealthMetricsCard.tsx`)
  - [ ] Status indicator (✅ Healthy / ⚠️ Degraded / ❌ Error)
  - [ ] Database connection status
  - [ ] Migrations status (up-to-date ou pending)
  - [ ] Server uptime (formaté : "3 days, 2 hours")
  - [ ] Memory usage (progress bars heap/RSS)
  - [ ] Bouton refresh manuel
  - [ ] Last refresh timestamp

- [ ] **Database Stats Card** (`client/src/components/admin/DatabaseStatsCard.tsx`)
  - [ ] Taille DB (formatted MB/GB)
  - [ ] Nombre de tables
  - [ ] Records par table (Cinemas, Films, Seances)

- [ ] **Migrations Table** (`client/src/components/admin/MigrationsTable.tsx`)
  - [ ] Table : ID, Name, Status, Applied At
  - [ ] Status badges (✅ Applied / ⏳ Pending)
  - [ ] Sort par ID ou appliedAt
  - [ ] Warning banner si migrations pendantes
  - [ ] Tests `client/src/components/admin/MigrationsTable.test.tsx`

- [ ] **Config Management Section** (`client/src/components/admin/ConfigManagementSection.tsx`)
  - [ ] Refactoriser export/import depuis `SettingsPage.tsx`
  - [ ] Export button → download JSON
  - [ ] Import file picker → validate & import
  - [ ] Confirmation dialog avant import

#### Frontend - Routes & Navigation

- [ ] **Add Route** (`client/src/App.tsx`)
  - [ ] Ajouter route `/admin/system` avec ProtectedRoute + RequireAdmin

- [ ] **Add Navigation Link** (`client/src/components/Layout.tsx`)
  - [ ] Ajouter lien "System" dans admin dropdown menu

- [ ] **Refactor SettingsPage** (`client/src/pages/admin/SettingsPage.tsx`)
  - [ ] Retirer controls export/import
  - [ ] Pointer vers `/admin/system` pour export/import
  - [ ] Update tests

#### E2E Tests

- [ ] **E2E System Tests** (`e2e/admin-system.spec.ts`)
  - [ ] Test : Admin can view system information (app info, health, DB stats)
  - [ ] Test : Admin can view migrations list (applied + pending)
  - [ ] Test : Health status updates on refresh
  - [ ] Test : Admin can export configuration
  - [ ] Test : Admin can import configuration
  - [ ] Test : Non-admin cannot access system page (403)
  - [ ] Test : Unauthenticated user redirected to login

#### Docker & Integration

- [ ] **Docker Verification**
  - [ ] Build : `docker compose build`
  - [ ] Start : `docker compose up -d`
  - [ ] Vérifier `/admin/system` page loads
  - [ ] Vérifier system info displays correctement
  - [ ] Vérifier migrations list matches reality

#### Documentation

- [ ] **Update ADMIN_PANEL.md**
  - [ ] Section "System Information Tab"
  - [ ] Screenshots dashboard (optionnel)
  - [ ] Explication metrics
  - [ ] Migration status interpretation

- [ ] **Update API.md**
  - [ ] Documenter `GET /api/system/info`
  - [ ] Documenter `GET /api/system/migrations`
  - [ ] Documenter `GET /api/system/health`
  - [ ] Examples responses

- [ ] **Update WHITE_LABEL_PLAN.md**
  - [ ] Marquer Phase 11 comme ✅ COMPLETE

#### Commits (Conventional Commits)

**Backend:**
- [ ] `test(system): add database system queries tests`
- [ ] `feat(db): add system queries for migrations and stats`
- [ ] `test(system): add system info service tests`
- [ ] `feat(services): add system info and health service`
- [ ] `test(api): add system routes tests`
- [ ] `feat(api): add system information endpoints`
- [ ] `chore(api): register system routes in app`

**Frontend:**
- [ ] `feat(client): add system API client and types`
- [ ] `feat(admin): add AppInfoCard component`
- [ ] `feat(admin): add HealthMetricsCard component`
- [ ] `feat(admin): add DatabaseStatsCard component`
- [ ] `test(admin): add MigrationsTable tests`
- [ ] `feat(admin): add MigrationsTable component`
- [ ] `feat(admin): add ConfigManagementSection component`
- [ ] `refactor(admin): move export/import from SettingsPage to ConfigManagementSection`
- [ ] `feat(admin): create SystemPage with full dashboard`
- [ ] `feat(client): add /admin/system route and navigation`

**E2E & Documentation:**
- [ ] `test(e2e): add comprehensive system page tests`
- [ ] `docs: update ADMIN_PANEL.md with system tab documentation`
- [ ] `docs: update API.md with system endpoints`
- [ ] `docs: mark Phase 11 complete in WHITE_LABEL_PLAN.md`

#### Acceptance Criteria

Phase 11 est complète quand :
- ✅ Tous tests backend passent (`cd server && npm run test:run`)
- ✅ Tous tests frontend passent
- ✅ E2E tests passent (`npx playwright test admin-system.spec.ts`)
- ✅ Docker build réussit
- ✅ `/admin/system` page affiche toutes sections correctement
- ✅ System info updates on refresh (auto-refresh 30s)
- ✅ Migrations list montre status correct
- ✅ Config export/import fonctionne depuis System page
- ✅ Non-admin users ne peuvent pas accéder `/admin/system`
- ✅ Documentation à jour (ADMIN_PANEL.md, API.md)
- ✅ Test coverage >= 80% pour nouveau code

#### Estimation temporelle

- **Backend (TDD)** : 3-4h (DB queries 1h + System info 1h + API routes 1-2h)
- **Frontend** : 4-5h (API client 30min + Components 2-3h + SystemPage 1h + Refactor 30min)
- **E2E Tests** : 2h (Write 1h + Debug 1h)
- **Documentation** : 1h

**Total estimé : 10-12h de travail concentré**

---

### ✅ Phase 12 : Frontend - Apply Theme Globally

**Issue GitHub :** `#13` - `feat(client): apply branding settings across entire app`  
**Branch :** `feature/apply-theme-globally`

- [ ] Modifier Layout.tsx
  - [ ] Charger settings via useSettings()
  - [ ] Afficher logo si présent (au lieu de 🎬)
  - [ ] Footer dynamique
  - [ ] Utiliser siteName dynamique
- [ ] Appliquer thème
  - [ ] Utiliser useTheme() dans App.tsx
  - [ ] Charger /api/theme.css OU injecter CSS vars
- [ ] Dynamic page title
  - [ ] Modifier title avec settings.siteName
- [ ] Favicon dynamique
  - [ ] Injecter favicon via JS si settings.faviconBase64
- [ ] Tests e2e
  - [ ] `e2e/theme-application.spec.ts`
  - [ ] Vérifier branding appliqué
  - [ ] Vérifier favicon
- [ ] Commits
  - [ ] `feat(client): apply settings in Layout component`
  - [ ] `feat(client): apply theme CSS globally`
  - [ ] `feat(client): dynamic page title and favicon`

---

### ✅ Phase 13 : Documentation & Docker

**Issue GitHub :** `#14` - `docs: update README and API docs with admin panel`  
**Issue GitHub :** `#15` - `chore(docker): verify Docker build and deployment`  
**Branch :** `feature/docs-and-docker`

- [ ] Update README.md
  - [ ] Section "Admin Panel"
  - [ ] Screenshots (optionnel)
  - [ ] Credentials par défaut
  - [ ] Instructions export/import
- [ ] Update API.md
  - [ ] Documenter `/api/settings` endpoints
  - [ ] Documenter `/api/users` endpoints
  - [ ] Documenter `/api/theme.css`
- [ ] Docker build test
  - [ ] `docker compose build`
  - [ ] `docker compose up -d`
  - [ ] Vérifier migrations appliquées
  - [ ] Vérifier admin panel accessible
- [ ] Update AGENTS.md
  - [ ] Ajouter sections admin panel
  - [ ] Workflow branding customization
- [ ] Commits
  - [ ] `docs: update README with admin panel documentation`
  - [ ] `docs: update API.md with settings and users endpoints`
  - [ ] `chore(docker): verify full stack build`

---

### ✅ Phase 14 : E2E Tests Complets

**Issue GitHub :** `#16` - `test(e2e): add comprehensive admin panel tests`  
**Branch :** `feature/e2e-tests`

- [ ] Test workflow complet
  - [ ] Login admin
  - [ ] Customiser branding
  - [ ] Créer utilisateur
  - [ ] Login avec nouveau user
  - [ ] Vérifier thème appliqué
  - [ ] Export config
  - [ ] Reset branding
  - [ ] Import config
- [ ] Run integration test script
  - [ ] `./scripts/integration-test.sh`
  - [ ] Vérifier tous tests passent
- [ ] Commits
  - [ ] `test(e2e): add comprehensive admin workflow tests`

---

## ✅ Checklist finale avant merge (Statut au 01/03/2026)

**Phases 1-10, 12-14 (Complètes) :**
- ✅ Toutes les migrations SQL testées et documentées (migrations 004-007)
- ✅ Tests unitaires backend >= 80% coverage (2,380 lignes de tests white-label)
- ✅ Tests unitaires frontend >= 70% coverage (UsersPage + composants admin testés)
- ✅ Tests e2e passent (`./scripts/integration-test.sh`) - 664 lignes E2E tests
- ✅ Docker build réussit (vérifié dans PRs #229, #230)
- ✅ Documentation à jour (ADMIN_PANEL.md 601 lignes, API.md, AGENTS.md)
- ✅ Aucun secret committé (.env, tokens)
- ✅ Conventional Commits respectés (tous PRs)
- ✅ Issues GitHub fermées avec "Closes #X" (#194-#230)
- ✅ PR créées et reviewées (#198-#230, tous merged)

**Phase 11 (En cours - Issue #231) :**
- ⏳ System Info Dashboard à implémenter
- ⏳ Migrations Viewer à implémenter
- ⏳ Health Metrics à implémenter
- ⏳ E2E tests pour system page
- ⏳ Documentation API.md et ADMIN_PANEL.md à compléter

**Une fois Phase 11 terminée → White-Label 100% complet ! 🎉**

---

## 📊 Estimation temporelle

- **Phases 1-5 (Backend)** : 4-5 jours
- **Phases 6-12 (Frontend)** : 5-6 jours
- **Phases 13-14 (Docs + E2E)** : 1-2 jours

**Total estimé : 10-13 jours** avec TDD rigoureux, tests complets, et documentation.

---

## ⚠️ Points d'attention

1. **Singleton settings** : Utiliser `ON CONFLICT (id) DO UPDATE` pour éviter duplications
2. **Validation images** : 
   - Logo : max 200KB, formats png/jpg/svg, min 100x100px
   - Favicon : max 50KB, formats ico/png, 32x32px ou 64x64px
   - Compression automatique si dépassement
3. **Sécurité** : Middleware `requireAdmin` sur toutes routes sensibles
4. **Performance** : Cache `/api/theme.css` avec ETags (1h)
5. **UX** : Live preview du thème sans recharger page
6. **Rollback** : Bouton "Réinitialiser" pour revenir aux valeurs par défaut
7. **i18n** : Structure prête pour traductions futures
8. **Google Fonts** : Liste prédéfinie de ~20 fonts populaires

---

## 🚀 Google Fonts recommandées

- Inter
- Roboto
- Open Sans
- Lato
- Montserrat
- Poppins
- Raleway
- Nunito
- PT Sans
- Source Sans Pro
- Work Sans
- Archivo
- Manrope
- DM Sans
- Plus Jakarta Sans

---

## 📚 Ressources

- [Documentation migrations](./migrations/README.md)
- [Documentation AGENTS.md](./AGENTS.md)
- [Guide TDD](./TESTING.md)
- [API Documentation](./API.md)
- [Admin Panel User Guide](./ADMIN_PANEL.md)
- [Issue #231 - System Tab](https://github.com/PhBassin/allo-scrapper/issues/231)

---

## 🚀 Quick Start - Phase 11 Implementation

Pour implémenter Phase 11 (System Tab), suivre l'ordre TDD :

### 1. Backend (TDD - ~3-4h)

```bash
# Create feature branch
git checkout -b feature/admin-system-tab

# 1. Database queries
# Write tests first
touch server/src/db/system-queries.test.ts
# Implement
touch server/src/db/system-queries.ts

# 2. System info service
# Write tests first
touch server/src/services/system-info.test.ts
# Implement
touch server/src/services/system-info.ts

# 3. API routes
# Write tests first
touch server/src/routes/system.test.ts
# Implement
touch server/src/routes/system.ts
# Register in app.ts

# Run all tests
cd server && npm run test:run
cd server && npm run test:coverage
```

### 2. Frontend (~4-5h)

```bash
# 1. API client
touch client/src/api/system.ts

# 2. Components
touch client/src/components/admin/AppInfoCard.tsx
touch client/src/components/admin/HealthMetricsCard.tsx
touch client/src/components/admin/DatabaseStatsCard.tsx
touch client/src/components/admin/MigrationsTable.tsx
touch client/src/components/admin/MigrationsTable.test.tsx
touch client/src/components/admin/ConfigManagementSection.tsx

# 3. System page
touch client/src/pages/admin/SystemPage.tsx
touch client/src/pages/admin/SystemPage.test.tsx

# 4. Update routes (App.tsx) and navigation (Layout.tsx)
# 5. Refactor SettingsPage (remove export/import controls)
```

### 3. E2E Tests (~2h)

```bash
touch e2e/admin-system.spec.ts
npx playwright test admin-system.spec.ts
```

### 4. Verify & Document (~1h)

```bash
# Docker build
docker compose build
docker compose up -d

# Update docs
# - ADMIN_PANEL.md (System tab section)
# - API.md (/api/system/* endpoints)
# - WHITE_LABEL_PLAN.md (mark Phase 11 complete)
```

### 5. Create PR

```bash
git push -u origin feature/admin-system-tab
gh pr create --title "feat(admin): add system information and diagnostics dashboard" \
  --body "Closes #231"
```

**Estimated total: 10-12 hours focused work**
