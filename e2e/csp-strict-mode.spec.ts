import { test, expect, assertFixtureRuntimeWithinLimit } from './fixtures/org-fixture';

/**
 * Story 5.2 — CSP Strict Mode Validation
 *
 * AC1: CSP header is present; script-src has no unsafe-inline / unsafe-eval.
 * AC2: Theme delivery uses external /api/theme.css only — no inline <style> body injection.
 * AC3: No securitypolicyviolation events during normal navigation with a custom theme active.
 *
 * The spec is serial because AC2/AC3 write settings state via the admin API.
 * Non-SaaS paths (AC1 + standalone AC2/AC3 sub-assertions) always run.
 * The fixture-backed theme scenarios are guarded by E2E_ENABLE_ORG_FIXTURE.
 */

const useOrgFixture = process.env['E2E_ENABLE_ORG_FIXTURE'] === 'true';

// ─── AC1: CSP header assertions (no live server state needed) ─────────────────

test.describe('CSP header assertions', () => {
  test('Content-Security-Policy header is present on app root', async ({ request }) => {
    const response = await request.get('/');
    const cspHeader = response.headers()['content-security-policy'];
    expect(cspHeader, 'Content-Security-Policy header must be set').toBeTruthy();
  });

  test('script-src does not contain unsafe-inline', async ({ request }) => {
    const response = await request.get('/');
    const cspHeader = response.headers()['content-security-policy'];
    expect(cspHeader).toBeTruthy();

    const scriptSrcMatch = cspHeader!.match(/script-src[^;]*/);
    expect(scriptSrcMatch, 'script-src directive must be present').toBeTruthy();
    const scriptSrc = scriptSrcMatch![0];

    expect(scriptSrc, "script-src must NOT contain 'unsafe-inline'").not.toContain("'unsafe-inline'");
  });

  test('script-src does not contain unsafe-eval', async ({ request }) => {
    const response = await request.get('/');
    const cspHeader = response.headers()['content-security-policy'];
    expect(cspHeader).toBeTruthy();

    const scriptSrcMatch = cspHeader!.match(/script-src[^;]*/);
    expect(scriptSrcMatch, 'script-src directive must be present').toBeTruthy();
    const scriptSrc = scriptSrcMatch![0];

    expect(scriptSrc, "script-src must NOT contain 'unsafe-eval'").not.toContain("'unsafe-eval'");
  });

  test('object-src is none and base-uri is self (defence-in-depth)', async ({ request }) => {
    const response = await request.get('/');
    const cspHeader = response.headers()['content-security-policy'];
    expect(cspHeader).toBeTruthy();

    expect(cspHeader, "object-src 'none' must be present").toContain("object-src 'none'");
    expect(cspHeader, "base-uri 'self' must be present").toContain("base-uri 'self'");
  });
});

// ─── AC2 + AC3: theme injection + violation detection (fixture-backed) ─────────

test.describe.serial('CSP theme delivery and violation detection', () => {
  test.skip(!useOrgFixture, 'Requires fixture-backed SaaS runtime (E2E_ENABLE_ORG_FIXTURE=true)');

  test('no inline <style> tags injected into body when theme is active (AC2)', async ({
    page,
    request,
    seedTestOrg,
  }) => {
    const startedAt = Date.now();
    const org = await seedTestOrg();

    // Authenticate via API to apply a custom theme colour
    const loginResponse = await request.post('/api/auth/login', {
      data: { username: org.admin.username, password: org.admin.password },
    });
    expect(loginResponse.ok()).toBe(true);
    const { data: { token } } = await loginResponse.json() as { data: { token: string } };
    const authHeaders = { Authorization: `Bearer ${token}` };

    // Apply a custom primary colour so the theme endpoint generates real CSS
    const updateResponse = await request.put(`/api/org/${org.orgSlug}/settings/admin`, {
      headers: authHeaders,
      data: {
        site_name: 'CSP Test Org',
        color_primary: '#1D4ED8',
        color_secondary: '#1E3A8A',
        color_accent: '#F59E0B',
        color_background: '#FFFFFF',
        color_surface: '#F1F5F9',
        color_text_primary: '#111827',
        color_text_secondary: '#6B7280',
        color_success: '#16A34A',
        color_error: '#DC2626',
        font_primary: 'Inter',
        font_secondary: 'Inter',
        footer_text: 'CSP E2E test org',
        footer_links: [],
      },
    });
    expect(updateResponse.ok()).toBe(true);

    await page.goto(`/org/${org.orgSlug}`);
    await page.waitForLoadState('networkidle');

    // AC2a: no inline <style> elements in the document body
    const inlineStyleCount = await page.evaluate(
      () => document.querySelectorAll('body style').length,
    );
    expect(inlineStyleCount, 'No inline <style> tags should be injected into the body').toBe(0);

    // AC2b: the dynamic-theme <link> element is present and points to /api/.../theme.css
    const themeLink = page.locator('link#dynamic-theme');
    await expect(themeLink).toHaveCount(1);
    const href = await themeLink.getAttribute('href');
    expect(href, 'dynamic-theme link href must point to the theme CSS endpoint').toMatch(
      /\/api\/org\/[^/]+\/settings\/theme\.css/,
    );

    // AC2c: the link carries a cache-busting version param
    expect(href, 'dynamic-theme link href must carry a version query param').toContain('?v=');

    assertFixtureRuntimeWithinLimit(startedAt);
  });

  test('no CSP violations during navigation with custom theme active (AC3)', async ({
    page,
    request,
    seedTestOrg,
  }) => {
    const startedAt = Date.now();
    const org = await seedTestOrg();

    const loginResponse = await request.post('/api/auth/login', {
      data: { username: org.admin.username, password: org.admin.password },
    });
    expect(loginResponse.ok()).toBe(true);
    const { data: { token } } = await loginResponse.json() as { data: { token: string } };
    const authHeaders = { Authorization: `Bearer ${token}` };

    await request.put(`/api/org/${org.orgSlug}/settings/admin`, {
      headers: authHeaders,
      data: {
        site_name: 'CSP Violation Test',
        color_primary: '#7C3AED',
        color_secondary: '#4C1D95',
        color_accent: '#F59E0B',
        color_background: '#FAFAFA',
        color_surface: '#E5E7EB',
        color_text_primary: '#111827',
        color_text_secondary: '#6B7280',
        color_success: '#16A34A',
        color_error: '#DC2626',
        font_primary: 'Roboto',
        font_secondary: 'Georgia',
        footer_text: 'Violation test footer',
        footer_links: [],
      },
    });

    // Collect CSP violations via the browser's securitypolicyviolation event
    const cspViolations: string[] = [];
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e: SecurityPolicyViolationEvent) => {
        // Store in a window-level array so we can retrieve it after navigation
        (window as unknown as Record<string, unknown>)['__cspViolations'] =
          (window as unknown as Record<string, string[]>)['__cspViolations'] ?? [];
        (window as unknown as Record<string, string[]>)['__cspViolations'].push(
          `${e.violatedDirective}: blocked ${e.blockedURI}`,
        );
      });
    });

    // Also capture any browser console errors that mention CSP
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().toLowerCase().includes('content security policy')) {
        cspViolations.push(`[console] ${msg.text()}`);
      }
    });

    // Navigate through home, admin/settings, and login to exercise full theme rendering
    await page.goto(`/org/${org.orgSlug}`);
    await page.waitForLoadState('networkidle');

    await page.goto(`/org/${org.orgSlug}/login`);
    await page.waitForLoadState('networkidle');

    // Login and visit admin settings
    await page.fill('#username', org.admin.username);
    await page.fill('#password', org.admin.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`**/org/${org.orgSlug}`);

    await page.goto(`/org/${org.orgSlug}/admin?tab=settings`);
    await page.waitForLoadState('networkidle');

    // Retrieve any violations collected by the injected listener
    const browserViolations = await page.evaluate(
      () => (window as unknown as Record<string, string[]>)['__cspViolations'] ?? [],
    );
    cspViolations.push(...browserViolations);

    expect(
      cspViolations,
      `No CSP violations should occur during navigation. Found: ${cspViolations.join(', ')}`,
    ).toHaveLength(0);

    // AC3b: theme variables are still applied correctly despite strict CSP
    await page.goto(`/org/${org.orgSlug}`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);

    const rootVars = await page.evaluate(() => {
      const styles = window.getComputedStyle(document.documentElement);
      return {
        primary: styles.getPropertyValue('--theme-color-primary').trim(),
        heading: styles.getPropertyValue('--theme-font-heading').trim(),
      };
    });
    expect(rootVars.primary.toLowerCase()).toBe('#7c3aed');
    expect(rootVars.heading.toLowerCase()).toContain('roboto');

    assertFixtureRuntimeWithinLimit(startedAt);
  });
});
