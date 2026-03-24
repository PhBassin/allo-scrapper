// User types — role_id-based system (replaces old role TEXT column)

// Public user data (no password hash)
export interface UserPublic {
  id: number;
  username: string;
  role_id: number;
  role_name: string;
  created_at: string;
}
