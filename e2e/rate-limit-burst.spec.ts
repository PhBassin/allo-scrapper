import type { APIRequestContext, Page } from '@playwright/test';
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

interface CreateUserResponse {
  success: boolean;
  data: {
    id: number;
    username: string;
    role_id: number;
    role_name: string;
    created_at: string;
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

async function createSeededOrgAdminUser(
  request: APIRequestContext,
  orgSlug: string,
  adminToken: string,
  username: string,
  password: string,
): Promise<void> {
  const response = await request.post(`/api/org/${orgSlug}/users`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
    data: {
      username,
      password,
      role_id: 1,
    },
  });

  expect(response.status()).toBe(201);
  const payload = await response.json() as CreateUserResponse;
  expect(payload.success).toBe(true);
  expect(payload.data.username).toBe(username);
}

async function setAuthenticatedSession(page: Page, login: LoginResponse['data']): Promise<void> {
  await page.goto('/');
  await page.evaluate(([token, user]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, [login.token, login.user]);
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

    await setAuthenticatedSession(page, login);

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

    await setAuthenticatedSession(page, login);
    await page.goto(`/org/${org.orgSlug}/change-password`);

    const errorMessage = page.getByTestId('429-error-message');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/too many requests/i);
    await expect(errorMessage).toContainText(/retry after \d+ seconds/i);

    assertFixtureRuntimeWithinLimit(startedAt);
  });

  test('resets the protected limiter after 60 seconds and restores a full fresh burst', async ({ request, seedTestOrg }) => {
    test.setTimeout(90000);

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

    const limited = await request.get(`/api/org/${org.orgSlug}/ping`, {
      headers: {
        Authorization: `Bearer ${login.token}`,
      },
    });
    expect(limited.status()).toBe(429);
    const retryAfterHeader = limited.headers()['retry-after'];
    expect(retryAfterHeader).toBeTruthy();
    expect(Number(retryAfterHeader)).toBeGreaterThan(0);
    expect(Number(retryAfterHeader)).toBeLessThanOrEqual(60);

    await test.step('wait for the 60 second reset window', async () => {
      await new Promise((resolve) => setTimeout(resolve, 61000));
    });

    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await request.get(`/api/org/${org.orgSlug}/ping`, {
        headers: {
          Authorization: `Bearer ${login.token}`,
        },
      });

      expect(response.status()).toBe(200);
    }

    const limitedAgain = await request.get(`/api/org/${org.orgSlug}/ping`, {
      headers: {
        Authorization: `Bearer ${login.token}`,
      },
    });
    expect(limitedAgain.status()).toBe(429);

    assertFixtureRuntimeWithinLimit(startedAt);
  });

  test('shows a decrementing reset timer after a protected 429 response', async ({ page, request, seedTestOrg }) => {
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

    await setAuthenticatedSession(page, login);
    await page.goto(`/org/${org.orgSlug}/change-password`);

    const timer = page.getByTestId('rate-limit-reset-timer');
    await expect(timer).toBeVisible();
    await expect(timer).toContainText(/resets in \d+ seconds/i);

    const initialText = await timer.textContent();
    await page.waitForTimeout(1100);
    const updatedText = await timer.textContent();

    expect(updatedText).not.toBe(initialText);

    assertFixtureRuntimeWithinLimit(startedAt);
  });

  test('keeps same-org authenticated users in independent protected limiter buckets', async ({ request, seedTestOrg }) => {
    const startedAt = Date.now();
    const org = await seedTestOrg();
    const adminLogin = await loginSeededOrgAdmin(request, org.admin.username, org.admin.password);
    const secondUsername = `u${Date.now().toString().slice(-8)}`;
    const secondPassword = 'TestPass123!';

    await createSeededOrgAdminUser(request, org.orgSlug, adminLogin.token, secondUsername, secondPassword);

    const secondLogin = await loginSeededOrgAdmin(request, secondUsername, secondPassword);

    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await request.get(`/api/org/${org.orgSlug}/ping`, {
        headers: {
          Authorization: `Bearer ${secondLogin.token}`,
        },
      });

      expect(response.status()).toBe(200);
    }

    const limited = await request.get(`/api/org/${org.orgSlug}/ping`, {
      headers: {
        Authorization: `Bearer ${secondLogin.token}`,
      },
    });
    expect(limited.status()).toBe(429);

    const adminResponse = await request.get(`/api/org/${org.orgSlug}/ping`, {
      headers: {
        Authorization: `Bearer ${adminLogin.token}`,
      },
    });
    expect(adminResponse.status()).toBe(200);

    assertFixtureRuntimeWithinLimit(startedAt);
  });
});
