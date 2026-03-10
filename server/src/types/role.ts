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

// All possible permission strings (used for type safety)
export type PermissionName =
  | 'users:list' | 'users:create' | 'users:update' | 'users:delete'
  | 'scraper:trigger' | 'scraper:trigger_single'
  | 'cinemas:create' | 'cinemas:update' | 'cinemas:delete'
  | 'settings:read' | 'settings:update' | 'settings:reset' | 'settings:export' | 'settings:import'
  | 'reports:list' | 'reports:view'
  | 'system:info' | 'system:health' | 'system:migrations';
