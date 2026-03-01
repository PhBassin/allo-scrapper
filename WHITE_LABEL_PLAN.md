# 🎨 Plan d'implémentation : Système de Marque Blanche

**Date de création :** 01/03/2026  
**Objectif :** Transformer Allo-Scrapper en plateforme marque blanche avec personnalisation avancée + gestion complète des utilisateurs

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

### ✅ Phase 11 : Frontend - System Tab & Export/Import

**Issue GitHub :** `#12` - `feat(admin): implement system info and config export/import`  
**Branch :** `feature/admin-system-tab`

- [ ] Config Export
  - [ ] Créer `client/src/components/admin/ConfigExport.tsx`
  - [ ] Download JSON
  - [ ] Tests
- [ ] Config Import
  - [ ] Créer `client/src/components/admin/ConfigImport.tsx`
  - [ ] Upload JSON avec validation
  - [ ] Tests
- [ ] System Tab
  - [ ] Créer `client/src/components/admin/SystemTab.tsx`
  - [ ] Info système
  - [ ] Migrations list
  - [ ] Tests
- [ ] Tests e2e
  - [ ] `e2e/admin-config.spec.ts`
  - [ ] Export config
  - [ ] Import config
- [ ] Commits
  - [ ] `feat(admin): add configuration export functionality`
  - [ ] `feat(admin): add configuration import with validation`
  - [ ] `feat(admin): implement system tab with info and config management`

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

## ✅ Checklist finale avant merge

- [ ] Toutes les migrations SQL testées et documentées
- [ ] Tests unitaires backend >= 80% coverage
- [ ] Tests unitaires frontend >= 70% coverage
- [ ] Tests e2e passent (`./scripts/integration-test.sh`)
- [ ] Docker build réussit
- [ ] Documentation à jour (README, API.md, AGENTS.md)
- [ ] Aucun secret committé (.env, tokens)
- [ ] Conventional Commits respectés
- [ ] Issues GitHub fermées avec "Closes #X"
- [ ] PR créées et reviewées

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
