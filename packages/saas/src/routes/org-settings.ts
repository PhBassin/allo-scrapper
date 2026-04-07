/**
 * Per-org white-label settings router.
 * 
 * Mounted at: /api/org/:slug/settings
 * 
 * Provides endpoints for managing org-specific customization:
 * - GET / — public settings (theming)
 * - GET /admin — full settings (admin only)
 * - PUT /admin — update settings (admin only)
 * - POST /admin/reset — reset to defaults (admin only)
 * - GET /theme.css — dynamic CSS from org colors
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { OrgSettingsService } from '../services/org-settings-service.js';
import type { DB, OrgSettingsUpdate } from '../db/types.js';

const router = Router();

// Validation constants
const VALID_SCRAPE_MODES = ['daily', 'weekly', 'manual'];
const SCRAPE_DAYS_MIN = 1;
const SCRAPE_DAYS_MAX = 30;

const INPUT_LIMITS = {
  site_name: 100,
  footer_text: 500,
  email_from_name: 100,
  email_from_address: 255,
  font_primary: 100,
  font_secondary: 100,
} as const;

/**
 * GET /api/org/:slug/settings
 * Returns public settings for theming (no authentication required)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbClient as unknown as DB;
    const service = new OrgSettingsService(db);
    const settings = await service.getPublicSettings();

    if (!settings) {
      res.status(404).json({ error: 'Settings not found' });
      return;
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/org/:slug/settings/admin
 * Returns full settings including email configuration (admin only)
 */
router.get('/admin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbClient as unknown as DB;
    const service = new OrgSettingsService(db);
    const settings = await service.getSettings();

    if (!settings) {
      res.status(404).json({ error: 'Settings not found' });
      return;
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/org/:slug/settings/admin
 * Update settings (admin only)
 */
router.put('/admin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbClient as unknown as DB;
    const updates: OrgSettingsUpdate = req.body;
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Validate input lengths
    for (const [field, limit] of Object.entries(INPUT_LIMITS)) {
      const value = updates[field as keyof OrgSettingsUpdate];
      if (typeof value === 'string' && value.length > limit) {
        res.status(400).json({
          error: `${field} exceeds maximum length of ${limit} characters`,
        });
        return;
      }
    }

    // Validate footer links URLs
    if (updates.footer_links && Array.isArray(updates.footer_links)) {
      for (const link of updates.footer_links) {
        if (link.url) {
          try {
            const parsedUrl = new URL(link.url, 'http://dummy.com');
            if (
              parsedUrl.protocol !== 'http:' &&
              parsedUrl.protocol !== 'https:' &&
              parsedUrl.protocol !== 'mailto:' &&
              parsedUrl.protocol !== 'tel:'
            ) {
              res.status(400).json({
                error: `Invalid URL protocol in footer link: ${link.url}`,
              });
              return;
            }
          } catch (e) {
            res.status(400).json({
              error: `Invalid URL format in footer link: ${link.url}`,
            });
            return;
          }
        }
      }
    }

    // Validate scrape_mode
    if (updates.scrape_mode !== undefined) {
      if (!VALID_SCRAPE_MODES.includes(updates.scrape_mode)) {
        res.status(400).json({
          error: `Invalid scrape_mode: must be one of ${VALID_SCRAPE_MODES.join(', ')}`,
        });
        return;
      }
    }

    // Validate scrape_days
    if (updates.scrape_days !== undefined) {
      const days = updates.scrape_days;
      if (!Number.isInteger(days) || days < SCRAPE_DAYS_MIN || days > SCRAPE_DAYS_MAX) {
        res.status(400).json({
          error: `Invalid scrape_days: must be an integer between ${SCRAPE_DAYS_MIN} and ${SCRAPE_DAYS_MAX}`,
        });
        return;
      }
    }

    const service = new OrgSettingsService(db);
    const updatedSettings = await service.updateSettings(updates, user.id);

    if (!updatedSettings) {
      res.status(500).json({ error: 'Failed to update settings' });
      return;
    }

    res.json({ success: true, data: updatedSettings });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/org/:slug/settings/admin/reset
 * Reset settings to default values (admin only)
 */
router.post('/admin/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbClient as unknown as DB;
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const service = new OrgSettingsService(db);
    const defaultSettings = await service.resetSettings(user.id);

    if (!defaultSettings) {
      res.status(500).json({ error: 'Failed to reset settings' });
      return;
    }

    res.json({ success: true, data: defaultSettings });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/org/:slug/settings/theme.css
 * Returns dynamic CSS generated from org color scheme (public)
 */
router.get('/theme.css', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = req.dbClient as unknown as DB;
    const service = new OrgSettingsService(db);
    const settings = await service.getPublicSettings();

    if (!settings) {
      res.status(404).send('/* Settings not found */');
      return;
    }

    const css = `
/* Auto-generated theme CSS for ${settings.site_name} */
:root {
  --color-primary: ${settings.color_primary};
  --color-secondary: ${settings.color_secondary};
  --font-primary: ${settings.font_primary}, sans-serif;
  --font-secondary: ${settings.font_secondary}, sans-serif;
}

body {
  font-family: var(--font-primary);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-secondary);
}
    `.trim();

    res.setHeader('Content-Type', 'text/css');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(css);
  } catch (error) {
    next(error);
  }
});

export default router;
