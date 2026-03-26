// Role and permission types

export interface Role {
  id: number;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

export interface Permission {
  id: number;
  name: string;
  description: string | null;
  category: string;
  created_at: string;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface PermissionCategoryLabel {
  id: number;
  category_key: string;
  label_en: string;
  label_fr: string;
  created_at: string;
  updated_at: string;
}

// All possible permission strings (used for type safety)
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
