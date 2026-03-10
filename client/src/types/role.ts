export interface Permission {
  id: number;
  name: string;
  description: string | null;
  category: string;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}
