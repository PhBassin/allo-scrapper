/**
 * Superadmin authentication service.
 * Handles login and JWT minting for superadmin users.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { DB } from '../db/types.js';

interface SuperadminRow {
  id: number;
  username: string;
  password_hash: string;
  role_id: number;
  role_name: string;
  is_system_role: boolean;
}

export class SuperadminAuthService {
  constructor(private db: DB) {}

  /**
   * Authenticate a superadmin by username and password.
   * Queries the public.users table for system admin accounts.
   * Returns a JWT token if credentials are valid, null otherwise.
   */
  async login(username: string, password: string): Promise<{ token: string } | null> {
    // Fetch system admin user from public.users table
    const result = await this.db.query<SuperadminRow>(
      `SELECT u.id, u.username, u.password_hash, u.role_id, r.name as role_name, r.is_system as is_system_role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.username = $1
         AND r.is_system = true
         AND r.name = 'admin'`,
      [username]
    );

    const admin = result.rows[0];
    if (!admin) {
      return null;
    }

    // Verify password
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return null;
    }

    // Mint JWT with scope=superadmin
    const token = this.mintSuperadminJwt(String(admin.id), admin.username);
    return { token };
  }

  /**
   * Create a JWT token for a superadmin.
   * Uses the same JWT_SECRET as org tokens, but with scope: 'superadmin'.
   */
  mintSuperadminJwt(superadminId: string, username: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const payload = {
      id: superadminId,
      username,
      scope: 'superadmin',
    };

    return jwt.sign(payload, secret, { expiresIn: '24h' });
  }
}
