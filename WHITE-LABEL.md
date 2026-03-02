# White-Label System

The white-label branding system allows complete customization of the application's appearance and branding through an admin panel and REST API.

---

## System Overview

**Components:**
- **Backend**: Settings and user management APIs with role-based access
- **Frontend**: Admin panel UI with 5 tabs (General, Colors, Typography, Footer, Email)
- **Database**: `app_settings` table (singleton) and `users` table with roles
- **Theme**: Dynamic CSS generation from settings

## Architecture

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

---

## Backend Components

### Database Layer

**Location**: `server/src/db/`

- **settings-queries.ts**: Settings CRUD operations
  - `getPublicSettings()` - Public settings (no auth)
  - `getAdminSettings()` - Full settings (admin only)
  - `updateSettings()` - Update with validation
  - `resetSettings()` - Restore defaults
  - `exportSettings()` - JSON backup
  - `importSettings()` - Restore from JSON
  - **Tests**: `settings-queries.test.ts`

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

### API Routes

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

### Services

**Location**: `server/src/services/`

- **theme-generator.ts**: Dynamic CSS generation
  - `extractGoogleFont()` - Detect Google Fonts vs system fonts
  - `generateGoogleFontsImport()` - Generate @import for fonts
  - `generateCSSVariables()` - Generate CSS custom properties
  - `generateThemeCSS()` - Complete CSS with fonts + variables
  - **Tests**: `theme-generator.test.ts`

**Endpoint**: `GET /api/theme.css` (public, cached with ETag)

### Middleware

**Location**: `server/src/middleware/`

- **admin.ts**: Admin role enforcement
  - `requireAdmin()` - Middleware for admin-only routes
  - Checks JWT auth + queries user role from database
  - Returns 403 if not admin

### Types

**Location**: `server/src/types/`

- **settings.ts**: AppSettings, AppSettingsPublic, FooterLink
- **user.ts**: UserRole, UserPublic, User

### Utilities

**Location**: `server/src/utils/`

- **image-validator.ts**: Base64 image validation
  - Logo: Max 200KB, PNG/JPG/SVG, min 100x100px
  - Favicon: Max 50KB, ICO/PNG, 32x32 or 64x64px
  - Compression with sharp library

---

## Frontend Components

### Admin Settings Page

**Location**: `client/src/pages/admin/SettingsPage.tsx`

**Features**:
- Tabbed interface (General, Colors, Typography, Footer, Email)
- Form state management with change tracking
- Save/Reset/Export/Import controls
- Loading states and error handling

### Admin UI Components

**Location**: `client/src/components/admin/`

- **ColorPicker.tsx**: Color input with hex validation and live preview
- **FontSelector.tsx**: Google Fonts dropdown with preview
- **ImageUpload.tsx**: Drag-and-drop base64 image upload with size validation
- **FooterLinksEditor.tsx**: Dynamic array editor for footer links

### Contexts

**Location**: `client/src/contexts/`

- **SettingsContext.tsx**:
  - Manages public and admin settings state
  - Provides: `refreshPublicSettings()`, `refreshAdminSettings()`, `updateSettings()`
  - Auto-loads public settings on mount

### API Client

**Location**: `client/src/api/`

- **settings.ts**: Complete settings API client
  - Types: `AppSettings`, `AppSettingsPublic`, `AppSettingsUpdate`, `AppSettingsExport`
  - Functions: `getPublicSettings()`, `getAdminSettings()`, `updateSettings()`, `resetSettings()`, `exportSettings()`, `importSettings()`

### Route Protection

**Location**: `client/src/components/`

- **RequireAdmin.tsx**: Route guard for admin-only pages

---

## Making Changes to the Settings Schema

Follow these steps when adding new settings fields:

### 1. Database Migration

```sql
-- migrations/004_add_app_settings.sql
ALTER TABLE app_settings ADD COLUMN new_field TEXT DEFAULT 'default_value';
```

### 2. Update TypeScript Types

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

### 3. Update Backend Queries

```typescript
// server/src/db/settings-queries.ts
export async function updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  if (updates.new_field !== undefined) {
    setClauses.push(`new_field = $${paramIndex++}`);
    values.push(updates.new_field);
  }
  // ...
}
```

### 4. Update Frontend UI

```tsx
// client/src/pages/admin/SettingsPage.tsx
const [formData, setFormData] = useState({
  new_field: adminSettings?.new_field || '',
});

<Input
  label="New Field"
  value={formData.new_field}
  onChange={(e) => setFormData({ ...formData, new_field: e.target.value })}
/>
```

### 5. Write Tests (TDD — write these FIRST)

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

### 6. Update Theme Generator (if CSS-related)

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

### 7. Commit Sequence

```bash
git commit -m "test(settings): add tests for new_field"
git commit -m "feat(db): add new_field to app_settings table"
git commit -m "feat(api): add new_field to settings API"
git commit -m "feat(admin): add new_field to settings panel"
```

---

## Accessing Settings

### In Backend

```typescript
import { getPublicSettings } from '../db/settings-queries';

const settings = await getPublicSettings();
console.log(settings.site_name);
```

### In Frontend

```tsx
import { useContext } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';

function MyComponent() {
  const { publicSettings } = useContext(SettingsContext);
  return <h1>{publicSettings?.site_name}</h1>;
}
```

### Updating Settings (Admin)

```tsx
function AdminComponent() {
  const { updateSettings } = useContext(SettingsContext);

  const handleSave = async () => {
    await updateSettings({ site_name: 'New Name' });
  };
}
```

---

## Testing

```bash
cd server
npm run test:run settings-queries.test.ts
npm run test:run settings.test.ts
npm run test:run user-queries.test.ts
npm run test:run users.test.ts
npm run test:run theme-generator.test.ts

npm run test:coverage
```

---

## Troubleshooting

### Settings Not Saving

1. Check admin authentication:
   ```bash
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

### Theme Not Applying

1. Check `/api/theme.css` endpoint:
   ```bash
   curl http://localhost:3000/api/theme.css
   ```

2. Verify settings are public:
   ```bash
   curl http://localhost:3000/api/settings
   ```

3. Clear browser cache and hard refresh (Ctrl+F5)

### Role Not Working

1. Check user role in database:
   ```bash
   docker compose exec ics-db psql -U postgres -d ics
   SELECT id, username, role FROM users;
   ```

2. Update role manually if needed:
   ```sql
   UPDATE users SET role = 'admin' WHERE username = 'admin';
   ```
