# White-Label Configuration

Guide to customizing your cinema showtimes application branding through the admin panel.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Accessing Settings](#accessing-settings)
- [General Settings](#general-settings)
- [Color Scheme](#color-scheme)
- [Typography](#typography)
- [Footer Configuration](#footer-configuration)
- [Email Branding](#email-branding)
- [Theme Preview](#theme-preview)
- [Saving and Applying Changes](#saving-and-applying-changes)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Related Documentation](#related-documentation)

---

## Overview

The white-label system allows you to completely customize your cinema application's appearance and branding. You can modify:

- **Site name and logos** - Replace default branding with your own
- **Color scheme** - 9 customizable colors for complete visual control
- **Typography** - Choose from 15+ Google Fonts for headings and body text
- **Footer content** - Custom text and navigation links
- **Email templates** - Branded email communications

**Who should use this guide:**
- Cinema operators customizing their portal
- Administrators managing branding
- Non-technical staff updating visual elements

**What you need:**
- Admin account access
- Basic understanding of colors (hex codes helpful but not required)
- Logo and favicon files (optional)

---

## Accessing Settings

### Step 1: Login as Admin

1. Navigate to your application homepage
2. Click **"Login"** in the top-right corner
3. Enter admin credentials:
   - **Username**: `admin` (or your custom admin username)
   - **Password**: Your admin password
4. Click **"Login"**

> **⚠️ Security Note**: Change the default admin password immediately after first login!

### Step 2: Access Admin Settings

1. Click your username in the top-right corner
2. Select **"Admin Settings"** from the dropdown menu
3. You'll be taken to `/admin/settings` with five configuration tabs

**Authentication Required**: Only users with admin role can access these settings.

---

## General Settings

Configure core branding elements that appear throughout your application.

### Site Name

**Purpose**: Your cinema portal's name displayed in the header, page titles, and footer.

**How to change:**
1. Navigate to the **"General"** tab
2. Find the **"Site Name"** field
3. Enter your desired name (e.g., "CinéParis", "Downtown Cinema Hub")
4. Click **"Save Changes"**

**Where it appears:**
- Browser tab title
- Header navigation
- Footer copyright text
- Email templates (when using `{site_name}` placeholder)

### Logo Upload

**Purpose**: Replace the default 🎬 emoji with your custom logo in the header.

**Requirements:**
- **Formats**: PNG, JPG, SVG
- **Maximum size**: 200KB
- **Minimum dimensions**: 100x100 pixels
- **Recommended**: 300x80 pixels for optimal header appearance

**How to upload:**
1. In the **"General"** tab, find the **"Logo"** section
2. **Drag and drop** your logo file onto the upload area, OR
3. Click **"Choose file"** to browse and select your logo
4. Preview appears below the upload area
5. Click **"Save Changes"** to apply

**To remove logo:**
- Click **"Remove Logo"** button to return to default emoji

> **💡 Tip**: Use transparent PNG files for best results. Optimize images before upload to stay under the 200KB limit.

### Favicon Upload

**Purpose**: Custom icon that appears in browser tabs and bookmarks.

**Requirements:**
- **Formats**: ICO (recommended), PNG
- **Maximum size**: 50KB
- **Dimensions**: 32x32 or 64x64 pixels

**How to upload:**
1. In the **"General"** tab, find the **"Favicon"** section
2. Upload using drag-and-drop or file browser
3. Preview shows how the favicon will appear
4. Click **"Save Changes"**

> **💡 Tip**: Use ICO format for best browser compatibility. Include multiple sizes (16x16, 32x32, 64x64) in a single ICO file for crisp display across devices.

---

## Color Scheme

Customize your application's complete color palette with 9 theme variables.

### Available Colors

| Color | Purpose | Default | Usage Examples |
|-------|---------|---------|----------------|
| **Primary** | Brand color, main actions | `#FECC00` | Action buttons, active navigation |
| **Secondary** | Headers and footers | `#1F2937` | Navigation bars, footer background |
| **Accent** | Call-to-action highlights | `#3B82F6` | Important buttons, badges |
| **Background** | Page background | `#F9FAFB` | Main page background |
| **Surface** | Card backgrounds | `#FFFFFF` | Film cards, modal windows |
| **Text Primary** | Main text | `#111827` | Headings, body text |
| **Text Secondary** | Muted text | `#6B7280` | Labels, captions, metadata |
| **Success** | Success messages | `#10B981` | Success notifications |
| **Error** | Error messages | `#EF4444` | Error alerts, warnings |

### Using the Color Picker

1. Navigate to the **"Colors"** tab
2. Click any color swatch to open the color picker
3. **Choose color visually**: Drag the selector in the color picker
4. **Enter hex code**: Type directly (e.g., `#FF5733`, `#FFF`)
5. **Preview changes**: See color applied in the preview area
6. **Reset if needed**: Click "Reset to Default" for any color
7. Click **"Save Changes"** to apply all color updates

**Format Requirements:**
- Must be valid hex color code
- Include the `#` prefix
- Accepts 3-digit (`#FFF`) or 6-digit (`#FFFFFF`) format

### Accessibility Guidelines

- **High contrast**: Maintain 4.5:1 contrast ratio between text and background colors
- **Color-blind friendly**: Avoid red-green combinations
- **Test thoroughly**: Check readability across different screen types

> **💡 Tip**: Use online tools like WebAIM Contrast Checker to verify your color combinations meet accessibility standards.

---

## Typography

Choose fonts for headings and body text from Google Fonts library.

### Font Categories

**Heading Font:**
- Applied to: h1, h2, h3, h4, h5, h6 elements
- Use for: Page titles, section headers, navigation

**Body Font:**
- Applied to: Paragraph text, UI elements, buttons
- Use for: Main content, form labels, interface text

### Available Google Fonts

The system includes 15+ carefully selected fonts:

**Modern & Clean:**
- **Inter** - Geometric sans-serif, excellent for body text
- **Roboto** - Google's signature font, great readability
- **Open Sans** - Friendly and professional
- **Work Sans** - Optimized for screen display

**Elegant & Sophisticated:**
- **Montserrat** - Urban geometric, perfect for headings
- **Raleway** - Thin and elegant
- **Poppins** - Geometric with rounded terminals
- **Lato** - Warm yet serious

**Friendly & Approachable:**
- **Nunito** - Rounded and friendly
- **DM Sans** - Low contrast geometric
- **Plus Jakarta Sans** - Contemporary neo-grotesque

### How to Change Fonts

1. Navigate to the **"Typography"** tab
2. **For headings**: Select from "Heading Font" dropdown
3. **For body text**: Select from "Body Font" dropdown
4. **Preview**: See fonts rendered in the preview area
5. Click **"Save Changes"** to apply

**Performance Note**: Google Fonts are automatically loaded from CDN - no manual setup required.

### Font Pairing Recommendations

**Professional Combinations:**
- Montserrat (headings) + Open Sans (body)
- Raleway (headings) + Lato (body)
- Poppins (headings) + Inter (body)

**Best Practices:**
- Limit to 2 fonts maximum (heading + body)
- Pair geometric headings with humanist body fonts
- Test readability with long-form content
- Consider your brand personality (modern vs. traditional)

---

## Footer Configuration

Customize footer text and navigation links.

### Footer Text

**Purpose**: Main footer message with dynamic placeholders.

**Available Placeholders:**
- `{site_name}` - Replaced with your site name
- `{year}` - Replaced with current year (e.g., 2026)

**How to customize:**
1. Navigate to the **"Footer"** tab
2. Find the **"Footer Text"** field
3. Enter your message using placeholders
4. Click **"Save Changes"**

**Examples:**
```
{site_name} © {year} - All rights reserved
→ "CinéParis © 2026 - All rights reserved"

Cinema schedules by {site_name} - Updated weekly
→ "Cinema schedules by Downtown Cinema - Updated weekly"
```

### Footer Links

**Purpose**: Custom navigation links (Privacy Policy, Terms, Contact, etc.)

**How to manage links:**

**Adding a Link:**
1. Click **"+ Add Link"** button
2. Enter **Label** (e.g., "Privacy Policy")
3. Enter **URL** (e.g., `https://example.com/privacy`)
4. Link appears in footer immediately

**Editing a Link:**
1. Click the link in the list
2. Modify label or URL in the form
3. Changes save automatically

**Removing a Link:**
1. Click **"Remove"** button next to the link
2. Confirm deletion

**Reordering Links:**
1. Drag links by the handle icon (⋮⋮)
2. Drop in desired position
3. Footer updates automatically

**Link Requirements:**
- URLs must start with `http://` or `https://`
- Labels must be 1-50 characters
- Invalid entries are highlighted in red
- Recommended: 3-5 links for clean layout

---

## Email Branding

Configure email template branding for system-generated communications.

### Email Settings

**Email From Name:**
- **Purpose**: Sender name in email "From" field
- **Example**: "CinéParis Notifications"
- **Default**: "Allo-Scrapper"

**Email From Address:**
- **Purpose**: Sender email address
- **Format**: Valid email (e.g., `noreply@example.com`)
- **Validation**: Must be proper email format

**Email Header Color:**
- **Purpose**: Background color for email template header
- **Format**: Hex color code
- **Default**: `#FECC00` (matches primary color)

**Email Footer Text:**
- **Purpose**: Footer message in email templates
- **Example**: "You received this email from CinéParis"

### How to Configure

1. Navigate to the **"Email Branding"** tab
2. Fill in each field with your organization's details
3. Use the color picker for header color
4. Click **"Save Changes"**

> **📧 Note**: Email features are prepared for future notifications (password resets, reports, etc.). Currently not actively sending emails unless specifically configured.

---

## Theme Preview

### Live Preview

As you make changes in any tab, you can see a live preview of how your customizations will appear:

- **Color changes**: Immediately reflected in preview area
- **Font changes**: Sample text shows selected fonts
- **Logo/favicon**: Preview images display below upload areas

### Testing Your Theme

**Before saving major changes:**

1. **Preview endpoint**: Visit `/api/theme.css` to see generated CSS
2. **Test on different pages**: Navigate through your application
3. **Check mobile responsiveness**: Test on various screen sizes
4. **Verify accessibility**: Ensure text remains readable

**Browser testing:**
- Clear cache and hard refresh (Ctrl+F5 or Cmd+Shift+R)
- Test in different browsers (Chrome, Firefox, Safari)
- Check on mobile devices

---

## Saving and Applying Changes

### Save Changes

**How it works:**
1. Make your customizations in any tab
2. Click **"Save Changes"** button at the bottom
3. Changes apply immediately across your application
4. No server restart required

### Configuration Management

**Export Configuration:**
1. Click **"Export Configuration"** at bottom of admin panel
2. JSON file downloads: `allo-scrapper-settings-YYYY-MM-DD.json`
3. Store securely for backup or migration

**Import Configuration:**
1. Click **"Import Configuration"**
2. Select previously exported JSON file
3. Confirm import - settings apply immediately

**Reset to Defaults:**
1. Click **"Reset to Defaults"**
2. Confirm action in dialog
3. All settings return to original Allo-Scrapper branding

> **⚠️ Warning**: Reset cannot be undone. Export your settings before resetting!

---

## Best Practices

### Image Optimization

**Before uploading:**
- Compress images using tools like TinyPNG or ImageOptim
- Target sizes: Logo <100KB, Favicon <20KB
- Use transparent PNG for logos
- Test logo appearance on different screen sizes

### Color Selection

**Accessibility first:**
- Maintain WCAG AA standard (4.5:1 contrast ratio)
- Test with color-blind simulation tools
- Avoid red-green combinations

**Brand consistency:**
- Use your organization's brand guidelines
- Limit color palette (primary + 2-3 supporting colors)
- Document your color choices for future reference

### Typography

**Readability focus:**
- Use fonts designed for screen reading (Inter, Open Sans, Roboto)
- Avoid overly decorative fonts for body text
- Test with long-form content
- Ensure fonts load quickly

### Configuration Management

**Regular backups:**
- Export settings monthly
- Store in version control (Git)
- Keep off-site backup
- Document changes with reasons

**Testing workflow:**
1. Export current settings (backup)
2. Make changes in staging environment first
3. Test thoroughly before production
4. Import to production when verified

---

## Troubleshooting

### Images Not Uploading

**Symptoms**: Error message when uploading logo or favicon.

**Solutions:**

1. **Check file size:**
   - Logo: Maximum 200KB
   - Favicon: Maximum 50KB
   - Use image compression tools if needed

2. **Verify format:**
   - Logo: PNG, JPG, SVG only
   - Favicon: ICO, PNG only

3. **Check dimensions:**
   - Logo: Minimum 100x100 pixels
   - Favicon: 32x32 or 64x64 pixels

4. **Browser console check:**
   - Press F12 to open Developer Tools
   - Check Console tab for error messages

### Settings Not Saving

**Symptoms**: Click "Save Changes" but settings don't persist.

**Solutions:**

1. **Verify admin access:**
   - Logout and login again
   - Confirm you have admin role (not regular user)

2. **Check browser console:**
   - Open DevTools (F12) → Network tab
   - Look for API request to `/api/settings`
   - Check response for error messages

3. **Validation errors:**
   - Ensure all colors are valid hex codes
   - Verify URLs start with `http://` or `https://`
   - Check image sizes are within limits

4. **Clear browser cache:**
   - Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

### Theme Not Applying

**Symptoms**: Changed settings but website shows old branding.

**Solutions:**

1. **Hard refresh browser:**
   - Ctrl+F5 (Windows/Linux)
   - Cmd+Shift+R (Mac)

2. **Clear browser cache:**
   - Settings → Privacy → Clear browsing data
   - Select "Cached images and files"

3. **Verify theme endpoint:**
   - Visit `/api/theme.css` directly
   - Should show updated CSS variables
   - If outdated, contact system administrator

### Colors Not Displaying Correctly

**Symptoms**: Colors appear different than expected.

**Solutions:**

1. **Check hex code format:**
   - Must include `#` prefix
   - Use 6-digit format for precision (`#FFFFFF` not `#FFF`)

2. **Monitor calibration:**
   - Colors may appear different on various screens
   - Test on multiple devices

3. **Browser compatibility:**
   - Some older browsers may not support CSS custom properties
   - Encourage users to update browsers

---

## Related Documentation

- **[Admin Panel Guide](./admin-panel.md)** - Complete admin panel user guide
- **[Settings API Reference](../../reference/api/settings.md)** - Technical API documentation
- **[White-Label Technical Reference](../../../WHITE-LABEL.md)** - Developer implementation details
- **[User Management](./user-management.md)** - Managing user accounts and roles
- **[Installation Guide](../../getting-started/installation.md)** - Environment setup

---

**Last updated:** March 18, 2026 | Status: Current ✅

[← Back to Administration](./README.md) | [Back to Documentation](../../README.md)