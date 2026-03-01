// User and role types

export type UserRole = 'admin' | 'user';

// Database row interface (extends UserRow from queries.ts)
export interface UserRowWithRole {
  id: number;
  username: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
}

// Public user data (no password hash)
export interface UserPublic {
  id: number;
  username: string;
  role: UserRole;
  created_at: string;
}

// User creation payload
export interface UserCreate {
  username: string;
  password: string;
  role?: UserRole; // defaults to 'user'
}

// User update payload
export interface UserUpdate {
  username?: string;
  password?: string;
  role?: UserRole;
}
