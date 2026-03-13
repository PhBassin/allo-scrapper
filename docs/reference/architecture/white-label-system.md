# White-Label System Architecture

Architecture and design of the white-label branding system for Allo-Scrapper.

**Last updated:** March 6, 2026

**Related Documentation:**
- [White-Label Administration Guide](../../guides/administration/white-label.md) - How to customize branding
- [White-Label Plan](../../project/white-label-plan.md) - Feature roadmap
- [Settings API Reference](../api/settings.md) - API endpoints
- [System Design](./system-design.md) - Overall architecture

---

## Table of Contents

- [Overview](#overview)
- [Settings Database Schema](#settings-database-schema)
- [Theme Generator](#theme-generator)
- [Frontend Context](#frontend-context)
- [Image Validation and Compression](#image-validation-and-compression)
- [Settings Import/Export](#settings-importexport)
- [User Role Management](#user-role-management)
- [Admin Panel Architecture](#admin-panel-architecture)

---

## Overview

The white-label system allows administrators to **fully customize the branding** of their Allo-Scrapper instance without rebuilding the application.

### Key Features

- **Dynamic branding**: Change site name, logo, colors, fonts without redeployment
- **Database-driven**: All settings stored in PostgreSQL `app_settings` table
- **Real-time updates**: Changes reflected immediately (no cache, no rebuild)
- **Admin UI**: User-friendly admin panel for non-technical users
- **Import/Export**: Backup and share branding configurations
- **Image validation**: Automatic compression and format validation
- **Custom fonts**: Support for Google Fonts and system fonts
- **Theme CSS generation**: Dynamic CSS file generated at runtime

---

## Settings Database Schema

### Table: `app_settings`

**Purpose**: Store white-label configuration (singleton table, only one row)

**Columns**:

| Column | Type | Description | Default |
|--------|------|-------------|---------|
| `id` | INTEGER | Primary key (always 1) | 1 |
| `site_name` | VARCHAR(100) | Site name (title, header) | 'Allo-Scrapper' |
| `logo_base64` | TEXT | Logo image (base64 data URL) | NULL |
| `favicon_base64` | TEXT | Favicon (base64 data URL) | NULL |
| `color_primary` | VARCHAR(7) | Primary color (hex) | '#FECC00' |
| `color_secondary` | VARCHAR(7) | Secondary color (hex) | '#1F2937' |
| `color_accent` | VARCHAR(7) | Accent color (hex) | '#3B82F6' |
| `color_background` | VARCHAR(7) | Background color (hex) | '#F9FAFB' |
| `color_surface` | VARCHAR(7) | Surface color (hex) | '#FFFFFF' |
| `color_text_primary` | VARCHAR(7) | Primary text color (hex) | '#111827' |
| `color_text_secondary` | VARCHAR(7) | Secondary text color (hex) | '#6B7280' |
| `color_success` | VARCHAR(7) | Success color (hex) | '#10B981' |
| `color_error` | VARCHAR(7) | Error color (hex) | '#EF4444' |
| `font_primary` | VARCHAR(255) | Primary font family | 'system-ui, sans-serif' |
| `font_secondary` | VARCHAR(255) | Secondary font family | 'system-ui, sans-serif' |
| `footer_text` | TEXT | Custom footer text (HTML) | NULL |
| `footer_links` | JSONB | Footer links array | `[]` |
| `email_from_name` | VARCHAR(100) | Email sender name | 'Allo-Scrapper' |
| `email_from_address` | VARCHAR(255) | Email sender address | 'noreply@example.com' |
| `updated_at` | TIMESTAMP | Last update timestamp | NOW() |
| `updated_by` | INTEGER | User who made the change | NULL |

**Constraints**:
- Only one row allowed (`id = 1`)
- `updated_by` references `users(id)` (nullable for system updates)

**Footer Links Structure**:
```typescript
interface FooterLink {
  text: string;   // Link text (e.g., "Privacy Policy")
  url: string;    // Link URL (e.g., "https://example.com/privacy")
}

// Example JSONB value:
[
  { "text": "Privacy Policy", "url": "/privacy" },
  { "text": "Terms of Service", "url": "/terms" }
]
```

---

## Architecture Data Flow

### Overall Flow

```
┌──────────────┐
│ Admin Panel  │ (React component)
│ SettingsPage │
└──────┬───────┘
       │
       │ PUT /api/settings
       ↓
┌──────────────────────┐
│  Express API         │
│  /routes/settings.ts │
│  - Validate images   │
│  - Update database   │
└──────┬───────────────┘
       │
       ↓
┌──────────────────────┐
│  PostgreSQL          │
│  app_settings table  │
└──────┬───────────────┘
       │
       │ GET /api/theme.css
       ↓
┌──────────────────────┐
│  Theme Generator     │
│  theme-generator.ts  │
│  - Query database    │
│  - Generate CSS      │
└──────┬───────────────┘
       │
       │ CSS Variables
       ↓
┌──────────────────────┐
│  React Frontend      │
│  - Apply CSS vars    │
│  - Render logo       │
│  - Show site name    │
└──────────────────────┘
```

---

## Theme Generator

**File**: `server/src/services/theme-generator.ts`

**Purpose**: Generate dynamic CSS file with CSS variables based on database settings

### How It Works

1. **Fetch settings** from `app_settings` table
2. **Extract Google Fonts** from font settings (if used)
3. **Generate CSS** with:
   - `@import` for Google Fonts
   - CSS variables for colors
   - CSS variables for fonts
4. **Return CSS file** via `/api/theme.css` endpoint

---

### Generated CSS Example

```css
/* Google Fonts import (if needed) */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  /* Colors */
  --color-primary: #FECC00;
  --color-secondary: #1F2937;
  --color-accent: #3B82F6;
  --color-background: #F9FAFB;
  --color-surface: #FFFFFF;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-success: #10B981;
  --color-error: #EF4444;
  
  /* Fonts */
  --font-primary: 'Inter', system-ui, -apple-system, sans-serif;
  --font-secondary: 'Inter', system-ui, -apple-system, sans-serif;
}
```

---

### Font Detection Logic

**Google Fonts** (auto-import):
- Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, etc.

**System Fonts** (no import):
- system-ui, -apple-system, Arial, Helvetica, sans-serif, etc.

**Algorithm**:
```typescript
function extractGoogleFont(fontString: string): string | null {
  const fontFamily = fontString.split(',')[0].trim().replace(/['"]/g, '');
  
  if (GOOGLE_FONTS.includes(fontFamily)) {
    return fontFamily; // Import from Google Fonts
  }
  
  if (SYSTEM_FONTS.includes(fontFamily)) {
    return null; // System font, no import needed
  }
  
  return null; // Unknown font, skip import
}
```

---

### Theme Loading Sequence

```
1. Browser loads index.html
2. HTML includes: <link rel="stylesheet" href="/api/theme.css">
3. Browser fetches /api/theme.css
4. Express API calls theme-generator.ts
5. theme-generator.ts queries PostgreSQL
6. CSS generated with current settings
7. CSS returned with Cache-Control: no-cache
8. Browser applies CSS variables
9. React app uses CSS variables in Tailwind config
```

**Important**: Theme CSS is **not cached** to ensure changes are reflected immediately.

---

## Frontend Context

**File**: `client/src/contexts/SettingsContext.tsx`

**Purpose**: Provide global access to settings across React components

### Context Structure

```typescript
interface SettingsContextType {
  settings: AppSettingsPublic | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettingsPublic | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchSettings();
  }, []);
  
  async function fetchSettings() {
    const response = await apiClient.get('/settings');
    setSettings(response.data);
  }
  
  return (
    <SettingsContext.Provider value={{ settings, loading, error, refetch }}>
      {children}
    </SettingsContext.Provider>
  );
}
```

### Usage in Components

```typescript
import { useSettings } from '@/contexts/SettingsContext';

function Header() {
  const { settings } = useSettings();
  
  return (
    <header>
      <h1>{settings?.site_name || 'Allo-Scrapper'}</h1>
      {settings?.logo_base64 && (
        <img src={settings.logo_base64} alt="Logo" />
      )}
    </header>
  );
}
```

---

## Image Validation and Compression

**File**: `server/src/utils/image-validator.ts`

**Purpose**: Validate and compress uploaded images (logo, favicon)

### Validation Rules

| Image Type | Max Size (Before) | Max Size (After) | Formats | Compression |
|------------|-------------------|------------------|---------|-------------|
| **Logo** | 2 MB | 500 KB | PNG, JPEG, WebP | 80% quality |
| **Favicon** | 500 KB | 100 KB | PNG, ICO | 80% quality |

### Validation Process

```typescript
async function validateImage(
  base64: string,
  type: 'logo' | 'favicon'
): Promise<{ valid: boolean; error?: string; compressed?: string }> {
  
  // 1. Decode base64
  const buffer = Buffer.from(base64.split(',')[1], 'base64');
  
  // 2. Check file size
  if (type === 'logo' && buffer.length > 2 * 1024 * 1024) {
    return { valid: false, error: 'Logo must be < 2 MB' };
  }
  
  // 3. Validate format (using `sharp` library)
  const metadata = await sharp(buffer).metadata();
  if (!['png', 'jpeg', 'webp'].includes(metadata.format)) {
    return { valid: false, error: 'Invalid format' };
  }
  
  // 4. Compress image
  const compressed = await sharp(buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .png({ quality: 80 })
    .toBuffer();
  
  // 5. Convert back to base64
  const compressedBase64 = `data:image/png;base64,${compressed.toString('base64')}`;
  
  return { valid: true, compressed: compressedBase64 };
}
```

**Why compression?**
- Reduce database size
- Faster page loads
- Prevent abuse (uploading huge images)

---

## Settings Import/Export

### Export Format (JSON)

```json
{
  "site_name": "My Cinema",
  "logo_base64": "data:image/png;base64,...",
  "favicon_base64": "data:image/png;base64,...",
  "color_primary": "#FF5733",
  "color_secondary": "#1F2937",
  "color_accent": "#3B82F6",
  "color_background": "#F9FAFB",
  "color_surface": "#FFFFFF",
  "color_text_primary": "#111827",
  "color_text_secondary": "#6B7280",
  "color_success": "#10B981",
  "color_error": "#EF4444",
  "font_primary": "Inter, sans-serif",
  "font_secondary": "Inter, sans-serif",
  "footer_text": "© 2026 My Cinema",
  "footer_links": [
    { "text": "Privacy", "url": "/privacy" }
  ]
}
```

**Excluded from export**: `id`, `email_*`, `updated_at`, `updated_by`

---

### Export Endpoint

```
GET /api/settings/export
Authorization: Bearer <admin-token>

Response: JSON file download
```

---

### Import Endpoint

```
POST /api/settings/import
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "site_name": "...",
  "color_primary": "...",
  ...
}

Response: 200 OK
```

**Validation**: All fields validated before import (same rules as manual updates)

---

## User Role Management

**Roles**:
- `admin` - Full access with bypass privileges (can edit settings, manage users, view all data)
- `operator` - Operational access (scraping, cinema management, reports)
- Custom roles - Configurable permission sets for specific job functions

**Permission Enforcement**:
```typescript
// Middleware: server/src/middleware/permission.ts
export function requirePermission(...requiredPermissions: string[]) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Admin bypass
    if (req.user.role_name === 'admin' && req.user.is_system_role) {
      return next();
    }
    
    // Check permissions
    const userPermissions = new Set(req.user.permissions);
    const hasAll = requiredPermissions.every(p => userPermissions.has(p));
    
    if (!hasAll) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    return next();
  };
}

// Usage in routes:
router.put('/settings', authenticateToken, requirePermission('settings:update'), updateSettings);
```

**Settings Access**:
- `GET /api/settings` - Public (no auth required)
- `PUT /api/settings` - Requires `settings:update` permission
- `GET /api/settings/export` - Requires `settings:export` permission
- `POST /api/settings/import` - Requires `settings:import` permission
- `GET /api/settings/admin` - Requires `settings:read` permission
- `POST /api/settings/reset` - Requires `settings:reset` permission

---

## Admin Panel Architecture

**File**: `client/src/pages/admin/SettingsPage.tsx`

### Admin Panel Components

```
SettingsPage
├── ColorPicker (color_primary, color_secondary, etc.)
├── ImageUploader (logo_base64, favicon_base64)
├── FontSelector (font_primary, font_secondary)
├── TextInput (site_name)
├── TextArea (footer_text)
├── FooterLinksEditor (footer_links array)
├── PreviewPanel (live preview)
└── SaveButton (submit changes)
```

---

### Live Preview

Admin sees changes **before saving**:

```typescript
function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(currentSettings);
  const [preview, setPreview] = useState(false);
  
  function handleColorChange(field: string, value: string) {
    setSettings({ ...settings, [field]: value });
    if (preview) {
      // Apply CSS variable immediately for preview
      document.documentElement.style.setProperty(`--${field}`, value);
    }
  }
  
  async function handleSave() {
    await apiClient.put('/settings', settings);
    window.location.reload(); // Reload to apply new theme.css
  }
}
```

---

### Image Upload Flow

```
1. User clicks "Upload Logo"
2. <input type="file"> opens file picker
3. User selects image
4. FileReader converts to base64
5. Frontend validates size (< 2 MB)
6. Preview shown immediately
7. User clicks "Save"
8. POST /api/settings with base64 image
9. Backend validates and compresses
10. Database updated
11. Frontend reloads to show new logo
```

---

## Security Considerations

### Implemented

- ✅ **Admin-only access** to settings endpoints
- ✅ **Image validation** prevents malicious uploads
- ✅ **File size limits** prevent DoS via large uploads
- ✅ **Image compression** reduces storage and bandwidth
- ✅ **HTML sanitization** for footer_text (prevent XSS)
- ✅ **Role-based access control** (RBAC)

### Future Enhancements

- 🔲 **Rate limiting** on settings updates
- 🔲 **Audit log** for settings changes
- 🔲 **Restore previous settings** (versioning)

---

## Related Documentation

- [White-Label Administration Guide](../../guides/administration/white-label.md) - Step-by-step customization guide
- [Settings API Reference](../api/settings.md) - API endpoints documentation
- [White-Label Plan](../../project/white-label-plan.md) - Planned features
- [User Management Guide](../../guides/administration/user-management.md) - Role management

---

[← Back to Architecture](./README.md)
