import { z } from 'zod';

/**
 * Zod schema for Permission type
 * Validates API responses to ensure type safety at runtime
 */
export const PermissionSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  created_at: z.string(),
});

/**
 * Zod schema for Role type
 * Validates API responses to ensure type safety at runtime
 */
export const RoleSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  is_system: z.boolean(),
  created_at: z.string(),
});

/**
 * Zod schema for RoleWithPermissions type
 * Extends Role with an array of permissions
 */
export const RoleWithPermissionsSchema = RoleSchema.extend({
  permissions: z.array(PermissionSchema),
});

/**
 * Zod schema for PermissionCategoryLabel type
 * Validates API responses for category label data
 */
export const PermissionCategoryLabelSchema = z.object({
  id: z.number(),
  category_key: z.string(),
  label_en: z.string(),
  label_fr: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * TypeScript types inferred from Zod schemas
 * This ensures types always match runtime validation
 */
export type Permission = z.infer<typeof PermissionSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type RoleWithPermissions = z.infer<typeof RoleWithPermissionsSchema>;
export type PermissionCategoryLabel = z.infer<typeof PermissionCategoryLabelSchema>;
