# AI Agent Instructions

This document provides instructions for AI coding agents (Claude, GitHub Copilot, Cursor, etc.) working on this project.

---

## Project Overview

**Allo-Scrapper** is a cinema showtimes aggregator that:
- Scrapes movie screening schedules from external cinema websites
- Stores data in PostgreSQL
- Exposes a REST API (Express.js + TypeScript)
- Provides a React frontend

---

## MANDATORY Workflow

**You MUST follow this workflow for every task:**

```
1. ISSUE     → Verify or create a GitHub issue
2. BRANCH    → Create a new feature branch from develop
3. PLAN      → Break down into atomic tasks
4. TDD       → Write tests BEFORE code
5. IMPLEMENT → Minimal code to pass tests
6. DOCKER    → Verify Docker build succeeds
7. COMMIT    → Atomic commits with Conventional Commits format
8. E2E       → Run integration tests (E2E) if frontend changes
9. DOCS      → Update README if API/features change
10. PR       → Open Pull Request referencing the issue
11. REVIEW   → Wait for review/approval before merging
12. CLEANUP  → Switch back to develop and pull latest changes after PR is merged
```

---

## Step 1: Issue First

**CRITICAL: Every PR MUST be linked to an issue. No exceptions.**

Before writing any code:

1. **Search for existing issues** related to the task
2. **Create an issue** if none exists using the appropriate template:
   - `bug_report` - For bugs
   - `feature_request` - For new features
   - `task` - For technical tasks/chores
3. **Note the issue number** - you will need it for commits and the PR

**Command to search issues:**
```bash
gh issue list --state open
gh issue list --state all --search "keyword"
gh issue view <number>
```

**Command to create issue:**
```bash
# Bug
gh issue create --title "fix: description" --body "Details..." --label bug

# Feature
gh issue create --title "feat: description" --body "Details..." --label enhancement

# Task
gh issue create --title "chore: description" --body "Details..." --label task
```

**Important:** Always verify the issue exists before creating a PR. If you reference a non-existent issue, the PR will not be properly linked.

---

## Step 2: Plan

Before implementation:

1. **Break down** the task into atomic, testable units
2. **Identify files** that will be modified
3. **List tests** that need to be written
4. **Consider edge cases** and error scenarios

Document your plan before proceeding.

---

## Step 3: Test-Driven Development (TDD)

**CRITICAL: Write tests BEFORE implementation.**

### TDD Cycle

```
1. RED    → Write a failing test for the expected behavior
2. GREEN  → Write minimal code to make the test pass
3. REFACTOR → Improve code while keeping tests green
4. REPEAT
```

### Test Commands

```bash
cd server

# Watch mode (recommended during development)
npm test

# Single run
npm run test:run

# With coverage report
npm run test:coverage
```

### Coverage Targets

- Lines: >= 80%
- Functions: >= 80%
- Statements: >= 80%
- Branches: >= 65%

### Test File Locations

```
server/src/services/scraper/theater-parser.test.ts  # Parser tests
server/src/utils/date.test.ts                       # Utility tests
server/tests/fixtures/                              # HTML fixtures
```

### Adding Test Fixtures

For scraper tests, use real HTML fixtures:
```bash
# Fetch HTML for a cinema
curl "https://www.example-cinema-site.com/seance/salle_gen_csalle=CXXXX.html" \
  -o server/tests/fixtures/cinema-cxxxx-page.html
```

---

## Step 4: Implement

After tests are written:

1. Write **minimal code** to pass the failing tests
2. Run tests frequently: `npm test`
3. Ensure all tests pass before committing

---

## Step 5: Verify Docker Build

**Before committing, verify the Docker build succeeds.**

```bash
docker compose build
```

If the build fails, fix the issue before proceeding to commit.

---

## Step 7: Atomic Commits

**Each commit = one logical, self-contained change.**

### Conventional Commits Format

```
<type>(<scope>): <description>

[optional body]

[optional footer: refs #123]
```

### Commit Types

| Type | Use Case |
|------|----------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Adding/updating tests |
| `chore` | Maintenance (deps, config) |
| `refactor` | Code refactoring |
| `style` | Formatting changes |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |
| `build` | Build system changes |

### Scopes

| Scope | Area |
|-------|------|
| `scraper` | Scraping service |
| `api` | REST API |
| `db` | Database |
| `parser` | HTML parsing |
| `client` | React frontend |
| `docker` | Docker/deployment |
| `observability` | Logging, metrics, tracing |

### Commit Examples

```bash
# Test commit (do this FIRST)
git commit -m "test(parser): add test for cinema with special characters"

# Implementation commit
git commit -m "feat(parser): handle cinema names with special characters

refs #45"

# Bug fix with issue close
git commit -m "fix(api): return 404 for unknown cinema IDs

closes #42"
```

### Commit Order

For a typical feature:
1. `test(scope): add test for <feature>`
2. `feat(scope): implement <feature>`
3. `docs: update README with <feature>` (if applicable)

---

## Step 8: Integration Testing (E2E)

**When frontend changes are made, run E2E tests to verify end-to-end functionality.**

### What Requires E2E Testing

Run Playwright E2E tests when you modify:
- React components that interact with the backend API
- User workflows (button clicks, form submissions, navigation)
- Real-time features (SSE, WebSockets, live updates)
- Critical user paths (scraping, viewing schedules, reports)

### E2E Test Commands

```bash
# Full integration test (starts Docker, runs tests, cleans up)
./scripts/integration-test.sh

# Or manually:
# 1. Ensure Docker is running
docker compose up --build -d

# 2. Wait for services to be ready
sleep 10

# 3. Run Playwright tests
npx playwright test

# 4. View test report (if failures)
npx playwright show-report
```

### E2E Test Guidelines

1. **Use real scrapes, not mocks** - Integration tests verify actual backend behavior
2. **Run tests sequentially** - Config already set to `workers: 1` to avoid scrape conflicts
3. **Use data-testid selectors** - More stable than text-based selectors
4. **Handle timing** - Scrapes may complete quickly; use appropriate timeouts
5. **Clean state** - Restart Docker between test sessions if needed: `docker compose restart web`

### Known Limitations

- Scrapes complete quickly in Docker, so some timing-sensitive tests may need adjustments
- Tests work best when run individually or after a clean Docker restart
- If tests interfere with each other, restart services: `docker compose restart web`

### Test Locations

```
e2e/                        # Playwright E2E tests
├── scrape-progress.spec.ts # Progress window tests
└── ...                     # Future E2E tests

playwright.config.ts        # Playwright configuration
scripts/integration-test.sh # Automated full-stack test script
```

---

## Step 9: Documentation

### Update README.md When:

- Adding new API endpoints
- Changing environment variables
- Modifying database schema
- Adding user-facing features

### Update DEPLOYMENT.md When:

- Changing Docker configuration
- Modifying deployment process

---

## Step 10: Pull Request

### Create PR

```bash
# Push branch
git push -u origin feature/your-feature

# Create PR
gh pr create --title "feat(scope): description" --body "## Summary
- Change 1
- Change 2

Closes #<issue-number>"
```

### PR Checklist

Before requesting review:
- [ ] All tests pass (`npm run test:run`)
- [ ] Code coverage maintained
- [ ] Conventional Commits used
- [ ] Documentation updated (if applicable)
- [ ] Issue referenced in PR

---

## Project Structure

```
allo-scrapper/
├── server/                     # Express.js backend
│   ├── src/
│   │   ├── config/             # Configuration (cinemas.json)
│   │   ├── db/                 # Database queries and schema
│   │   ├── routes/             # API route handlers
│   │   ├── services/
│   │   │   ├── scraper/        # In-process scraping logic (legacy mode)
│   │   │   │   ├── index.ts        # Orchestrator
│   │   │   │   ├── theater-parser.ts   # HTML parsing
│   │   │   │   └── http-client.ts      # HTTP requests
│   │   │   ├── redis-client.ts  # Redis job publisher (USE_REDIS_SCRAPER mode)
│   │   │   ├── scrape-manager.ts# Scrape session management
│   │   │   └── progress-tracker.ts  # SSE event system
│   │   ├── types/              # TypeScript definitions
│   │   └── utils/
│   │       ├── logger.ts       # Winston structured logger (service=ics-web)
│   │       └── date.ts         # Date utilities
│   └── tests/
│       └── fixtures/           # Test HTML files
├── scraper/                    # Standalone scraper microservice
│   ├── src/
│   │   ├── db/                 # Direct DB access (same schema)
│   │   ├── redis/              # RedisJobConsumer + RedisProgressPublisher
│   │   ├── scraper/            # Scraping logic (mirrors server/services/scraper)
│   │   ├── types/
│   │   └── utils/
│   │       ├── logger.ts       # Winston logger (service=ics-scraper)
│   │       ├── metrics.ts      # prom-client metrics (port 9091)
│   │       └── tracer.ts       # OpenTelemetry OTLP tracer
│   └── tests/unit/
├── client/                     # React frontend
├── docker/                     # Docker/monitoring configuration
│   ├── grafana/
│   │   ├── datasources/        # Auto-provisioned datasources (Prometheus, Loki, Tempo)
│   │   └── dashboards/         # Auto-provisioned dashboards
│   ├── loki-config.yml
│   ├── promtail-config.yml
│   ├── prometheus.yml
│   └── tempo.yml
├── e2e/                        # Playwright E2E tests
├── .github/                    # GitHub config (issues, workflows)
├── MONITORING.md               # Observability stack documentation
├── CONTRIBUTING.md             # Human contributor guide
└── AGENTS.md                   # This file
```

---

## Useful Commands

### Setup (run once after cloning)

```bash
# Install git hooks (pre-push: tsc + tests)
./scripts/install-hooks.sh
```

### Development

```bash
# Start dev environment
npm run dev

# Run server tests
cd server && npm test

# Run single test file
cd server && npx vitest run src/services/scraper/theater-parser.test.ts

# Check test coverage
cd server && npm run test:coverage

# Manual pre-push check (same as the hook)
cd server && npx tsc --noEmit && npm run test:run

# Run scraper microservice tests
cd scraper && npm test
```

### Docker

```bash
# Build all images
docker compose build

# Start base stack (app + DB + Redis)
docker compose up -d

# Start with scraper microservice
docker compose --profile scraper up -d

# Start with full monitoring (Prometheus, Grafana, Loki, Tempo)
docker compose --profile monitoring up -d

# Start everything
docker compose --profile monitoring --profile scraper up -d
```

### Git

```bash
# Check status
git status

# View recent commits
git log --oneline -10

# Create feature branch
git checkout -b feature/your-feature develop

# Amend last commit (before push only)
git commit --amend
```

### GitHub CLI

```bash
# List open issues
gh issue list

# View issue details
gh issue view 42

# Create issue
gh issue create

# Create PR
gh pr create

# View PR checks
gh pr checks
```

---

## Common Patterns

### Adding a New Cinema

**Recommended workflow: API-first, then git commit.**

The `server/src/config/` directory is volume-mounted in Docker, so changes made via the API are immediately visible on the host filesystem and can be committed to git.

**Step 1 — Add via API** (smart URL-based add with auto-scrape):
```bash
curl -X POST http://localhost:3000/api/cinemas \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html"}'
```
This extracts the cinema ID, scrapes metadata and showtimes, and updates both the database and `server/src/config/cinemas.json`.

**Step 2 — Verify the change is visible on host:**
```bash
cat server/src/config/cinemas.json
git status
# → modified: server/src/config/cinemas.json
git diff server/src/config/cinemas.json
```

**Step 3 — Commit and push** (Conventional Commits format):
```bash
git add server/src/config/cinemas.json
git commit -m "feat(cinema): add <cinema name> (CXXXX)"
git push
```

**Alternative — Manual edit** (development/testing only):
1. Edit `server/src/config/cinemas.json` directly on the host
2. Restart: `docker compose restart ics-web`
3. Resync DB from JSON: `curl http://localhost:3000/api/cinemas/sync`
4. Commit: `git add server/src/config/cinemas.json && git commit -m "feat(cinema): add <cinema>"`

**For parser changes** (write tests before adding the cinema):
1. Fetch HTML fixture for tests
2. Write parser tests with the fixture
3. Verify existing tests still pass
4. Then add cinema via API and follow the git workflow above
5. Test commit: `test(parser): add tests for <cinema> (CXXXX)`
6. Cinema commit: `feat(cinema): add <cinema> (CXXXX)`

### Fixing a Parser Bug

1. Create failing test that reproduces the bug
2. Fix the parser code
3. Verify test passes
4. Commit: `fix(parser): <description>`

### Adding API Endpoint

1. Write test for expected behavior
2. Add route handler
3. Update README API documentation
4. Commit: `feat(api): add <endpoint>`

---

## White-Label System

The white-label branding system allows complete customization of the application's appearance and branding through an admin panel and REST API.

### System Overview

**Components:**
- **Backend**: Settings and user management APIs with role-based access
- **Frontend**: Admin panel UI with 5 tabs (General, Colors, Typography, Footer, Email)
- **Database**: `app_settings` table (singleton) and `users` table with roles
- **Theme**: Dynamic CSS generation from settings

### Architecture

```
Admin Panel (React)
    ↓
Settings Context
    ↓
Settings API (/api/settings/*)
    ↓
settings-queries.ts
    ↓
PostgreSQL (app_settings table)
    ↓
Theme Generator (/api/theme.css)
    ↓
Frontend (CSS variables applied)
```

### Backend Components

#### Database Layer

**Location**: `server/src/db/`

- **settings-queries.ts**: Settings CRUD operations
  - `getPublicSettings()` - Public settings (no auth)
  - `getAdminSettings()` - Full settings (admin only)
  - `updateSettings()` - Update with validation
  - `resetSettings()` - Restore defaults
  - `exportSettings()` - JSON backup
  - `importSettings()` - Restore from JSON
  - **Tests**: `settings-queries.test.ts` (394 lines)

- **user-queries.ts**: User management operations
  - `getAllUsers()` - List users with pagination
  - `getUserById()` - Get single user
  - `createUser()` - Create with role and hashed password
  - `updateUserRole()` - Change admin/user role
  - `resetUserPassword()` - Generate secure random password
  - `deleteUser()` - Delete with safety guards
  - `getAdminCount()` - Count admins (prevents last admin deletion)
  - **Tests**: `user-queries.test.ts`

**Schema**:
- **app_settings table**: Singleton (id=1), stores all branding config
- **users table**: Extended with `role` column (`admin` | `user`)

#### API Routes

**Location**: `server/src/routes/`

- **settings.ts** (Settings API):
  - `GET /api/settings` - Public settings (no auth)
  - `GET /api/settings/admin` - Full settings (admin only)
  - `PUT /api/settings` - Update settings (admin only)
  - `POST /api/settings/reset` - Reset to defaults (admin only)
  - `GET /api/settings/export` - Export JSON (admin only)
  - `POST /api/settings/import` - Import JSON (admin only)
  - **Tests**: `settings.test.ts`

- **users.ts** (User Management API):
  - `GET /api/users` - List users with pagination (admin only)
  - `GET /api/users/:id` - Get user by ID (admin only)
  - `POST /api/users` - Create user (admin only)
  - `PUT /api/users/:id/role` - Update role (admin only)
  - `POST /api/users/:id/reset-password` - Reset password (admin only)
  - `DELETE /api/users/:id` - Delete user (admin only)
  - **Safety guards**: Prevent last admin deletion, self-deletion
  - **Tests**: `users.test.ts`

#### Services

**Location**: `server/src/services/`

- **theme-generator.ts**: Dynamic CSS generation
  - `extractGoogleFont()` - Detect Google Fonts vs system fonts
  - `generateGoogleFontsImport()` - Generate @import for fonts
  - `generateCSSVariables()` - Generate CSS custom properties
  - `generateThemeCSS()` - Complete CSS with fonts + variables
  - **Tests**: `theme-generator.test.ts` (429 lines)

**Endpoint**: `GET /api/theme.css` (public, cached with ETag)

#### Middleware

**Location**: `server/src/middleware/`

- **admin.ts**: Admin role enforcement
  - `requireAdmin()` - Middleware for admin-only routes
  - Checks JWT auth + queries user role from database
  - Returns 403 if not admin

#### Types

**Location**: `server/src/types/`

- **settings.ts**: AppSettings, AppSettingsPublic, FooterLink
- **user.ts**: UserRole, UserPublic, User

#### Utilities

**Location**: `server/src/utils/`

- **image-validator.ts**: Base64 image validation
  - Logo: Max 200KB, PNG/JPG/SVG, min 100x100px
  - Favicon: Max 50KB, ICO/PNG, 32x32 or 64x64px
  - Compression with sharp library

### Frontend Components

#### Admin Settings Page

**Location**: `client/src/pages/admin/SettingsPage.tsx`

**Features**:
- Tabbed interface (General, Colors, Typography, Footer, Email)
- Form state management with change tracking
- Save/Reset/Export/Import controls
- Loading states and error handling

#### Admin UI Components

**Location**: `client/src/components/admin/`

- **ColorPicker.tsx**: Color input with hex validation and live preview
- **FontSelector.tsx**: Google Fonts dropdown with preview
- **ImageUpload.tsx**: Drag-and-drop base64 image upload with size validation
- **FooterLinksEditor.tsx**: Dynamic array editor for footer links

#### Contexts

**Location**: `client/src/contexts/`

- **SettingsContext.tsx**:
  - Manages public and admin settings state
  - Provides: `refreshPublicSettings()`, `refreshAdminSettings()`, `updateSettings()`
  - Auto-loads public settings on mount

#### API Client

**Location**: `client/src/api/`

- **settings.ts**: Complete settings API client
  - Types: `AppSettings`, `AppSettingsPublic`, `AppSettingsUpdate`, `AppSettingsExport`
  - Functions: `getPublicSettings()`, `getAdminSettings()`, `updateSettings()`, `resetSettings()`, `exportSettings()`, `importSettings()`

#### Route Protection

**Location**: `client/src/components/`

- **RequireAdmin.tsx**: Route guard for admin-only pages

### Making Changes to Settings Schema

Follow these steps when adding new settings fields:

#### 1. Database Migration

```sql
-- migrations/004_add_app_settings.sql
ALTER TABLE app_settings ADD COLUMN new_field TEXT DEFAULT 'default_value';
```

#### 2. Update TypeScript Types

```typescript
// server/src/types/settings.ts
export interface AppSettings {
  // ... existing fields
  new_field: string;
}

// client/src/api/settings.ts
export interface AppSettings {
  // ... existing fields
  new_field: string;
}
```

#### 3. Update Backend Queries

```typescript
// server/src/db/settings-queries.ts
export async function getPublicSettings(): Promise<AppSettingsPublic> {
  const result = await pool.query(
    `SELECT id, site_name, ..., new_field FROM app_settings WHERE id = 1`
  );
  // ...
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  // Add new_field to SET clause if provided
  if (updates.new_field !== undefined) {
    setClauses.push(`new_field = $${paramIndex++}`);
    values.push(updates.new_field);
  }
  // ...
}
```

#### 4. Update Frontend UI

```tsx
// client/src/pages/admin/SettingsPage.tsx
const [formData, setFormData] = useState({
  // ... existing fields
  new_field: adminSettings?.new_field || '',
});

// Add input in appropriate tab:
<Input
  label="New Field"
  value={formData.new_field}
  onChange={(e) => setFormData({ ...formData, new_field: e.target.value })}
/>
```

#### 5. Write Tests

```typescript
// server/src/db/settings-queries.test.ts
test('updates new_field', async () => {
  const updated = await updateSettings({ new_field: 'test value' });
  expect(updated.new_field).toBe('test value');
});

// server/src/routes/settings.test.ts
test('PUT /api/settings updates new_field', async () => {
  const res = await request(app)
    .put('/api/settings')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ new_field: 'test' })
    .expect(200);
  expect(res.body.data.new_field).toBe('test');
});
```

#### 6. Update Theme Generator (if CSS-related)

```typescript
// server/src/services/theme-generator.ts
export function generateThemeCSS(settings: AppSettingsPublic): string {
  return `
    :root {
      --new-field: ${settings.new_field};
    }
  `;
}
```

#### 7. Commit Sequence

```bash
# 1. Database migration
git commit -m "feat(db): add new_field to app_settings table"

# 2. Backend types and queries
git commit -m "feat(api): add new_field to settings API"

# 3. Frontend UI
git commit -m "feat(admin): add new_field to settings panel"

# 4. Tests
git commit -m "test(settings): add tests for new_field"
```

### Adding New Admin Features

Example: Adding a new admin panel tab.

#### 1. Create Tab Component

```tsx
// client/src/components/admin/NewFeatureTab.tsx
export function NewFeatureTab() {
  const { adminSettings, updateSettings } = useContext(SettingsContext);
  
  return (
    <div>
      <h2>New Feature</h2>
      {/* Form controls */}
    </div>
  );
}
```

#### 2. Add to Settings Page

```tsx
// client/src/pages/admin/SettingsPage.tsx
import { NewFeatureTab } from '../components/admin/NewFeatureTab';

const tabs = [
  { id: 'general', label: 'General', component: GeneralTab },
  // ... existing tabs
  { id: 'new-feature', label: 'New Feature', component: NewFeatureTab },
];
```

#### 3. Add Backend Endpoint (if needed)

```typescript
// server/src/routes/settings.ts
router.post('/new-feature', requireAuth, requireAdmin, async (req, res) => {
  // Handle new feature logic
});
```

#### 4. Write Tests

```typescript
// client/src/pages/admin/SettingsPage.test.tsx
test('renders new feature tab', () => {
  render(<SettingsPage />);
  expect(screen.getByText('New Feature')).toBeInTheDocument();
});
```

### Common Patterns

#### Accessing Settings in Backend

```typescript
// Any route handler
import { getPublicSettings } from '../db/settings-queries';

const settings = await getPublicSettings();
console.log(settings.site_name); // "My Cinema Portal"
```

#### Accessing Settings in Frontend

```tsx
// Any React component
import { useContext } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';

function MyComponent() {
  const { publicSettings } = useContext(SettingsContext);
  
  return <h1>{publicSettings?.site_name}</h1>;
}
```

#### Updating Settings

```tsx
// Admin component
import { useContext } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';

function AdminComponent() {
  const { updateSettings } = useContext(SettingsContext);
  
  const handleSave = async () => {
    await updateSettings({ site_name: 'New Name' });
  };
}
```

### Testing White-Label Features

#### Unit Tests

```bash
# Backend tests
cd server
npm run test:run settings-queries.test.ts
npm run test:run settings.test.ts
npm run test:run user-queries.test.ts
npm run test:run users.test.ts
npm run test:run theme-generator.test.ts

# Check coverage
npm run test:coverage
```

#### E2E Tests

```bash
# Run Playwright tests
npx playwright test admin-*.spec.ts
```

**E2E test locations** (to be created):
- `e2e/admin-access.spec.ts` - Admin vs user access
- `e2e/admin-branding.spec.ts` - Branding customization
- `e2e/admin-users.spec.ts` - User management
- `e2e/theme-application.spec.ts` - Theme applied globally

### Troubleshooting

#### Settings Not Saving

1. Check admin authentication:
   ```bash
   # Login and check role
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin"}'
   # Response should include: "role": "admin"
   ```

2. Check database:
   ```bash
   docker compose exec ics-db psql -U postgres -d ics
   SELECT * FROM app_settings;
   ```

3. Check backend logs:
   ```bash
   docker compose logs ics-web | grep -i error
   ```

#### Theme Not Applying

1. Check `/api/theme.css` endpoint:
   ```bash
   curl http://localhost:3000/api/theme.css
   ```

2. Verify settings are public:
   ```bash
   curl http://localhost:3000/api/settings
   ```

3. Clear browser cache and hard refresh (Ctrl+F5)

#### Role Not Working

1. Check user role in database:
   ```bash
   docker compose exec ics-db psql -U postgres -d ics
   SELECT id, username, role FROM users;
   ```

2. Update role manually if needed:
   ```bash
   UPDATE users SET role = 'admin' WHERE username = 'admin';
   ```

### Related Documentation

- **User Guide**: [Admin Panel Guide](../guides/administration/admin-panel.md) - End-user admin panel guide
- **API Docs**: [API Reference](../reference/api/README.md) - Settings and Users API reference
- **Database**: [Database Reference](../reference/database.md) - Schema including app_settings table
- **Implementation Plan**: [White-Label Roadmap](./white-label-plan.md) - Complete feature roadmap

---

## Important Reminders

1. **NEVER skip tests** - TDD is mandatory
2. **NEVER mix unrelated changes** in one commit
3. **ALWAYS reference issues** in commits/PRs
4. **ALWAYS update docs** when changing public APIs
5. **ALWAYS run tests** before committing
6. **NEVER push directly to develop** - Always create a feature branch, create a PR, and ask for review

---

## Questions?

If unclear about requirements:
1. Check existing code patterns
2. Review [Contributing Guide](../guides/development/contributing.md) for detailed guidelines
3. Check `server/tests/README.md` for testing specifics
4. Ask for clarification before proceeding

---

[← Back to Project](./README.md) | [Back to Documentation](../README.md)
