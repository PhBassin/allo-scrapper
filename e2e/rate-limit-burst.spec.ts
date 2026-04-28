import type { APIRequestContext } from '@playwright/test';
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

async function loginSeededOrgAdmin(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<LoginResponse['data']> {
  const response = await request.post('/api/auth/login', {
    data: { username, password },
  });

  expect(response.ok()).toBe(true);
  const payload = await response.json() as LoginResponse;
  expect(payload.success).toBe(true);
  return payload.data;
}

test.describe('Rate Limiting Burst', () => {
  test.skip(!useOrgFixture, 'Requires fixture-backed SaaS runtime (E2E_ENABLE_ORG_FIXTURE=true)');

  test('allows three successful login bursts without triggering auth rate limits', async ({ request, seedTestOrg }) => {
    const startedAt = Date.now();
    const org = await seedTestOrg();

    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await request.post('/api/auth/login', {
        data: {
          username: org.admin.username,
          password: org.admin.password,
        },
      });

      expect(response.status()).toBe(200);
      const payload = await response.json() as LoginResponse;
      expect(payload.success).toBe(true);
      expect(payload.data.user.org_slug).toBe(org.orgSlug);
    }

    assertFixtureRuntimeWithinLimit(startedAt);
  });

  test('allows five rapid protected page refreshes without rate limiting the user', async ({ page, request, seedTestOrg }) => {
    const startedAt = Date.now();
    const org = await seedTestOrg();
    const login = await loginSeededOrgAdmin(request, org.admin.username, org.admin.password);
    const pingStatuses: number[] = [];

    page.on('response', (response) => {
      if (response.url().includes(`/api/org/${org.orgSlug}/ping`)) {
        pingStatuses.push(response.status());
      }
    });

    await page.goto('/');
    await page.evaluate(([token, user]) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, [login.token, login.user]);

    await page.goto(`/org/${org.orgSlug}/change-password`);
    await expect(page.getByRole('heading', { name: /change password/i })).toBeVisible();
    await expect(page.getByTestId('429-error-message')).toHaveCount(0);

    for (let reload = 0; reload < 4; reload++) {
      await page.reload();
      await expect(page.getByRole('heading', { name: /change password/i })).toBeVisible();
      await expect(page.getByTestId('429-error-message')).toHaveCount(0);
    }

    expect(pingStatuses.length).toBeGreaterThan(0);
    expect(pingStatuses.every((status) => status === 200)).toBe(true);

    assertFixtureRuntimeWithinLimit(startedAt);
  });

  test('shows a visible 429 message with retry-after after protected endpoint exhaustion', async ({ page, request, seedTestOrg }) => {
    const startedAt = Date.now();
    const org = await seedTestOrg();
    const login = await loginSeededOrgAdmin(request, org.admin.username, org.admin.password);

    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await request.get(`/api/org/${org.orgSlug}/ping`, {
        headers: {
          Authorization: `Bearer ${login.token}`,
        },
      });

      expect(response.status()).toBe(200);
    }

    await page.goto('/');
    await page.evaluate(([token, user]) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, [login.token, login.user]);

    await page.goto(`/org/${org.orgSlug}/change-password`);

    const errorMessage = page.getByTestId('429-error-message');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/too many requests/i);
    await expect(errorMessage).toContainText(/retry after \d+ seconds/i);

    assertFixtureRuntimeWithinLimit(startedAt);
  });
});
