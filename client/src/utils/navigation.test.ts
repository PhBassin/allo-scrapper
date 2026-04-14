import { describe, it, expect } from 'vitest';
import { determinePostLoginDestination } from './navigation';
import type { User } from '../contexts/AuthContext';

describe('determinePostLoginDestination', () => {
  describe('System admin without org', () => {
    const systemAdmin: User = {
      id: 1,
      username: 'admin',
      role_id: 1,
      role_name: 'admin',
      is_system_role: true,
      permissions: [],
    };

    it('redirects to /superadmin when no from location is provided', () => {
      const destination = determinePostLoginDestination(systemAdmin);
      expect(destination).toBe('/superadmin');
    });

    it('redirects to /superadmin even when from location is provided (ignores from)', () => {
      const destination = determinePostLoginDestination(systemAdmin, '/org/acme/admin');
      expect(destination).toBe('/superadmin');
    });

    it('redirects to /superadmin when from is root', () => {
      const destination = determinePostLoginDestination(systemAdmin, '/');
      expect(destination).toBe('/superadmin');
    });
  });

  describe('User with org_slug', () => {
    const orgUser: User = {
      id: 2,
      username: 'orgadmin',
      role_id: 2,
      role_name: 'org_admin',
      is_system_role: false,
      permissions: [],
      org_slug: 'acme',
    };

    it('redirects to /org/{slug} when no from location is provided', () => {
      const destination = determinePostLoginDestination(orgUser);
      expect(destination).toBe('/org/acme');
    });

    it('redirects to from location when it is within the same org', () => {
      const destination = determinePostLoginDestination(orgUser, '/org/acme/cinema/123');
      expect(destination).toBe('/org/acme/cinema/123');
    });

    it('redirects to /org/{slug} when from location is for a different org', () => {
      const destination = determinePostLoginDestination(orgUser, '/org/other/admin');
      expect(destination).toBe('/org/acme');
    });

    it('redirects to /org/{slug} when from location is not an org route', () => {
      const destination = determinePostLoginDestination(orgUser, '/admin');
      expect(destination).toBe('/org/acme');
    });
  });

  describe('Regular user without org or system role', () => {
    const regularUser: User = {
      id: 3,
      username: 'user',
      role_id: 3,
      role_name: 'viewer',
      is_system_role: false,
      permissions: [],
    };

    it('redirects to / when no from location is provided', () => {
      const destination = determinePostLoginDestination(regularUser);
      expect(destination).toBe('/');
    });

    it('redirects to from location when provided', () => {
      const destination = determinePostLoginDestination(regularUser, '/some/path');
      expect(destination).toBe('/some/path');
    });

    it('redirects to / when from is empty string', () => {
      const destination = determinePostLoginDestination(regularUser, '');
      expect(destination).toBe('/');
    });
  });

  describe('Edge cases', () => {
    it('handles user with org_slug and system role (org takes precedence)', () => {
      const userWithBoth: User = {
        id: 4,
        username: 'hybrid',
        role_id: 1,
        role_name: 'admin',
        is_system_role: true,
        permissions: [],
        org_slug: 'acme',
      };

      // When org_slug exists, org routing takes precedence
      const destination = determinePostLoginDestination(userWithBoth);
      expect(destination).toBe('/org/acme');
    });

    it('handles system admin with non-admin role_name (should not redirect to superadmin)', () => {
      const systemNonAdmin: User = {
        id: 5,
        username: 'sysuser',
        role_id: 5,
        role_name: 'viewer',
        is_system_role: true,
        permissions: [],
      };

      // Not an admin, so fallback to default
      const destination = determinePostLoginDestination(systemNonAdmin);
      expect(destination).toBe('/');
    });

    it('handles admin role_name but not system role (regular org admin)', () => {
      const orgAdmin: User = {
        id: 6,
        username: 'orgadmin',
        role_id: 2,
        role_name: 'admin',
        is_system_role: false,
        permissions: [],
        org_slug: 'acme',
      };

      // Has org, so should go to org home
      const destination = determinePostLoginDestination(orgAdmin);
      expect(destination).toBe('/org/acme');
    });
  });
});
