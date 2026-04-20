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

interface UsersResponse {
  success: boolean;
  data: Array<{ id: number; username: string; role_id: number; role_name: string }>;
}

test.describe('Multi-tenant user management isolation', () => {
  test.skip(!useOrgFixture, 'Requires fixture-backed SaaS runtime (E2E_ENABLE_ORG_FIXTURE=true)');

  test('org A admin only sees org A users and cannot mutate org B users', async ({ page, request, seedTestOrg }) => {
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
    const orgAUser = orgALoginBody.data.user;
    expect(orgAUser.org_slug).toBe(orgA.orgSlug);

    const orgBLogin = await request.post('/api/auth/login', {
      data: {
        username: orgB.admin.username,
        password: orgB.admin.password,
      },
    });
    expect(orgBLogin.ok()).toBe(true);
    const orgBLoginBody = await orgBLogin.json() as LoginResponse;
    const orgBToken = orgBLoginBody.data.token;

    const orgAUsersResponse = await request.get(`/api/org/${orgA.orgSlug}/users`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    });
    expect(orgAUsersResponse.ok()).toBe(true);
    const orgAUsersBody = await orgAUsersResponse.json() as UsersResponse;
    const orgAUsernames = orgAUsersBody.data.map((user) => user.username);
    expect(orgAUsernames).toContain(orgA.admin.username);

    const orgBUsersResponse = await request.get(`/api/org/${orgB.orgSlug}/users`, {
      headers: { Authorization: `Bearer ${orgBToken}` },
    });
    expect(orgBUsersResponse.ok()).toBe(true);
    const orgBUsersBody = await orgBUsersResponse.json() as UsersResponse;
    const orgBTargetUser = orgBUsersBody.data.find((user) => user.id !== orgB.admin.id) ?? orgBUsersBody.data[0];
    expect(orgBTargetUser).toBeTruthy();

    await page.goto('/login');
    await page.fill('#username', orgA.admin.username);
    await page.fill('#password', orgA.admin.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(`**/org/${orgA.orgSlug}`);

    const usersResponsePromise = page.waitForResponse((response) => {
      return response.url().includes(`/api/org/${orgA.orgSlug}/users`) && response.request().method() === 'GET';
    });

    await page.goto(`/org/${orgA.orgSlug}/admin?tab=users`);

    const userTable = page.getByTestId('user-management-table');
    await expect(userTable).toBeVisible();
    await expect(userTable).toContainText(orgA.admin.username);
    await expect(userTable).toContainText(orgA.orgSlug);
    await expect(userTable).not.toContainText(orgB.orgSlug);

    const usersPayloadResponse = await usersResponsePromise;
    expect(usersPayloadResponse.ok()).toBe(true);
    const usersPayload = await usersPayloadResponse.json() as UsersResponse;
    const visibleUsernames = usersPayload.data.map((user) => user.username);
    expect(visibleUsernames).toContain(orgA.admin.username);
    expect(visibleUsernames.some((username) => username.includes(orgB.orgSlug))).toBe(false);

    const crossTenantUpdate = await request.put(`/api/org/${orgB.orgSlug}/users/${orgBTargetUser.id}`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
      data: { role_id: orgBTargetUser.role_id },
    });
    expect(crossTenantUpdate.status()).toBe(403);

    const crossTenantDelete = await request.delete(`/api/org/${orgB.orgSlug}/users/${orgBTargetUser.id}`, {
      headers: { Authorization: `Bearer ${orgAToken}` },
    });
    expect(crossTenantDelete.status()).toBe(403);

    const orgBUsersAfterMutations = await request.get(`/api/org/${orgB.orgSlug}/users`, {
      headers: { Authorization: `Bearer ${orgBToken}` },
    });
    expect(orgBUsersAfterMutations.ok()).toBe(true);
    const orgBUsersAfterMutationsBody = await orgBUsersAfterMutations.json() as UsersResponse;
    const survivingUser = orgBUsersAfterMutationsBody.data.find((user) => user.id === orgBTargetUser.id);
    expect(survivingUser).toBeTruthy();
    expect(survivingUser?.role_id).toBe(orgBTargetUser.role_id);

    assertFixtureRuntimeWithinLimit(startedAt);
  });
});
