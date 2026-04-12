/**
 * Superadmin authentication service.
 * Handles login and JWT minting for superadmin users.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { DB } from '../db/types.js';

interface SuperadminRow {
  id: string;
  username: string;
  password_hash: string;
}

export class SuperadminAuthService {
  constructor(private db: DB) {}

  /**
   * Authenticate a superadmin by username and password.
   * Returns a JWT token and user info if credentials are valid, null otherwise.
   */
  async login(username: string, password: string): Promise<{ token: string; user: { id: string; username: string; scope: string; permissions: string[] } } | null> {
    // Fetch superadmin from database
    const result = await this.db.query<SuperadminRow>(
      'SELECT id, username, password_hash FROM superadmins WHERE username = $1',
      [username]
    );

    const superadmin = result.rows[0];
    if (!superadmin) {
      return null;
    }

    // Verify password
    const valid = await bcrypt.compare(password, superadmin.password_hash);
    if (!valid) {
      return null;
    }

    // Mint JWT with scope=superadmin
    const token = this.mintSuperadminJwt(superadmin.id, superadmin.username);
    return {
      token,
      user: {
        id: superadmin.id,
        username: superadmin.username,
        scope: 'superadmin',
        permissions: [],
      },
    };
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
