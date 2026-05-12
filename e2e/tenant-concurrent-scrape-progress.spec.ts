import { test, expect, assertFixtureRuntimeWithinLimit } from './fixtures/org-fixture';

const useOrgFixture = process.env['E2E_ENABLE_ORG_FIXTURE'] === 'true';

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: {
      id: number;
      username: string;
      role_id: number;
      role_name: string;
      is_system_role: boolean;
      permissions: string[];
      org_slug?: string;
    };
  };
}

interface SeedTheaterResponse {
  success: boolean;
  data: Array<{ id: string; name: string; url?: string }>;
}

test.describe('Tenant concurrent scrape progress', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!useOrgFixture, 'Requires fixture-backed SaaS runtime (E2E_ENABLE_ORG_FIXTURE=true)');

  test('shows 10 tracked progress cards with isolated failure state', async ({ page, request, seedTestOrg }) => {
    test.setTimeout(150000);
    const startedAt = Date.now();
    const org = await seedTestOrg({ planId: 2 });

    const loginResponse = await request.post('/api/auth/login', {
      data: {
        username: org.admin.username,
        password: org.admin.password,
      },
    });
    expect(loginResponse.ok()).toBe(true);

    const loginBody = await loginResponse.json() as LoginResponse;
    const token = loginBody.data.token;

    const existingTheatersResponse = await request.get(`/api/org/${org.orgSlug}/theaters`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(existingTheatersResponse.ok()).toBe(true);
    const existingTheatersBody = await existingTheatersResponse.json() as SeedTheaterResponse;

    const seededFailureTheater = existingTheatersBody.data.find((theater) => theater.url?.includes('example.test'));
    expect(seededFailureTheater).toBeTruthy();

    const successfulTheaters = existingTheatersBody.data
      .filter((theater) => theater.url?.includes('allocine.fr'))
      .slice(0, 9);

    expect(successfulTheaters).toHaveLength(9);

    await page.goto('/');
    await page.evaluate(([savedToken, user]) => {
      localStorage.setItem('token', savedToken);
      localStorage.setItem('user', JSON.stringify(user));
    }, [
      token,
      {
        ...loginBody.data.user,
        org_slug: org.orgSlug,
      },
    ]);

    await page.goto(`/org/${org.orgSlug}/admin?tab=theaters`);
    await expect(page.getByTestId(`scrape-theater-${successfulTheaters[0]?.id}`)).toBeVisible({ timeout: 10000 });

    const progress = page.getByTestId('scrape-progress');
    const cards = page.getByTestId('scrape-progress-card');

    for (const [index, theater] of [...successfulTheaters, seededFailureTheater].entries()) {
      const button = page.getByTestId(`scrape-theater-${theater.id}`);
      await expect(button).toBeVisible({ timeout: 10000 });

      const triggerResponsePromise = page.waitForResponse((response) => {
        return response.request().method() === 'POST'
          && response.url().includes(`/api/org/${org.orgSlug}/scraper/trigger`);
      });

      await button.click();

      const triggerResponse = await triggerResponsePromise;
      expect(triggerResponse.ok()).toBe(true);

      if (index === 0) {
        await expect(progress).toBeVisible({ timeout: 10000 });
      }

      await expect(cards).toHaveCount(index + 1, { timeout: 15000 });
      await expect(progress.getByText(theater.name, { exact: true })).toBeVisible({ timeout: 15000 });
    }

    await expect(cards).toHaveCount(10, { timeout: 15000 });

    for (const theater of successfulTheaters) {
      await expect(progress.getByText(theater.name, { exact: true })).toBeVisible({ timeout: 15000 });
    }
    await expect(progress.getByText(seededFailureTheater.name, { exact: true })).toBeVisible({ timeout: 15000 });

    await expect(progress.getByTestId('scrape-progress-percentage').first()).toBeVisible({ timeout: 30000 });
    await expect(progress).toContainText(/en attente du premier evenement sse|en cours|termine|echec/i, { timeout: 30000 });

    await expect(progress.getByText(seededFailureTheater.name, { exact: true })).toBeVisible();
    await expect(progress).toContainText(/example\.test|no scraper strategy found|echec/i, { timeout: 120000 });

    await expect(page.getByTestId('scrape-status-completed')).toHaveCount(9, { timeout: 120000 });

    assertFixtureRuntimeWithinLimit(startedAt);
  });
});
