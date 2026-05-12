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

test.describe('Multi-tenant theater isolation', () => {
  test.skip(!useOrgFixture, 'Requires fixture-backed SaaS runtime (E2E_ENABLE_ORG_FIXTURE=true)');

  test('org A only sees org A theaters and cannot access org B theater details', async ({ page, request, seedTestOrg }) => {
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

    const orgBTheatersForId = await request.get(`/api/org/${orgB.orgSlug}/theaters`, {
      headers: { Authorization: `Bearer ${orgBToken}` },
    });
    expect(orgBTheatersForId.ok()).toBe(true);
    const orgBTheatersForIdBody = await orgBTheatersForId.json() as TheatersResponse;
    const orgBFirstTheaterId = orgBTheatersForIdBody.data[0]?.id;
    expect(orgBFirstTheaterId).toBeTruthy();

    const orgASeededTheaters = await request.get(`/api/org/${orgA.orgSlug}/theaters`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    });
    expect(orgASeededTheaters.ok()).toBe(true);
    const orgASeededTheatersBody = await orgASeededTheaters.json() as TheatersResponse;
    const orgATheaterIds = orgASeededTheatersBody.data.map((item) => item.id);
    const orgAExtraTheaterIds = orgATheaterIds.slice(2);

    for (const theaterId of orgAExtraTheaterIds) {
      const deleteResponse = await request.delete(`/api/org/${orgA.orgSlug}/theaters/${theaterId}`, {
        headers: { Authorization: `Bearer ${orgAToken}` },
      });
      expect(deleteResponse.status()).toBe(204);
    }

    const orgAUiTheatersResponse = await request.get(`/api/org/${orgA.orgSlug}/theaters`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    });
    expect(orgAUiTheatersResponse.ok()).toBe(true);
    const orgAUiTheatersBody = await orgAUiTheatersResponse.json() as TheatersResponse;
    const orgAUiTheaterIds = orgAUiTheatersBody.data.map((item) => item.id);

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
          permissions: ['theaters:read', 'theaters:create'],
          org_slug: slug,
        })
      );
    }, [orgAToken, orgA.orgSlug]);

    const responsePromise = page.waitForResponse((response) => {
      return response.url().includes(`/api/org/${orgA.orgSlug}/theaters`) && response.request().method() === 'GET';
    });

    await page.goto(`/org/${orgA.orgSlug}/`);

    const theaterList = page.getByTestId('theater-list');
    await expect(theaterList).toBeVisible();

    const theaterItems = page.getByTestId('theater-list-item');
    await expect(theaterItems).toHaveCount(2);

    const orgAFirstTheaterText = await theaterItems.first().textContent();
    expect(orgAFirstTheaterText).toContain(orgA.orgSlug);

    const orgBLeak = page.locator(`[data-testid="theater-list-item"]:has-text("${orgB.orgSlug}")`);
    await expect(orgBLeak).toHaveCount(0);

    const theatersResponse = await responsePromise;
    expect(theatersResponse.ok()).toBe(true);

    const theatersPayload = await theatersResponse.json() as {
      success: boolean;
      data: Array<{ id: string; name: string }>;
    };
    expect(theatersPayload.success).toBe(true);
    const names = theatersPayload.data.map((item) => item.name);
    expect(names.length).toBe(2);
    expect(names.every((name) => name.includes(orgA.orgSlug))).toBe(true);
    expect(names.some((name) => name.includes(orgB.orgSlug))).toBe(false);
    const ids = theatersPayload.data.map((item) => item.id);
    expect([...ids].sort()).toEqual([...orgAUiTheaterIds].sort());
    expect(ids).not.toContain(orgBFirstTheaterId);

    const orgBTheatersResponse = await request.get(`/api/org/${orgB.orgSlug}/theaters`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    });

    expect(orgBTheatersResponse.status()).toBe(403);
    const orgBTheatersPayload = await orgBTheatersResponse.json() as { error?: string };
    expect(orgBTheatersPayload.error).toBe('Cross-tenant access denied');

    const orgBDetailResponse = await request.get(`/api/org/${orgB.orgSlug}/theaters/${orgBFirstTheaterId}`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    });
    expect(orgBDetailResponse.status()).toBe(403);
    const orgBDetailPayload = await orgBDetailResponse.json() as { error?: string };
    expect(orgBDetailPayload.error).toBe('Cross-tenant access denied');

    await page.goto(`/org/${orgB.orgSlug}/theater/${orgBFirstTheaterId}`);
    await expect(page.getByTestId('403-error-message')).toBeVisible();
    await expect(page.getByTestId('403-error-message')).toContainText(/cross-tenant access denied/i);

    assertFixtureRuntimeWithinLimit(startedAt);
  });
});
