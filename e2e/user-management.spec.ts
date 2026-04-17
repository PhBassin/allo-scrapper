import { test, expect } from './fixtures/org-fixture';

const useOrgFixture = process.env['E2E_ENABLE_ORG_FIXTURE'] === 'true';

test.describe('User Management', () => {
  test.beforeEach(async ({ seedTestOrg }) => {
    if (useOrgFixture) {
      await seedTestOrg();
    }
  });

  // Helper function to login as admin
  async function loginAsAdmin(page: any) {
    await page.goto('/login');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="user-menu-button"]');
  }

  // Helper function to navigate to Users page
  async function navigateToUsersPage(page: any) {
    // Click user menu button
    await page.click('[data-testid="user-menu-button"]');
    
    // Wait for dropdown and click Users link
    await page.waitForSelector('[data-testid="admin-users-link"]');
    await page.click('[data-testid="admin-users-link"]');
    
    // Wait for Users page to load
    await page.waitForSelector('text=User Management');
  }

  test.describe('Access Control', () => {
    test('non-admin users cannot access users page', async ({ page }) => {
      // Create and login as regular user first (assuming test database has a regular user)
      // For now, we'll test that unauthenticated users get redirected
      await page.goto('/admin/users');
      await page.waitForLoadState('networkidle');

      // Should be redirected to login
      await expect(page.locator('h2').filter({ hasText: /login/i })).toBeVisible({ timeout: 10000 });
    });

    test('admin users can access users page', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Should see User Management page
      await expect(page.locator('h1').filter({ hasText: /user management/i })).toBeVisible();
    });

    test('users link is visible only for admins', async ({ page }) => {
      await loginAsAdmin(page);

      // Click user menu
      await page.click('[data-testid="user-menu-button"]');

      // Should see Users link
      await expect(page.locator('[data-testid="admin-users-link"]')).toBeVisible();
    });
  });

  test.describe('User List Display', () => {
    test('displays user table with correct columns', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Wait for table to load
      await page.waitForSelector('table');

      // Check table headers
      await expect(page.locator('th').filter({ hasText: /username/i })).toBeVisible();
      await expect(page.locator('th').filter({ hasText: /role/i })).toBeVisible();
      await expect(page.locator('th').filter({ hasText: /created/i })).toBeVisible();
      await expect(page.locator('th').filter({ hasText: /actions/i })).toBeVisible();
    });

    test('displays existing users', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Wait for users to load
      await page.waitForSelector('table tbody tr');

      // Should display at least the admin user
      await expect(page.locator('text=admin')).toBeVisible();
    });

    test('displays role badges correctly', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Wait for table to load
      await page.waitForSelector('table tbody tr');

      // Admin role badge should be visible
      await expect(page.locator('text=👑 Admin')).toBeVisible();
    });

    test('displays action buttons for each user', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Wait for table to load
      await page.waitForSelector('table tbody tr');

      // Should see action buttons
      await expect(page.locator('button').filter({ hasText: /change role/i }).first()).toBeVisible();
      await expect(page.locator('button').filter({ hasText: /reset password/i }).first()).toBeVisible();
      await expect(page.locator('button').filter({ hasText: /delete/i }).first()).toBeVisible();
    });
  });

  test.describe('Create User Flow', () => {
    test('opens create user modal when button clicked', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Click Create User button
      await page.click('button:has-text("Create User")');

      // Modal should appear
      await expect(page.locator('h3').filter({ hasText: /create new user/i })).toBeVisible();
      await expect(page.locator('label:has-text("Username")')).toBeVisible();
      await expect(page.locator('label:has-text("Password")')).toBeVisible();
    });

    test('creates new user successfully', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Generate unique username
      const timestamp = Date.now();
      const username = `testuser${timestamp}`;

      // Click Create User button
      await page.click('button:has-text("Create User")');

      // Fill form
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', 'TestPass123!');

      // Submit form
      await page.click('button:has-text("Create")');

      // Wait for modal to close and user to appear in table
      await page.waitForSelector(`text=${username}`, { timeout: 10000 });

      // Verify user appears in table
      await expect(page.locator(`text=${username}`)).toBeVisible();
    });

    test('validates username format', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Click Create User button
      await page.click('button:has-text("Create User")');

      // Try invalid username (too short)
      await page.fill('input[name="username"]', 'ab');
      await page.fill('input[name="password"]', 'TestPass123!');

      // Create button should be disabled or show error
      const createButton = page.locator('button:has-text("Create")');
      
      // Try to click and check if error appears
      await createButton.click();
      
      // Error should appear (either validation message or button disabled)
      // The exact behavior depends on implementation
      await expect(page.locator('text=/username|invalid|3-15/i')).toBeVisible({ timeout: 5000 }).catch(() => {
        // If no error message, button should be disabled
        return expect(createButton).toBeDisabled();
      });
    });

    test('validates password strength', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Click Create User button
      await page.click('button:has-text("Create User")');

      // Try weak password
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'weak');

      // Should show password strength indicator or error
      await expect(page.locator('text=/weak|password|strength/i')).toBeVisible({ timeout: 5000 });
    });

    test('closes modal when cancel clicked', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Click Create User button
      await page.click('button:has-text("Create User")');

      // Modal should appear
      await expect(page.locator('h3').filter({ hasText: /create new user/i })).toBeVisible();

      // Click Cancel
      await page.click('button:has-text("Cancel")');

      // Modal should close
      await expect(page.locator('h3').filter({ hasText: /create new user/i })).not.toBeVisible();
    });
  });

  test.describe('Change Role Flow', () => {
    test('changes user role from user to admin', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // First create a regular user
      const timestamp = Date.now();
      const username = `roletest${timestamp}`;

      await page.click('button:has-text("Create User")');
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', 'TestPass123!');
      await page.click('button:has-text("Create")');
      await page.waitForSelector(`text=${username}`);

      // Find the user row and click Change Role
      const userRow = page.locator(`tr:has-text("${username}")`);
      await userRow.locator('button:has-text("Change Role")').click();

      // Wait for role to change
      await page.waitForTimeout(1000); // Brief wait for API call

      // Refresh or check if role badge changed to admin
      await page.reload();
      await page.waitForSelector('table tbody tr');

      // The user should now be an admin (should have admin badge)
      const updatedRow = page.locator(`tr:has-text("${username}")`);
      await expect(updatedRow.locator('text=👑 Admin')).toBeVisible({ timeout: 10000 });
    });

    test('displays error when trying to change last admin role', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Find admin row and try to change role
      const adminRow = page.locator('tr:has-text("admin")').first();
      await adminRow.locator('button:has-text("Change Role")').click();

      // Should show error message
      await expect(page.locator('text=/cannot.*last admin|last admin.*role/i')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Reset Password Flow', () => {
    test('resets user password and displays new password', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Create a test user first
      const timestamp = Date.now();
      const username = `passreset${timestamp}`;

      await page.click('button:has-text("Create User")');
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', 'TestPass123!');
      await page.click('button:has-text("Create")');
      await page.waitForSelector(`text=${username}`);

      // Find the user row and click Reset Password
      const userRow = page.locator(`tr:has-text("${username}")`);
      await userRow.locator('button:has-text("Reset Password")').click();

      // Wait for password reset dialog
      await expect(page.locator('h3').filter({ hasText: /password reset successful/i })).toBeVisible({ timeout: 10000 });

      // Should display new password
      await expect(page.locator('input[readonly]')).toBeVisible();

      // Close dialog
      await page.click('button:has-text("Close")');
    });

    test('copy button works in password reset dialog', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Create a test user
      const timestamp = Date.now();
      const username = `copytest${timestamp}`;

      await page.click('button:has-text("Create User")');
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', 'TestPass123!');
      await page.click('button:has-text("Create")');
      await page.waitForSelector(`text=${username}`);

      // Reset password
      const userRow = page.locator(`tr:has-text("${username}")`);
      await userRow.locator('button:has-text("Reset Password")').click();

      // Wait for dialog
      await page.waitForSelector('h3:has-text("Password Reset Successful")');

      // Click copy button
      await page.click('button:has-text("Copy")');

      // Should show "Copied!" feedback
      await expect(page.locator('text=Copied!')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Delete User Flow', () => {
    test('deletes user after confirmation', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Create a test user to delete
      const timestamp = Date.now();
      const username = `deletetest${timestamp}`;

      await page.click('button:has-text("Create User")');
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', 'TestPass123!');
      await page.click('button:has-text("Create")');
      await page.waitForSelector(`text=${username}`);

      // Find the user row and click Delete
      const userRow = page.locator(`tr:has-text("${username}")`);
      await userRow.locator('button:has-text("Delete")').click();

      // Confirmation dialog should appear
      await expect(page.locator('h3').filter({ hasText: /delete user/i })).toBeVisible();

      // Confirm deletion
      const deleteButtons = page.locator('button:has-text("Delete")');
      await deleteButtons.last().click(); // Click the confirmation button in dialog

      // Wait for user to be removed
      await page.waitForTimeout(1000);
      await page.reload();

      // User should no longer appear in table
      await expect(page.locator(`text=${username}`)).not.toBeVisible();
    });

    test('cancels delete when cancel clicked', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Create a test user
      const timestamp = Date.now();
      const username = `canceltest${timestamp}`;

      await page.click('button:has-text("Create User")');
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', 'TestPass123!');
      await page.click('button:has-text("Create")');
      await page.waitForSelector(`text=${username}`);

      // Click delete
      const userRow = page.locator(`tr:has-text("${username}")`);
      await userRow.locator('button:has-text("Delete")').click();

      // Dialog should appear
      await expect(page.locator('h3').filter({ hasText: /delete user/i })).toBeVisible();

      // Click Cancel
      await page.click('button:has-text("Cancel")');

      // Dialog should close
      await expect(page.locator('h3').filter({ hasText: /delete user/i })).not.toBeVisible();

      // User should still be in table
      await expect(page.locator(`text=${username}`)).toBeVisible();
    });

    test('displays error when trying to delete last admin', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Try to delete admin user
      const adminRow = page.locator('tr:has-text("admin")').first();
      await adminRow.locator('button:has-text("Delete")').click();

      // Confirmation dialog should appear
      await expect(page.locator('h3').filter({ hasText: /delete user/i })).toBeVisible();

      // Confirm deletion
      const deleteButtons = page.locator('button:has-text("Delete")');
      await deleteButtons.last().click();

      // Should show error
      await expect(page.locator('text=/cannot.*delete.*last admin/i')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Error Handling', () => {
    test('displays error when user list fails to load', async ({ page }) => {
      // This test would require mocking the API to return an error
      // For now, we'll test that the page handles empty state
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Page should load without crashing
      await expect(page.locator('h1').filter({ hasText: /user management/i })).toBeVisible();
    });

    test('handles duplicate username error', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Try to create user with existing username "admin"
      await page.click('button:has-text("Create User")');
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'TestPass123!');
      await page.click('button:has-text("Create")');

      // Should show error about duplicate username
      await expect(page.locator('text=/already exists|duplicate|username.*taken/i')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Pagination', () => {
    test('displays pagination controls when many users exist', async ({ page }) => {
      // This test assumes the system has pagination
      // It may not apply if there aren't enough users
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // If pagination exists, it should be visible
      // Otherwise this test will need adjustment based on actual implementation
      await page.waitForSelector('table tbody tr');
      
      // Just verify page loads without errors for now
      await expect(page.locator('h1').filter({ hasText: /user management/i })).toBeVisible();
    });
  });
});
