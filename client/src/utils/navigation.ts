import type { User } from '../contexts/AuthContext';

/**
 * Determines the appropriate post-login redirect destination based on user type.
 * 
 * Redirect precedence:
 * 1. System admin without org → /superadmin (always, ignores `from`)
 * 2. User with org_slug → /org/{slug} or requested path within same org
 * 3. Regular user → requested path or landing page (/)
 * 
 * @param user - The authenticated user
 * @param from - Optional requested path before login
 * @returns The destination path to redirect to
 */
export function determinePostLoginDestination(user: User, from?: string): string {
  // System admin without org → always superadmin portal
  // Must check all three conditions: is_system_role, role_name === 'admin', and no org_slug
  if (user.is_system_role && user.role_name === 'admin' && !user.org_slug) {
    return '/superadmin';
  }
  
  // User with org → org home or requested path within org
  if (user.org_slug) {
    // If `from` is within the same org, honor it
    if (from && from.startsWith(`/org/${user.org_slug}`)) {
      return from;
    }
    // Otherwise default to org home
    return `/org/${user.org_slug}`;
  }
  
  // Fallback: honor `from` or default to landing page
  // Empty string should be treated as falsy
  return from || '/';
}
