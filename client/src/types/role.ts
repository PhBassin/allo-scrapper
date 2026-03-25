/**
 * Role and Permission types
 * 
 * These types are now derived from Zod schemas to ensure
 * runtime validation matches compile-time types.
 * 
 * @see ../schemas/role.ts for the source schemas
 */
export type { Permission, Role, RoleWithPermissions } from '../schemas/role';

// All possible permission strings (used for type safety)
// This is duplicated from the server to ensure strict typing in the client
export type PermissionName =
  | 'users:list' | 'users:create' | 'users:update' | 'users:delete' | 'users:read'
  | 'scraper:trigger' | 'scraper:trigger_single'
  | 'scraper:schedules:list' | 'scraper:schedules:create' | 'scraper:schedules:update' | 'scraper:schedules:delete'
  | 'cinemas:create' | 'cinemas:update' | 'cinemas:delete' | 'cinemas:read'
  | 'settings:read' | 'settings:update' | 'settings:reset' | 'settings:export' | 'settings:import'
  | 'reports:list' | 'reports:view'
  | 'system:info' | 'system:health' | 'system:migrations'
  | 'roles:read' | 'roles:list' | 'roles:create' | 'roles:update' | 'roles:delete'
  | 'ratelimits:read' | 'ratelimits:update' | 'ratelimits:reset' | 'ratelimits:audit';
