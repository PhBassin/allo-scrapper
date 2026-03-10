/**
 * Role and Permission types
 * 
 * These types are now derived from Zod schemas to ensure
 * runtime validation matches compile-time types.
 * 
 * @see ../schemas/role.ts for the source schemas
 */
export type { Permission, Role, RoleWithPermissions } from '../schemas/role';
