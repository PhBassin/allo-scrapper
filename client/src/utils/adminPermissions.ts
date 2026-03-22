import type { PermissionName } from '../types/role';

/**
 * List of permissions that grant access to the /admin route.
 * 
 * Any user with at least one of these permissions should be able to access
 * the admin page. The AdminPage component will dynamically show/hide tabs
 * based on individual tab permissions.
 * 
 * This list includes all admin-related permissions (read, list, create, update, delete)
 * for all admin resources.
 */
export const ADMIN_PERMISSIONS: PermissionName[] = [
  // Cinema permissions
  'cinemas:create',
  'cinemas:update',
  'cinemas:delete',
  'cinemas:read',
  
  // User permissions
  'users:list',
  'users:create',
  'users:update',
  'users:delete',
  'users:read',
  
  // Role permissions
  'roles:read',
  'roles:list',
  'roles:create',
  'roles:update',
  'roles:delete',
  
  // Settings permissions
  'settings:read',
  'settings:update',
  'settings:reset',
  'settings:export',
  'settings:import',
  
  // Reports permissions
  'reports:list',
  'reports:view',
  
  // System permissions
  'system:info',
  'system:health',
  'system:migrations',
  
  // Scraper permissions (visible in cinemas tab)
  'scraper:trigger',
  'scraper:trigger_single',
];
