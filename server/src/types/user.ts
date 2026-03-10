// User types — role_id-based system (replaces old role TEXT column)

// Database row interface (with JOIN on roles table)
export interface UserRowWithRole {
  id: number;
  username: string;
  password_hash: string;
  role_id: number;
  role_name: string;
  is_system_role: boolean;
  created_at: string;
}

// Public user data (no password hash)
export interface UserPublic {
  id: number;
  username: string;
  role_id: number;
  role_name: string;
  created_at: string;
}

// User creation payload
export interface UserCreate {
  username: string;
  password: string;
  role_id: number; // Obligatoire, doit être un ID de rôle valide
}

// User update payload
export interface UserUpdate {
  username?: string;
  password?: string;
  role_id?: number;
}
