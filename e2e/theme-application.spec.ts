import { createHash } from 'node:crypto';
import { test, expect, assertFixtureRuntimeWithinLimit } from './fixtures/org-fixture';

const useOrgFixture = process.env['E2E_ENABLE_ORG_FIXTURE'] === 'true';

interface ThemeSettingsPayload {
  site_name: string;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  color_background: string;
  color_surface: string;
  color_text_primary: string;
  color_text_secondary: string;
  color_success: string;
  color_error: string;
  font_primary: string;
  font_secondary: string;
  footer_text: string;
  footer_links: [];
}

interface SettingsResponse {
  success: boolean;
  data: ThemeSettingsPayload;
}

interface ThemeExportResponse {
  success: boolean;
  data: {
    version: string;
    exported_at: string;
    exported_by: string;
    settings: ThemeSettingsPayload & {
      id?: number;
      site_name: string;
      updated_at?: string;
      updated_by?: string | number | null;
    };
  };
}

async function loginAsSeededAdmin(
  page: Parameters<typeof test>[0] extends never ? never : any,
  orgSlug: string,
  username: string,
  password: string,
) {
  await page.goto(`/org/${orgSlug}/login`);
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**/org/${orgSlug}`);
  await expect(page.getByTestId('home-page-title')).toBeVisible();
}

async function setColorField(
  page: Parameters<typeof test>[0] extends never ? never : any,
  label: string,
  value: string,
) {
  await page.getByLabel(label).evaluate((node, nextValue) => {
    const input = node as HTMLInputElement;
    input.value = nextValue as string;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

function buildFixtureFilmId(slug: string, index: number): number {
  const base = 100000 + (Number.parseInt(createHash('sha1').update(slug).digest('hex').slice(0, 6), 16) % 700000);
  return base + index - 1;
}

test.describe('White-Label Theme Application', () => {
  test.skip(!useOrgFixture, 'Requires fixture-backed SaaS runtime (E2E_ENABLE_ORG_FIXTURE=true)');

  test('applies seeded theme tokens to real tenant routes and visible UI', async ({ page, seedTestOrg }) => {
    const startedAt = Date.now();
    const org = await seedTestOrg();

    const themedSettings: ThemeSettingsPayload = {
      site_name: 'Sunset Cinema Club',
      color_primary: '#FF5733',
      color_secondary: '#0F172A',
      color_accent: '#F59E0B',
      color_background: '#F8FAFC',
      color_surface: '#E2E8F0',
      color_text_primary: '#111827',
      color_text_secondary: '#475569',
      color_success: '#16A34A',
      color_error: '#DC2626',
      font_primary: 'Poppins',
      font_secondary: 'Inter',
      footer_text: 'Sunset Cinema Club — séances de la semaine',
      footer_links: [],
    };

    const importedSettings: ThemeSettingsPayload = {
      ...themedSettings,
      site_name: 'Midnight Matinee Society',
      color_primary: '#2563EB',
      color_secondary: '#1E3A8A',
      font_primary: 'Roboto',
      font_secondary: 'Georgia',
      footer_text: 'Midnight Matinee Society — séances spéciales',
    };

    await loginAsSeededAdmin(page, org.orgSlug, org.admin.username, org.admin.password);
    await page.goto(`/org/${org.orgSlug}/admin?tab=settings`);
    await expect(page.getByRole('heading', { name: /white-label settings/i })).toBeVisible();

    await page.getByRole('button', { name: 'General' }).click();
    await page.getByPlaceholder('My Cinema Site').fill(themedSettings.site_name);

    await page.getByRole('button', { name: 'Colors' }).click();
    await setColorField(page, 'Primary Color', themedSettings.color_primary);
    await setColorField(page, 'Secondary Color', themedSettings.color_secondary);

    await page.getByRole('button', { name: 'Typography' }).click();
    await page.getByLabel('Heading Font').selectOption(themedSettings.font_primary);
    await page.getByLabel('Body Font').selectOption(themedSettings.font_secondary);

    await page.getByRole('button', { name: 'Footer' }).click();
    await page.getByPlaceholder('© 2024 My Cinema Site. All rights reserved.').fill(themedSettings.footer_text);

    const saveResponsePromise = page.waitForResponse((response) => {
      return response.url().includes(`/api/org/${org.orgSlug}/settings/admin`) && response.request().method() === 'PUT';
    });
    await page.getByTestId('save-settings-button').click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBe(true);
    await expect(page.locator('text=Settings saved successfully')).toBeVisible();

    await page.goto(`/org/${org.orgSlug}`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);

    const headerBrand = page.locator('header a').first();
    await expect(headerBrand).toContainText(themedSettings.site_name);
    await expect(headerBrand).not.toContainText('Allo-Scrapper');
    await expect(page.locator('footer')).toContainText(themedSettings.footer_text);
    await expect(page).toHaveTitle(themedSettings.site_name);
    await expect(page).not.toHaveTitle(/Allo-Scrapper/i);
    await expect(page.locator('link#dynamic-theme')).toHaveAttribute(
      'href',
      new RegExp(`/api/org/${org.orgSlug}/settings/theme\\.css\\?v=.+`),
    );

    const homeTitleStyles = await page.getByTestId('home-page-title').evaluate((node) => {
      const styles = window.getComputedStyle(node);
      return {
        fontFamily: styles.fontFamily,
      };
    });
    expect(homeTitleStyles.fontFamily.toLowerCase()).toContain('poppins');

    const rootThemeVariables = await page.evaluate(() => {
      const styles = window.getComputedStyle(document.documentElement);
      return {
        primary: styles.getPropertyValue('--theme-color-primary').trim(),
        heading: styles.getPropertyValue('--theme-font-heading').trim(),
        body: styles.getPropertyValue('--theme-font-body').trim(),
      };
    });
    expect(rootThemeVariables.primary.toLowerCase()).toBe(themedSettings.color_primary.toLowerCase());
    expect(rootThemeVariables.heading.toLowerCase()).toContain('poppins');
    expect(rootThemeVariables.body.toLowerCase()).toContain('inter');

    const headerStyles = await headerBrand.evaluate((node) => {
      const header = node.closest('header');
      const styles = header ? window.getComputedStyle(header) : null;
      return {
        backgroundColor: styles?.backgroundColor ?? null,
      };
    });
    expect(headerStyles.backgroundColor).toBe('rgb(15, 23, 42)');

    await page.goto(`/org/${org.orgSlug}/login`);
    await page.waitForLoadState('networkidle');

    const loginButtonStyles = await page.getByRole('button', { name: /sign in/i }).evaluate((node) => {
      const styles = window.getComputedStyle(node);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
      };
    });
    expect(loginButtonStyles.backgroundColor).toBe('rgb(255, 87, 51)');
    expect(loginButtonStyles.color).toBe('rgb(0, 0, 0)');

    const bodyFontFamily = await page.locator('body').evaluate((node) => window.getComputedStyle(node).fontFamily);
    expect(bodyFontFamily.toLowerCase()).toContain('inter');

    await loginAsSeededAdmin(page, org.orgSlug, org.admin.username, org.admin.password);
    await page.goto(`/org/${org.orgSlug}/admin?tab=settings`);
    await expect(page.getByRole('heading', { name: /white-label settings/i })).toBeVisible();

    const exportedSettingsPromise = page.waitForResponse((response) => {
      return response.url().includes(`/api/org/${org.orgSlug}/settings/export`) && response.request().method() === 'POST';
    });
    await page.getByTestId('export-settings-button').click();
    const exportedSettingsResponse = await exportedSettingsPromise;
    expect(exportedSettingsResponse.ok()).toBe(true);

    const importedPayload = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      exported_by: org.admin.username,
      settings: importedSettings,
    };

    page.once('dialog', (dialog) => dialog.accept());
    const importResponsePromise = page.waitForResponse((response) => {
      return response.url().includes(`/api/org/${org.orgSlug}/settings/import`) && response.request().method() === 'POST';
    });
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('import-settings-button').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'theme-import-second-pass.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importedPayload, null, 2)),
    });
    const importResponse = await importResponsePromise;
    expect(importResponse.ok()).toBe(true);

    await expect(page.locator('#site-name-input')).toHaveValue(importedSettings.site_name);

    const expectedFilmId = buildFixtureFilmId(org.orgSlug, 1);
    await page.goto(`/org/${org.orgSlug}/film/${expectedFilmId}`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);

    const filmTitleStyles = await page.locator('h1').first().evaluate((node) => {
      const styles = window.getComputedStyle(node);
      return {
        fontFamily: styles.fontFamily,
      };
    });
    expect(filmTitleStyles.fontFamily.toLowerCase()).toContain('roboto');

    await expect(page.locator('header a').first()).toContainText(importedSettings.site_name);
    await expect(page.locator('footer')).toContainText(importedSettings.footer_text);
    await expect(page.locator('footer')).not.toContainText(themedSettings.footer_text);

    const importedRootVariables = await page.evaluate(() => {
      const styles = window.getComputedStyle(document.documentElement);
      return {
        primary: styles.getPropertyValue('--theme-color-primary').trim(),
        heading: styles.getPropertyValue('--theme-font-heading').trim(),
        body: styles.getPropertyValue('--theme-font-body').trim(),
      };
    });
    expect(importedRootVariables.primary.toLowerCase()).toBe(importedSettings.color_primary.toLowerCase());
    expect(importedRootVariables.heading.toLowerCase()).toContain('roboto');
    expect(importedRootVariables.body.toLowerCase()).toContain('georgia');

    await page.goto(`/org/${org.orgSlug}/admin?tab=settings`);
    page.once('dialog', (dialog) => dialog.accept());
    const resetResponsePromise = page.waitForResponse((response) => {
      return response.url().includes(`/api/org/${org.orgSlug}/settings/admin/reset`) && response.request().method() === 'POST';
    });
    await page.getByTestId('reset-settings-button').click();
    const resetResponse = await resetResponsePromise;
    expect(resetResponse.ok()).toBe(true);

    await expect(page.locator('text=Settings saved successfully')).toBeVisible();

    await page.goto(`/org/${org.orgSlug}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('header a').first()).not.toContainText(importedSettings.site_name);
    await expect(page.locator('footer')).not.toContainText(importedSettings.footer_text);

    assertFixtureRuntimeWithinLimit(startedAt);
  });

  test('preserves legacy theme field names across export/import round-trip for a tenant admin', async ({ page, request, seedTestOrg }) => {
    const startedAt = Date.now();
    const org = await seedTestOrg();

    const loginResponse = await request.post('/api/auth/login', {
      data: {
        username: org.admin.username,
        password: org.admin.password,
      },
    });
    expect(loginResponse.ok()).toBe(true);
    const loginPayload = await loginResponse.json() as {
      success: boolean;
      data: { token: string };
    };
    const authHeaders = { Authorization: `Bearer ${loginPayload.data.token}` };

    const initialSettings: ThemeSettingsPayload = {
      site_name: 'Export Import Palace',
      color_primary: '#9333EA',
      color_secondary: '#111827',
      color_accent: '#F59E0B',
      color_background: '#FFFFFF',
      color_surface: '#CBD5E1',
      color_text_primary: '#1F2937',
      color_text_secondary: '#6B7280',
      color_success: '#10B981',
      color_error: '#EF4444',
      font_primary: 'Georgia',
      font_secondary: 'Arial',
      footer_text: 'Initial export footer',
      footer_links: [],
    };

    const initialUpdateResponse = await request.put(`/api/org/${org.orgSlug}/settings/admin`, {
      headers: authHeaders,
      data: initialSettings,
    });
    expect(initialUpdateResponse.ok()).toBe(true);

    await loginAsSeededAdmin(page, org.orgSlug, org.admin.username, org.admin.password);
    await page.goto(`/org/${org.orgSlug}/admin?tab=settings`);
    await expect(page.getByRole('heading', { name: /white-label settings/i })).toBeVisible();

    const exportedSettingsPromise = page.waitForResponse((response) => {
      return response.url().includes(`/api/org/${org.orgSlug}/settings/export`) && response.request().method() === 'POST';
    });
    await page.getByTestId('export-settings-button').click();
    const exportedSettingsResponse = await exportedSettingsPromise;
    expect(exportedSettingsResponse.ok()).toBe(true);
    const exportPayload = await exportedSettingsResponse.json() as ThemeExportResponse;

    expect(exportPayload.success).toBe(true);
    expect(exportPayload.data.settings.color_text_primary).toBe(initialSettings.color_text_primary);
    expect(exportPayload.data.settings.color_surface).toBe(initialSettings.color_surface);
    expect(exportPayload.data.settings.font_primary).toBe(initialSettings.font_primary);
    expect(exportPayload.data.settings.font_secondary).toBe(initialSettings.font_secondary);

    const importedPayload = {
      ...exportPayload.data,
      settings: {
        ...exportPayload.data.settings,
        site_name: 'Imported Theme Palace',
        color_primary: '#2563EB',
        color_surface: '#D1D5DB',
        color_text_primary: '#0F172A',
        font_primary: 'Roboto',
        font_secondary: 'Georgia',
        footer_text: 'Imported footer copy',
      },
    };

    const importResponsePromise = page.waitForResponse((response) => {
      return response.url().includes(`/api/org/${org.orgSlug}/settings/import`) && response.request().method() === 'POST';
    });
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('import-settings-button').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'theme-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importedPayload, null, 2)),
    });
    const importResponse = await importResponsePromise;
    expect(importResponse.ok()).toBe(true);

    await expect(page.locator('#site-name-input')).toHaveValue('Imported Theme Palace');

    await page.goto(`/org/${org.orgSlug}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('header a').first()).toContainText('Imported Theme Palace');
    await expect(page.locator('footer')).toContainText('Imported footer copy');

    const importedRootVariables = await page.evaluate(() => {
      const styles = window.getComputedStyle(document.documentElement);
      return {
        primary: styles.getPropertyValue('--theme-color-primary').trim(),
        heading: styles.getPropertyValue('--theme-font-heading').trim(),
        body: styles.getPropertyValue('--theme-font-body').trim(),
      };
    });
    expect(importedRootVariables.primary).toBe('#2563EB');
    expect(importedRootVariables.heading.toLowerCase()).toContain('roboto');
    expect(importedRootVariables.body.toLowerCase()).toContain('georgia');

    const persistedSettingsResponse = await request.get(`/api/org/${org.orgSlug}/settings/admin`, {
      headers: authHeaders,
    });
    expect(persistedSettingsResponse.ok()).toBe(true);
    const persistedPayload = await persistedSettingsResponse.json() as SettingsResponse;
    expect(persistedPayload.success).toBe(true);
    expect(persistedPayload.data.site_name).toBe('Imported Theme Palace');
    expect(persistedPayload.data.color_primary).toBe('#2563EB');
    expect(persistedPayload.data.font_primary).toBe('Roboto');
    expect(persistedPayload.data.font_secondary).toBe('Georgia');

    assertFixtureRuntimeWithinLimit(startedAt);
  });
});
