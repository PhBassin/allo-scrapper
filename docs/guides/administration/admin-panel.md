# 🎨 Admin Panel User Guide

Complete guide to using the Allo-Scrapper admin panel for white-label branding and user management.

**Last updated:** March 18, 2026 | Status: Current ✅

---

## 📋 Table of Contents

- [Overview](#overview)
- [Accessing the Admin Panel](#accessing-the-admin-panel)
- [Admin Tabs](#admin-tabs)
  - [General Settings](#1-general-settings)
  - [Colors](#2-colors)
  - [Typography](#3-typography)
  - [Footer](#4-footer)
  - [Email Branding](#5-email-branding)
- [System Information](#system-information)
- [Configuration Management](#configuration-management)
- [User Management](#user-management)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The admin panel provides comprehensive control over:
- **Branding**: Site name, logo, favicon, colors, fonts, footer
- **Users**: Create, edit, delete users; manage roles
- **System**: Monitor application health, database, and migrations
- **Configuration**: Export/import settings for backup and migration

**Access Level**: Admin role required for all admin panel features.

---

## Accessing the Admin Panel

### Step 1: Login

1. Navigate to the application homepage
2. Click "Login" in the top-right corner
3. Enter credentials:
   - **Default username**: `admin`
   - **Default password**: `admin`
4. Click "Login"

⚠️ **Security Alert**: Change the default admin password immediately after first login!

### Step 2: Access Admin Panel

Click your username in the top-right corner and select "Admin" or navigate directly to `/admin`.

---

## Admin Panel Overview

The admin panel is organized into **7 main tabs**, each controlling different aspects of the application. Your access to tabs depends on your assigned role and permissions.

### Available Admin Tabs

| Tab | Purpose | Permissions Required | Description |
|-----|---------|---------------------|-------------|
| **Cinemas** | Manage cinema locations | `cinemas:*` or `scraper:*` | Add, edit, delete cinemas; view showtimes |
| **Schedules** | Manage scraping schedules | `scraper:schedules:*` | Create and manage automated scraping schedules |
| **Rapports** | View scrape reports | `reports:list` or `reports:view` | Review scraping session history and status |
| **Users** | User account management | `users:*` | Create users, manage accounts, reset passwords |
| **Roles** | Role and permission management | `roles:*` | Create custom roles, assign permissions |
| **Settings** | Application branding & configuration | `settings:*` | Customize site name, colors, fonts, footer, theme |
| **System** | System diagnostics | `system:*` | View system health, database status, migrations |

**Note**: If you don't see a tab, you don't have the required permissions. Contact your admin to request access.

---

## Admin Tabs

The admin panel is organized into five tabs for easy navigation.

### 1. General Settings

Configure core branding elements.

#### Site Name
- **Purpose**: Displayed in header, page title, browser tab, footer
- **Format**: Plain text (e.g., "My Cinema Portal")
- **Placeholders**: Available in footer as `{site_name}`
- **Example**: Changing "Allo-Scrapper" to "CinéParis" updates all references site-wide

#### Logo Upload
- **Purpose**: Replaces default 🎬 emoji in header
- **Formats**: PNG, JPG, SVG
- **Max Size**: 200KB
- **Min Dimensions**: 100x100 pixels
- **Recommended**: 300x80px for best header appearance
- **Upload Methods**:
  - Drag and drop image onto upload area
  - Click "Choose file" to browse files
- **Preview**: Live preview shown below upload area
- **Remove**: Click "Remove Logo" to delete current logo

**Tips**:
- Use transparent PNG for best results
- Optimize images before upload to stay under 200KB limit
- Test logo appearance on different screen sizes

#### Favicon Upload
- **Purpose**: Browser tab icon
- **Formats**: ICO (recommended), PNG
- **Max Size**: 50KB
- **Dimensions**: 32x32 or 64x64 pixels (ICO can contain multiple sizes)
- **Upload Method**: Same as logo (drag-and-drop or browse)
- **Preview**: Shows favicon preview

**Tips**:
- Use ICO format for best browser compatibility
- Include multiple sizes in ICO file (16x16, 32x32, 64x64)
- Simple, bold designs work best at small sizes

---

### 2. Colors

Customize the complete color palette with 9 theme variables.

#### Color Variables

| Color | Purpose | Default | Example Usage |
|-------|---------|---------|---------------|
| **Primary** | Brand color, buttons, links | `#FECC00` | Action buttons, active states |
| **Secondary** | Header/footer background | `#1F2937` | Navigation bars, footers |
| **Accent** | Call-to-action highlights | `#3B82F6` | Important buttons, badges |
| **Background** | Page background | `#F9FAFB` | Main page background |
| **Surface** | Card/panel backgrounds | `#FFFFFF` | Film cards, modals |
| **Text Primary** | Main text color | `#111827` | Headings, body text |
| **Text Secondary** | Muted text | `#6B7280` | Labels, captions, metadata |
| **Success** | Success messages | `#10B981` | Success toasts, checkmarks |
| **Error** | Error messages | `#EF4444` | Error messages, warnings |

#### Using the Color Picker

1. Click the color swatch to open color picker
2. **Pick visually**: Drag selector in color picker
3. **Enter hex code**: Type directly in input (e.g., `#FF5733`)
4. **Preview**: See color applied in preview area
5. **Reset**: Click "Reset to Default" to restore original color

**Format Requirements**:
- Must be valid hex code
- Accepts 3-digit (`#FFF`) or 6-digit (`#FFFFFF`) format
- Include the `#` prefix

**Accessibility Tips**:
- Maintain high contrast between text and background colors
- Test with WCAG contrast checker (4.5:1 minimum for normal text)
- Avoid red-green combinations (color-blind friendly)

---

### 3. Typography

Choose fonts for headings and body text from Google Fonts library.

#### Heading Font
- **Applied to**: h1, h2, h3, h4, h5, h6 elements
- **Available Fonts**: 15+ popular Google Fonts
- **Default**: System fonts (`system-ui, -apple-system, sans-serif`)
- **Live Preview**: See font rendered in preview area

#### Body Font
- **Applied to**: Paragraph text, UI elements, buttons
- **Available Fonts**: Same as heading font
- **Default**: System fonts
- **Performance**: Google Fonts loaded automatically, no manual setup

#### Available Google Fonts

- **Inter** - Modern, clean geometric sans-serif (recommended for body)
- **Roboto** - Google's signature font, excellent readability
- **Open Sans** - Friendly, professional
- **Lato** - Warm, stable, serious but friendly
- **Montserrat** - Urban, geometric (great for headings)
- **Poppins** - Geometric sans with rounded terminals
- **Raleway** - Elegant, thin, sophisticated
- **Nunito** - Rounded, friendly
- **PT Sans** - Designed for Cyrillic, universal
- **Source Sans Pro** - Adobe's first open-source font
- **Work Sans** - Optimized for screen display
- **Archivo** - Grotesque sans-serif
- **Manrope** - Modern, geometric
- **DM Sans** - Low contrast geometric
- **Plus Jakarta Sans** - Neo-grotesque, contemporary

**Choosing Fonts**:
1. **Pair complementary fonts**: Geometric heading + humanist body works well
2. **Limit to 2 fonts**: Heading + body (consistency is key)
3. **Test readability**: Long-form text needs high legibility
4. **Performance**: Google Fonts are CDN-hosted and cached

**Examples of Good Pairings**:
- Montserrat (headings) + Open Sans (body)
- Poppins (headings) + Inter (body)
- Raleway (headings) + Lato (body)

---

### 4. Footer

Customize footer text and links.

#### Footer Text
- **Purpose**: Main footer message
- **Format**: Plain text with placeholders
- **Placeholders**:
  - `{site_name}` → Replaced with site name from General tab
  - `{year}` → Replaced with current year (e.g., 2026)
- **Default**: `"Cinema schedules provided by source - Updated weekly"`
- **Example**: `"{site_name} © {year} - All rights reserved"`
  - Renders as: "My Cinema Portal © 2026 - All rights reserved"

#### Footer Links
- **Purpose**: Custom navigation links (Privacy, Terms, Contact, etc.)
- **Format**: Array of label + URL pairs
- **Maximum**: Unlimited (recommended: 3-5 for clean layout)

**Adding a Link**:
1. Click "+ Add Link" button
2. Enter **Label** (e.g., "Privacy Policy")
3. Enter **URL** (e.g., `https://example.com/privacy`)
4. Link appears in footer immediately

**Editing a Link**:
1. Click link in list
2. Modify label or URL
3. Changes auto-save

**Removing a Link**:
1. Click "Remove" button next to link
2. Confirm deletion

**Reordering Links**:
1. Drag link by handle icon (⋮⋮)
2. Drop in desired position
3. Footer updates automatically

**Link Validation**:
- URLs must start with `http://` or `https://`
- Labels must be 1-50 characters
- Invalid entries highlighted in red

---

### 5. Email Branding

Configure email template branding for system-generated emails.

#### Email From Name
- **Purpose**: Sender name in email "From" field
- **Default**: `"Allo-Scrapper"`
- **Example**: `"My Cinema Portal"`

#### Email From Address
- **Purpose**: Sender email address
- **Format**: Valid email (e.g., `noreply@example.com`)
- **Validation**: Must be valid email format

#### Email Header Color
- **Purpose**: Background color for email template header
- **Format**: Hex color code
- **Default**: `#FECC00`
- **Preview**: Shows email header preview with color

#### Email Footer Text
- **Purpose**: Footer message in email templates
- **Example**: `"You received this email from My Cinema Portal"`

**Note**: Email features are prepared for future notifications (password resets, reports, etc.). Currently not actively sending emails unless configured.

---

## System Information

Monitor application health, server metrics, database statistics, and migration status.

**Access**: Click your username → **"System"** from the dropdown menu  
**Route**: `/admin/system`  
**Requirements**: Admin role required

### Overview Dashboard

The System Information page provides real-time diagnostics across four main areas:

1. **Health Status** - Overall system health and component checks
2. **Application Info** - Version, environment, and build information
3. **Server Health** - Uptime, memory usage, and platform details
4. **Database Statistics** - Size, table counts, and data metrics
5. **Database Migrations** - Applied and pending migration status

### Auto-Refresh

**Purpose**: Automatically refresh metrics every 30 seconds to monitor live system status.

**Usage**:
1. Toggle the **"Auto-refresh (30s)"** checkbox at the top of the page
2. When enabled, all metrics update every 30 seconds
3. Disable when not actively monitoring to reduce server load

**Recommended**: Enable during scraping operations or troubleshooting.

---

### Health Status Card

Displays overall system health with status badge and component checks.

#### Status Indicators

| Status | Color | Meaning |
|--------|-------|---------|
| **Healthy** | Green | All systems operational |
| **Degraded** | Yellow | Some issues detected (e.g., pending migrations) |
| **Error** | Red | Critical system failure |

#### Health Checks

- **Database**: Connection and query functionality
- **Migrations**: All migrations applied (no pending)
- **Scrapers**: Active scraping jobs count

**Troubleshooting**:
- **Red status**: Check server logs immediately
- **Yellow status**: Review pending migrations or active jobs
- **Database check failed**: Verify PostgreSQL is running

---

### Application Info Card

View application metadata and version information.

#### Fields

- **Version**: Semantic version (e.g., `1.0.0`)
- **Build Date**: ISO timestamp when application was built
- **Environment**: `production`, `development`, or `staging`
- **Node Version**: Node.js runtime version (e.g., `v20.20.0`)

**Use Cases**:
- Verify correct version after deployment
- Confirm environment matches expected (prod vs dev)
- Troubleshoot compatibility issues with Node.js version

---

### Server Health Card

Monitor server resource usage and uptime.

#### Metrics

- **Uptime**: Time since server started (formatted: "2h 15m 30s")
- **Memory Usage**:
  - **Heap Used**: JavaScript heap memory in use
  - **Heap Total**: Total heap allocated
  - **RSS**: Resident Set Size (total memory including native)
- **Platform**: Operating system (e.g., `linux`, `darwin`)
- **Architecture**: CPU architecture (e.g., `arm64`, `x64`)

**Memory Format**: All memory values displayed in MB (e.g., "45.23 MB")

**Warning Signs**:
- Heap usage approaching total → potential memory leak
- RSS significantly higher than heap → native module memory usage
- Low uptime after deployment → server restarts (check logs)

---

### Database Statistics Card

View database size and data record counts.

#### Metrics

- **Database Size**: Total PostgreSQL database size (e.g., "8063 kB")
- **Tables**: Total number of database tables
- **Cinemas**: Count of cinema records
- **Films**: Count of film records  
- **Showtimes**: Count of showtime records

**Use Cases**:
- Monitor database growth over time
- Verify data after scraping operations
- Identify cleanup needs (old showtimes)

**Expected Values** (approximate):
- Cinemas: 10-50 (depends on configuration)
- Films: 100-500 (varies by season)
- Showtimes: 1,000-10,000 (depends on time period)

---

### Database Migrations Table

Track applied and pending database schema migrations.

#### Table Columns

| Column | Description |
|--------|-------------|
| **Migration** | Filename of migration SQL file |
| **Applied At** | Timestamp when migration was executed |
| **Status** | Badge showing "Applied" (green) |

#### Migration Naming Convention

Migrations follow the format: `NNN_description.sql`

**Examples**:
- `001_neutralize_references.sql` - Initial schema
- `003_add_users_table.sql` - User authentication
- `007_seed_default_admin.sql` - Default admin user

#### Understanding Migration Status

**Healthy State**:
- ✅ All migrations applied
- ✅ Pending count: 0
- ✅ Migrations tab shows green "Applied" badges

**Warning State**:
- ⚠️ Pending migrations exist
- ⚠️ Health status shows "Degraded"
- ⚠️ Action required: Run migration command

**To Apply Pending Migrations**:

```bash
# Via Docker
docker compose restart ics-web

# Migrations auto-apply on startup if AUTO_MIGRATE=true (default)
```

**Manual Migration** (if auto-migrate disabled):

```bash
docker compose exec ics-web npm run migrate
```

---

### Monitoring Workflows

#### During Scraping Operations

1. Navigate to System page
2. Enable auto-refresh
3. Monitor:
   - Active scraper jobs count
   - Memory usage (should not spike excessively)
   - Showtimes count increasing
4. After scraping completes:
   - Active jobs should return to 0
   - Showtimes count should reflect new data
   - Memory should stabilize (not continuously growing)

#### After Deployment

1. Check Application Info:
   - Verify version matches deployed version
   - Confirm environment is `production`
2. Check Health Status:
   - Must be "Healthy" (green)
   - All checks passing
3. Check Migrations:
   - Pending count should be 0
   - All expected migrations applied
4. Check Server Health:
   - Uptime recently reset (seconds/minutes)
   - Memory usage reasonable (<200 MB for small deployments)

#### Troubleshooting Performance Issues

1. **High Memory Usage**:
   - Check RSS vs Heap (if RSS >> Heap, native modules issue)
   - Review active scraper jobs (memory-intensive)
   - Consider increasing server resources

2. **Degraded Health**:
   - Check pending migrations → restart server
   - Review logs for error details
   - Verify database connectivity

3. **Unexpected Data Counts**:
   - Zero showtimes after scraping → check scraper logs
   - Duplicate films → check scraper deduplication logic
   - Missing cinemas → verify `cinemas.json` configuration

---

## Configuration Management


### Export Configuration

**Purpose**: Create a backup of all settings for disaster recovery or migration.

**Steps**:
1. Click "Export Configuration" button at bottom of admin panel
2. JSON file downloads automatically: `allo-scrapper-settings-YYYY-MM-DD.json`
3. Store file securely

**Export Contents**:
```json
{
  "version": "1.0",
  "exported_at": "2026-03-01T15:30:00.000Z",
  "settings": {
    "site_name": "My Cinema Portal",
    "logo_base64": "data:image/png;base64,...",
    "color_primary": "#FECC00",
    ...
  }
}
```

**Use Cases**:
- Backup before major changes
- Migration to new server
- Duplicate configuration across environments (dev → staging → prod)
- Version control of branding settings

### Import Configuration

**Purpose**: Restore settings from a previously exported JSON file.

**Steps**:
1. Click "Import Configuration" button
2. Select JSON file from file picker
3. Confirm import action
4. Settings applied immediately

**Validation**:
- File must be valid JSON
- Must contain `version` and `settings` fields
- Invalid files rejected with error message

**Safety**:
- Current settings are overwritten (export first!)
- Invalid values skipped with warnings
- Transaction-based (all-or-nothing)

### Reset to Defaults

**Purpose**: Restore original Allo-Scrapper branding.

**Steps**:
1. Click "Reset to Defaults" button
2. Confirm action in dialog
3. All settings reset to defaults

**Default Values**:
- Site name: "Allo-Scrapper"
- Colors: Yellow primary (#FECC00), dark gray secondary (#1F2937)
- Fonts: System fonts
- Logo/favicon: Removed
- Footer: Default text

⚠️ **Warning**: Cannot be undone. Export settings before resetting!

---

## User Management

**Location**: `/admin/users` (future feature - in development)

Manage user accounts and roles.

### Viewing Users

1. Navigate to "Users" tab in admin panel
2. View table of all users:
   - Username
   - Role (admin/user)
   - Created date
   - Actions

### Creating a User

1. Click "+ Create User" button
2. Fill in form:
   - **Username**: 3-15 characters, alphanumeric only
   - **Password**: Minimum 8 characters
   - **Role**: Select from dropdown (admin, operator, or custom roles)
3. Click "Create User"

**Password Requirements**:
- Real-time visual validation with red/green indicators for each constraint
- Minimum 8 characters
- Must contain at least:
  - One uppercase letter
  - One lowercase letter
  - One digit
  - One special character
- Recommended: Mix of letters, numbers, symbols
- Hashed with bcrypt (never stored plaintext)

### Editing a User

1. Click "Edit" button next to user
2. Available actions:
   - **Change Role**: Select from dropdown of available roles (admin, operator, custom roles)
   - **Reset Password**: Generate new secure password (shown once)

**Safety Guards**:
- Cannot demote last admin to user
- Cannot delete last admin
- Cannot delete your own account (self-deletion prevention)

### Deleting a User

1. Click "Delete" button next to user
2. Confirm deletion
3. User and all associated data removed

**Restrictions**:
- Cannot delete last admin user
- Cannot delete yourself

---

## Best Practices

### Security

1. **Change default password immediately**:
   ```bash
   # After first login:
   User Menu → Change Password → Enter new secure password
   ```

2. **Create backup admin account**:
   - Create second admin user before making changes
   - Prevents lockout if primary admin has issues

3. **Use strong passwords**:
   - Minimum 12 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Avoid common words or patterns

4. **Limit admin access**:
   - Only grant admin role to trusted users
   - Regular users can view schedules without admin rights

### Branding

1. **Export before major changes**:
   ```bash
   Admin Panel → Export Configuration → Save JSON file
   ```

2. **Test in staging first**:
   - If using multi-environment setup
   - Verify appearance before applying to production

3. **Optimize images**:
   - Compress logo/favicon before upload
   - Use tools like TinyPNG, ImageOptim
   - Target: Logo <100KB, Favicon <20KB

4. **Use high contrast colors**:
   - WCAG AA standard: 4.5:1 contrast for normal text
   - WCAG AAA standard: 7:1 contrast (ideal)
   - Test with tools like WebAIM Contrast Checker

5. **Choose readable fonts**:
   - Body text: Use fonts designed for readability (Inter, Open Sans, Roboto)
   - Headings: Can be more decorative (Montserrat, Poppins, Raleway)
   - Avoid overly decorative fonts for long-form text

6. **Maintain brand consistency**:
   - Use company brand guidelines
   - Keep color palette limited (primary + 2-3 supporting colors)
   - Use same fonts throughout

### Configuration Management

1. **Regular backups**:
   - Export settings monthly
   - Store in version control (Git)
   - Keep off-site backup

2. **Document changes**:
   - Keep changelog of branding updates
   - Note reasons for changes
   - Track who made changes (automatic via `updated_by`)

3. **Test imports**:
   - Test import in staging before production
   - Verify all settings apply correctly

---

## Troubleshooting

### Common Issues

#### Images Not Uploading

**Symptoms**: Error message when trying to upload logo or favicon.

**Solutions**:
1. **Check file size**:
   - Logo: Max 200KB
   - Favicon: Max 50KB
   - Use image compression tools

2. **Verify format**:
   - Logo: PNG, JPG, SVG only
   - Favicon: ICO, PNG only

3. **Check dimensions**:
   - Logo: Minimum 100x100 pixels
   - Favicon: 32x32 or 64x64 pixels

4. **Browser console**:
   - Open DevTools (F12)
   - Check Console tab for error messages

#### Settings Not Saving

**Symptoms**: Click "Save Changes" but settings don't persist.

**Solutions**:
1. **Check authentication**:
   - Logout and login again
   - Verify admin role (not regular user)

2. **Browser console**:
   - Open DevTools (F12) → Network tab
   - Look for API request to `/api/settings`
   - Check response for error messages

3. **Validation errors**:
   - Ensure all colors are valid hex codes
   - Check that URLs start with `http://` or `https://`
   - Verify image sizes are within limits

4. **Clear browser cache**:
   - Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

#### Theme Not Applying to Frontend

**Symptoms**: Changed settings in admin panel but website still shows old branding.

**Solutions**:
1. **Hard refresh browser**:
   - Ctrl+F5 (Windows/Linux)
   - Cmd+Shift+R (Mac)

2. **Clear browser cache**:
   - Settings → Privacy → Clear browsing data
   - Select "Cached images and files"

3. **Check theme CSS endpoint**:
   ```bash
   curl http://localhost:3000/api/theme.css
   ```
   - Should show updated CSS variables
   - If outdated, restart server

4. **Verify settings API**:
   ```bash
   curl http://localhost:3000/api/settings
   ```
   - Should return updated settings
   - If old data, check database

#### Cannot Delete User

**Symptoms**: Error when trying to delete a user.

**Solutions**:
1. **Last admin protection**:
   - Cannot delete the only admin user
   - Create another admin first, then delete

2. **Self-deletion prevention**:
   - Cannot delete your own account
   - Login with different admin to delete

3. **Check role**:
   - Must be logged in as admin
   - Regular users cannot delete accounts

#### Forgot Admin Password

**Solutions**:
1. **Database password reset** (requires database access):
   ```bash
   # Connect to database
   docker compose exec ics-db psql -U postgres -d ics

   # Reset admin password to 'newpassword'
   # (Generate hash with: bcrypt.hash('newpassword', 10))
   UPDATE users SET password_hash = '$2b$10$...' WHERE username = 'admin';
   ```

2. **Create new admin via database**:
   ```bash
   # Connect to database
   docker compose exec ics-db psql -U postgres -d ics

   # Create new admin
   INSERT INTO users (username, password_hash, role)
   VALUES ('recovery', '$2b$10$...', 'admin');
   ```

3. **Contact system administrator** for enterprise deployments

---

## Getting Help

### Documentation

- **API Reference**: [API Overview](../../reference/api/README.md) - Complete API documentation
- **Settings API**: [Settings API](../../reference/api/settings.md) - Settings endpoints
- **Users API**: [Users API](../../reference/api/users.md) - User management endpoints
- **Installation Guide**: [Installation](../../getting-started/installation.md) - Environment and configuration
- **Database Schema**: [Database Reference](../../reference/database/) - Data models
- **Troubleshooting**: [Common Issues](../../troubleshooting/common-issues.md) - Common issues

### Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/PhBassin/allo-scrapper/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/PhBassin/allo-scrapper/discussions)

---

## Related Documentation

- [Quick Start](../../getting-started/quick-start.md) - Get started quickly
- [Settings API](../../reference/api/settings.md) - Settings API reference
- [Users API](../../reference/api/users.md) - Users API reference
- [Contributing](../development/contributing.md) - Development guidelines
- [Production Deployment](../deployment/production.md) - Production deployment guide

---

[← Back to Administration](./README.md) | [Back to Documentation](../../README.md)
