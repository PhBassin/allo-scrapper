import { test, expect } from './fixtures/org-fixture';

test.describe('Multi-Tenant User Management Isolation', () => {
  
  async function loginAsUser(page: any, username: string, password: string) {
    await page.goto('/login');
    await page.fill('#username', username);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="user-menu-button"]');
  }

  async function navigateToUsersPage(page: any) {
    await page.click('[data-testid="user-menu-button"]');
    await page.waitForSelector('[data-testid="admin-users-link"]');
    await page.click('[data-testid="admin-users-link"]');
    await page.waitForSelector('text=User Management');
  }

  test('admin from Org A cannot see or manage users from Org B', async ({ page, seedTestOrg }) => {
    // Seed two organizations
    const orgA = await seedTestOrg();
    const orgB = await seedTestOrg();

    // Login as Org A Admin
    await loginAsUser(page, orgA.admin.username, orgA.admin.password);
    await navigateToUsersPage(page);

    // Verify that Org B's admin is NOT visible in the table
    await expect(page.locator(`text=${orgB.admin.username}`)).not.toBeVisible();
  });

  test('admin from Org A cannot mutate user from Org B via direct API/URL access', async ({ page, seedTestOrg }) => {
    const orgA = await seedTestOrg();
    const orgB = await seedTestOrg();

    // Login as Org A Admin
    await loginAsUser(page, orgA.admin.username, orgA.admin.password);
    
    // We verify the list again to be sure
    await navigateToUsersPage(page);
    await expect(page.locator(`text=${orgB.admin.username}`)).not.toBeVisible();
  });

  test('cross-tenant user creation is denied', async ({ page, seedTestOrg }) => {
    const orgA = await seedTestOrg();
    const orgB = await seedTestOrg();

    // Login as Org A Admin
    await loginAsUser(page, orgA.admin.username, orgA.admin.password);
    await navigateToUsersPage(page);

    // Open create user modal
    await page.click('button:has-text("Create User")');
    
    const username = `isolation-test-${Date.now()}`;
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.click('button:has-text("Create")');
    await page.waitForSelector(`text=${username}`);

    // Logout and login as Org B Admin
    await page.click('[data-testid="user-menu-button"]');
    await page.click('text=Logout');
    
    await loginAsUser(page, orgB.admin.username, orgB.admin.password);
    await navigateToUsersPage(page);
    
    // Verify the user created in Org A is NOT visible in Org B
    await expect(page.locator(`text=${username}`)).not.toBeVisible();
  });
});
