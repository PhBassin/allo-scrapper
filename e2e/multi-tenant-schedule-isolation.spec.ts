import { test, expect, assertFixtureRuntimeWithinLimit } from './fixtures/org-fixture';

const useOrgFixture = process.env['E2E_ENABLE_ORG_FIXTURE'] === 'true';

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: {
      org_slug?: string;
    };
  };
}

interface TheatersResponse {
  success: boolean;
  data: Array<{ id: string; name: string }>;
}

test.describe('Multi-tenant schedule isolation', () => {
  test.skip(!useOrgFixture, 'Requires fixture-backed SaaS runtime (E2E_ENABLE_ORG_FIXTURE=true)');

  test('org A only sees org A schedules and gets forbidden for org B schedule route', async ({ page, request, seedTestOrg }) => {
    const startedAt = Date.now();
    const orgA = await seedTestOrg();
    const orgB = await seedTestOrg();

    const orgALogin = await request.post('/api/auth/login', {
      data: {
        username: orgA.admin.username,
        password: orgA.admin.password,
      },
    });
    expect(orgALogin.ok()).toBe(true);
    const orgALoginBody = await orgALogin.json() as LoginResponse;
    const orgAToken = orgALoginBody.data.token;
    expect(orgALoginBody.data.user.org_slug).toBe(orgA.orgSlug);

    const orgBLogin = await request.post('/api/auth/login', {
      data: {
        username: orgB.admin.username,
        password: orgB.admin.password,
      },
    });
    expect(orgBLogin.ok()).toBe(true);
    const orgBLoginBody = await orgBLogin.json() as LoginResponse;
    const orgBToken = orgBLoginBody.data.token;
    expect(orgBLoginBody.data.user.org_slug).toBe(orgB.orgSlug);

    const orgATheatersResponse = await request.get(`/api/org/${orgA.orgSlug}/theaters`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    });
    expect(orgATheatersResponse.ok()).toBe(true);
    const orgATheatersBody = await orgATheatersResponse.json() as TheatersResponse;
    const orgAFirstTheater = orgATheatersBody.data.find((theater) => theater.name === `Fixture Theater 1 (${orgA.orgSlug})`);
    expect(orgAFirstTheater).toBeDefined();

    const orgBTheatersResponse = await request.get(`/api/org/${orgB.orgSlug}/theaters`, {
      headers: { Authorization: `Bearer ${orgBToken}` },
    });
    expect(orgBTheatersResponse.ok()).toBe(true);
    const orgBTheatersBody = await orgBTheatersResponse.json() as TheatersResponse;
    const orgBFirstTheater = orgBTheatersBody.data.find((theater) => theater.name === `Fixture Theater 1 (${orgB.orgSlug})`);
    expect(orgBFirstTheater).toBeDefined();

    const orgAFirstTheaterId = orgAFirstTheater!.id;
    const orgBFirstTheaterId = orgBFirstTheater!.id;

    await page.goto('/');
    await page.evaluate(([token, slug]) => {
      localStorage.setItem('token', token);
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: 1,
          username: 'impersonated-admin',
          role_id: 1,
          role_name: 'admin',
          is_system_role: false,
          permissions: ['theaters:read'],
          org_slug: slug,
        })
      );
    }, [orgAToken, orgA.orgSlug]);

    const scheduleResponsePromise = page.waitForResponse((response) => {
      return response.url().includes(`/api/org/${orgA.orgSlug}/theaters/${orgAFirstTheaterId}`)
        && response.request().method() === 'GET';
    });

    await page.goto(`/org/${orgA.orgSlug}/theater/${orgAFirstTheaterId}`);

    const scheduleCalendar = page.getByTestId('schedule-calendar');
    await expect(scheduleCalendar).toBeVisible();
    await expect(scheduleCalendar).toContainText(orgA.orgSlug);
    await expect(scheduleCalendar).not.toContainText(orgB.orgSlug);

    const scheduleResponse = await scheduleResponsePromise;
    expect(scheduleResponse.ok()).toBe(true);
    const schedulePayload = await scheduleResponse.json() as {
      success: boolean;
      data: {
        showtimes: Array<{
          theater_id: string;
          film: { title: string };
        }>;
      };
    };

    expect(schedulePayload.success).toBe(true);
    expect(schedulePayload.data.showtimes.length).toBeGreaterThan(0);
    expect(schedulePayload.data.showtimes.every((showtime) => showtime.theater_id === orgAFirstTheaterId)).toBe(true);
    expect(schedulePayload.data.showtimes.some((showtime) => showtime.theater_id === orgBFirstTheaterId)).toBe(false);
    expect(schedulePayload.data.showtimes.some((showtime) => showtime.film.title.includes(orgA.orgSlug))).toBe(true);
    expect(schedulePayload.data.showtimes.some((showtime) => showtime.film.title.includes(orgB.orgSlug))).toBe(false);

    const orgBDetailResponse = await request.get(`/api/org/${orgB.orgSlug}/theaters/${orgBFirstTheaterId}`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    });
    expect(orgBDetailResponse.status()).toBe(403);
    const orgBDetailPayload = await orgBDetailResponse.json() as { error?: string };
    expect(orgBDetailPayload.error).toBe('Access denied: organization mismatch');

    await page.evaluate((path) => {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, `/org/${orgB.orgSlug}/theater/${orgBFirstTheaterId}`);
    await expect(page.getByRole('heading', { name: '403' })).toBeVisible();
    await expect(page.getByText(/access denied: organization mismatch|cross-tenant access denied/i)).toBeVisible();

    assertFixtureRuntimeWithinLimit(startedAt);
  });
});
