# Settings Management API

**Admin Only:** All write endpoints require admin authentication  
**Rate Limit:** 60 requests per 15 minutes (applies to all admin endpoints)

The Settings API provides complete white-label branding customization for the application. Configure site name, logo, colors, fonts, footer, and email branding through a comprehensive admin interface.

**Last updated:** March 4, 2026

## Settings Management

### Get Public Settings

```http
GET /api/settings
```

**Authentication:** None (public endpoint)

**Description:** Returns public settings used for theme application in the frontend. Does not include admin-only fields like `updated_by`.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "site_name": "My Cinema Portal",
    "logo_base64": "data:image/png;base64,iVBORw0KG...",
    "favicon_base64": "data:image/x-icon;base64,AAABA...",
    "color_primary": "#FECC00",
    "color_secondary": "#1F2937",
    "color_accent": "#3B82F6",
    "color_background": "#F9FAFB",
    "color_surface": "#FFFFFF",
    "color_text_primary": "#111827",
    "color_text_secondary": "#6B7280",
    "color_success": "#10B981",
    "color_error": "#EF4444",
    "font_primary": "Inter",
    "font_secondary": "Roboto",
    "footer_text": "Cinema schedules updated weekly",
    "footer_copyright": "{site_name} © {year}",
    "footer_links": [
      {"label": "Privacy Policy", "url": "https://example.com/privacy"},
      {"label": "Contact", "url": "https://example.com/contact"}
    ],
    "email_from_name": "My Cinema Portal",
    "email_from_address": "noreply@example.com",
    "email_header_color": "#FECC00",
    "email_footer_text": "You received this email from My Cinema Portal"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/settings
```

---

### Get Admin Settings

```http
GET /api/settings/admin
```

**Authentication:** Required (Admin role only)

**Description:** Returns full settings including admin-only fields like `updated_by` and `updated_at`.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "site_name": "My Cinema Portal",
    "logo_base64": "data:image/png;base64,iVBORw0KG...",
    "favicon_base64": "data:image/x-icon;base64,AAABA...",
    "color_primary": "#FECC00",
    "color_secondary": "#1F2937",
    "color_accent": "#3B82F6",
    "color_background": "#F9FAFB",
    "color_surface": "#FFFFFF",
    "color_text_primary": "#111827",
    "color_text_secondary": "#6B7280",
    "color_success": "#10B981",
    "color_error": "#EF4444",
    "font_primary": "Inter",
    "font_secondary": "Roboto",
    "footer_text": "Cinema schedules updated weekly",
    "footer_copyright": "{site_name} © {year}",
    "footer_links": [
      {"label": "Privacy Policy", "url": "https://example.com/privacy"}
    ],
    "email_from_name": "My Cinema Portal",
    "email_from_address": "noreply@example.com",
    "email_header_color": "#FECC00",
    "email_footer_text": "You received this email from My Cinema Portal",
    "updated_at": "2026-03-01T14:30:00.000Z",
    "updated_by": 1
  }
}
```

**Response (403 — not admin):**
```json
{
  "success": false,
  "error": "Forbidden: Admin access required"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Get admin settings
curl http://localhost:3000/api/settings/admin \
  -H "Authorization: Bearer $TOKEN"
```

---

### Update Settings

```http
PUT /api/settings
```

**Authentication:** Required (Admin role only)

**Description:** Update application settings. All fields are optional; only provided fields will be updated.

**Request Body:**
```json
{
  "site_name": "My Cinema Portal",
  "color_primary": "#FF5733",
  "font_primary": "Montserrat",
  "footer_text": "Updated footer text with {site_name} and {year} placeholders",
  "footer_links": [
    {"label": "Privacy", "url": "https://example.com/privacy"},
    {"label": "Terms", "url": "https://example.com/terms"}
  ]
}
```

**Validation Rules:**
- **Colors**: Must be valid hex codes (e.g., `#FECC00` or `#FFF`)
- **Images**: Must be valid base64 data URLs
  - Logo: Max 2MB (before compression), formats: PNG/JPEG/WebP, max 500x500px
  - Favicon: Max 50KB, formats: ICO/PNG, 32x32 or 64x64px
- **Footer links**: Array of `{label: string, url: string}` objects
- **Fonts**: String values (Google Fonts or system fonts)

#### Image Processing

All uploaded logos are automatically processed:
- **Validation**: Format (PNG/JPEG/WebP), dimensions (max 500x500), size (max 2MB)
- **Compression**: Automatically compressed for optimal storage and delivery
- **Storage**: Only the compressed version is stored and served
- **Output**: The compressed base64 data is returned in the response

Unsupported formats or oversized images will be rejected with a 400 error.

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "site_name": "My Cinema Portal",
    "color_primary": "#FF5733",
    "updated_at": "2026-03-01T15:00:00.000Z"
  }
}
```

**Response (400 — validation error):**
```json
{
  "success": false,
  "error": "Invalid color format for color_primary: must be hex code"
}
```

**Response (403 — not admin):**
```json
{
  "success": false,
  "error": "Forbidden: Admin access required"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Update settings
curl -X PUT http://localhost:3000/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "site_name": "My Cinema Portal",
    "color_primary": "#FF5733",
    "font_primary": "Montserrat"
  }'
```

---

### Reset Settings to Defaults

```http
POST /api/settings/reset
```

**Authentication:** Required (Admin role only)

**Description:** Reset all settings to default values (original Allo-Scrapper branding).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Settings reset to defaults",
    "settings": {
      "site_name": "Allo-Scrapper",
      "color_primary": "#FECC00",
      "color_secondary": "#1F2937"
    }
  }
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Reset settings
curl -X POST http://localhost:3000/api/settings/reset \
  -H "Authorization: Bearer $TOKEN"
```

---

### Export Settings

```http
POST /api/settings/export
```

🔒 **Authentication:** Required (Admin role only)  
**Rate Limit:** 60 requests per 15 minutes

**Description:** Export all settings as a JSON file for backup or migration purposes.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "version": "1.0",
    "exported_at": "2026-03-01T15:30:00.000Z",
    "settings": {
      "site_name": "My Cinema Portal",
      "logo_base64": "data:image/png;base64,...",
      "color_primary": "#FECC00",
      "footer_links": [...]
    }
  }
}
```

**Response (403 — not admin):**
```json
{
  "success": false,
  "error": "Forbidden: Admin access required"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Export settings to file
curl -X POST http://localhost:3000/api/settings/export \
  -H "Authorization: Bearer $TOKEN" \
  -o settings-backup.json
```

---

### Import Settings

```http
POST /api/settings/import
```

**Authentication:** Required (Admin role only)

**Description:** Import settings from a previously exported JSON file. Validates the structure before applying.

⚠️ **Warning**: Import overwrites ALL current settings. This action cannot be undone. Export current settings before importing to create a backup.

**Request Body:**
```json
{
  "version": "1.0",
  "exported_at": "2026-03-01T15:30:00.000Z",
  "settings": {
    "site_name": "My Cinema Portal",
    "color_primary": "#FECC00"
  }
}
```

**Response (200 — success):**
```json
{
  "success": true,
  "data": {
    "message": "Settings imported successfully",
    "applied_fields": ["site_name", "color_primary", "font_primary"]
  }
}
```

**Response (403 — not admin):**
```json
{
  "success": false,
  "error": "Forbidden: Admin access required"
}
```

**Response (400 — invalid format):**
```json
{
  "success": false,
  "error": "Invalid import format: missing version field"
}
```

**Example:**
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Import settings from file
curl -X POST http://localhost:3000/api/settings/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @settings-backup.json
```

---

### Get Dynamic Theme CSS

```http
GET /api/theme.css
```

**Authentication:** None (public endpoint)

**Description:** Returns dynamically generated CSS based on current settings. Includes CSS custom properties, Google Fonts imports, and theme variables. Response is cached with ETag for performance.

**Response (200):**
```css
/* Google Fonts Import */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;600;700&display=swap');

/* CSS Custom Properties */
:root {
  --color-primary: #FECC00;
  --color-secondary: #1F2937;
  --color-accent: #3B82F6;
  --color-background: #F9FAFB;
  --color-surface: #FFFFFF;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-success: #10B981;
  --color-error: #EF4444;
  --font-primary: 'Inter', system-ui, -apple-system, sans-serif;
  --font-secondary: 'Roboto', system-ui, -apple-system, sans-serif;
}

body {
  font-family: var(--font-primary);
  background-color: var(--color-background);
  color: var(--color-text-primary);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-secondary);
}
```

**Response Headers:**
- `Content-Type: text/css`
- `Cache-Control: public, max-age=3600` (1 hour cache)
- `ETag: "w/hash-of-settings"` (conditional caching)

**Example:**
```bash
# Fetch theme CSS
curl http://localhost:3000/api/theme.css

# Include in HTML
<link rel="stylesheet" href="http://localhost:3000/api/theme.css">
```

**Usage in Frontend:**
```html
<!DOCTYPE html>
<html>
<head>
  <!-- Load dynamic theme -->
  <link rel="stylesheet" href="/api/theme.css">
  
  <!-- Your app styles -->
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <!-- Theme variables are available via var(--color-primary), etc. -->
</body>
</html>
```

---

[← Back to API Reference](./README.md)
