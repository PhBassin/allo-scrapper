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

interface CinemasResponse {
  success: boolean;
  data: Array<{ id: string; name: string }>;
}

test.describe('Multi-tenant cinema isolation', () => {
  test.skip(!useOrgFixture, 'Requires fixture-backed SaaS runtime (E2E_ENABLE_ORG_FIXTURE=true)');

  test('org A only sees org A cinemas and cannot access org B cinema details', async ({ page, request, seedTestOrg }) => {
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

    const orgBCinemasForId = await request.get(`/api/org/${orgB.orgSlug}/cinemas`, {
      headers: { Authorization: `Bearer ${orgBToken}` },
    });
    expect(orgBCinemasForId.ok()).toBe(true);
    const orgBCinemasForIdBody = await orgBCinemasForId.json() as CinemasResponse;
    const orgBFirstCinemaId = orgBCinemasForIdBody.data[0]?.id;
    expect(orgBFirstCinemaId).toBeTruthy();

    const orgASeededCinemas = await request.get(`/api/org/${orgA.orgSlug}/cinemas`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    });
    expect(orgASeededCinemas.ok()).toBe(true);
    const orgASeededCinemasBody = await orgASeededCinemas.json() as CinemasResponse;
    const orgACinemaIds = orgASeededCinemasBody.data.map((item) => item.id);
    const orgAExtraCinemaIds = orgACinemaIds.slice(2);

    for (const cinemaId of orgAExtraCinemaIds) {
      const deleteResponse = await request.delete(`/api/org/${orgA.orgSlug}/cinemas/${cinemaId}`, {
        headers: { Authorization: `Bearer ${orgAToken}` },
      });
      expect(deleteResponse.status()).toBe(204);
    }

    const orgAUiCinemasResponse = await request.get(`/api/org/${orgA.orgSlug}/cinemas`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    });
    expect(orgAUiCinemasResponse.ok()).toBe(true);
    const orgAUiCinemasBody = await orgAUiCinemasResponse.json() as CinemasResponse;
    const orgAUiCinemaIds = orgAUiCinemasBody.data.map((item) => item.id);

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
          permissions: ['cinemas:read', 'cinemas:create'],
          org_slug: slug,
        })
      );
    }, [orgAToken, orgA.orgSlug]);

    const responsePromise = page.waitForResponse((response) => {
      return response.url().includes(`/api/org/${orgA.orgSlug}/cinemas`) && response.request().method() === 'GET';
    });

    await page.goto(`/org/${orgA.orgSlug}/`);

    const cinemaList = page.getByTestId('cinema-list');
    await expect(cinemaList).toBeVisible();

    const cinemaItems = page.getByTestId('cinema-list-item');
    await expect(cinemaItems).toHaveCount(2);

    const orgAFirstCinemaText = await cinemaItems.first().textContent();
    expect(orgAFirstCinemaText).toContain(orgA.orgSlug);

    const orgBLeak = page.locator(`[data-testid="cinema-list-item"]:has-text("${orgB.orgSlug}")`);
    await expect(orgBLeak).toHaveCount(0);

    const cinemasResponse = await responsePromise;
    expect(cinemasResponse.ok()).toBe(true);

    const cinemasPayload = await cinemasResponse.json() as {
      success: boolean;
      data: Array<{ id: string; name: string }>;
    };
    expect(cinemasPayload.success).toBe(true);
    const names = cinemasPayload.data.map((item) => item.name);
    expect(names.length).toBe(2);
    expect(names.every((name) => name.includes(orgA.orgSlug))).toBe(true);
    expect(names.some((name) => name.includes(orgB.orgSlug))).toBe(false);
    const ids = cinemasPayload.data.map((item) => item.id);
    expect([...ids].sort()).toEqual([...orgAUiCinemaIds].sort());
    expect(ids).not.toContain(orgBFirstCinemaId);

    const orgBCinemasResponse = await request.get(`/api/org/${orgB.orgSlug}/cinemas`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    });

    expect(orgBCinemasResponse.status()).toBe(403);
    const orgBCinemasPayload = await orgBCinemasResponse.json() as { error?: string };
    expect(orgBCinemasPayload.error).toBe('Cross-tenant access denied');

    const orgBDetailResponse = await request.get(`/api/org/${orgB.orgSlug}/cinemas/${orgBFirstCinemaId}`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    });
    expect(orgBDetailResponse.status()).toBe(403);
    const orgBDetailPayload = await orgBDetailResponse.json() as { error?: string };
    expect(orgBDetailPayload.error).toBe('Cross-tenant access denied');

    await page.goto(`/org/${orgB.orgSlug}/cinema/${orgBFirstCinemaId}`);
    await expect(page.getByTestId('403-error-message')).toBeVisible();
    await expect(page.getByTestId('403-error-message')).toContainText(/cross-tenant access denied/i);

    assertFixtureRuntimeWithinLimit(startedAt);
  });
});
