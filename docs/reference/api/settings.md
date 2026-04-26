# Settings API

## Public route

### `GET /api/settings`

Returns public branding and theme settings.

Current public fields:

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

### `GET /api/theme.css`

Public CSS endpoint generated from current settings.

## Admin routes

All routes below are protected and permission-gated.

### `GET /api/settings/admin`

Requires `settings:read`.

Returns full settings, including admin-only fields such as:

- `id`
- `email_from_name`
- `email_from_address`
- `scrape_mode`
- `scrape_days`
- `updated_at`
- `updated_by`

### `PUT /api/settings`

Requires `settings:update`.

Accepts partial updates.

Notable validated fields:

- image uploads: `logo_base64`, `favicon_base64`
- branding fields
- `footer_links`
- `scrape_mode`: `weekly | from_today | from_today_limited`
- `scrape_days`: integer `1-14`

### `POST /api/settings/reset`

Requires `settings:reset`.

Resets branding plus scrape settings back to defaults.

### `POST /api/settings/export`

Requires `settings:export`.

Exports settings as JSON.

### `POST /api/settings/import`

Requires `settings:import`.

Imports previously exported settings JSON.

## Current route note

`/api/settings/export` is a `POST`, not a `GET`.
