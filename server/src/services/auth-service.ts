import jwt from 'jsonwebtoken';
import { getUserByUsername, createUser, updateUserPassword } from '../db/user-queries.js';
import { getPermissionNamesByRoleId } from '../db/role-queries.js';
import type { DB } from '../db/index.js';
import { validatePasswordStrength } from '../utils/security.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';
import { parseJwtExpiration } from '../utils/jwt-config.js';
import type { PermissionName } from '../types/role.js';
import { getCurrentSecret } from '../utils/jwt-secrets.js';

// Pre-computed hash for 'dummy' (cost 10) to prevent timing attacks
const DUMMY_HASH = 'scrypt:16384:8:1:00000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

export class AuthService {
  constructor(private db: DB) {}

  async login(username?: string, password?: string) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const user = await getUserByUsername(this.db, username);
    const hashToCompare = user ? user.password_hash : DUMMY_HASH;
    const isMatch = await comparePassword(password, hashToCompare);

    if (!user || !isMatch) {
      throw new Error('Invalid credentials');
    }

    const permissions = await getPermissionNamesByRoleId(this.db, user.role_id) as PermissionName[];

    const secret = getCurrentSecret();

    // Parse JWT expiration from env var (default: 1h)
    const expiresIn = parseJwtExpiration(process.env.JWT_EXPIRES_IN || '1h');

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role_name: user.role_name,
        is_system_role: user.is_system_role,
        permissions,
      },
      secret,
      { algorithm: 'HS256', expiresIn: expiresIn as any }
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role_id: user.role_id,
        role_name: user.role_name,
        is_system_role: user.is_system_role,
        permissions,
      },
    };
  }

  async register(username?: string, password?: string) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      throw new Error(passwordError); // Let controller decide status code
    }

    const existingUser = await getUserByUsername(this.db, username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    const passwordHash = await hashPassword(password);

    const user = await createUser(this.db, username, passwordHash);

    return {
      id: user.id,
      username: user.username,
      role_id: user.role_id,
      role_name: user.role_name,
    };
  }

  async changePassword(currentUsername: string, currentPassword?: string, newPassword?: string) {
    if (!currentPassword || !newPassword) {
      throw new Error('Current password and new password are required');
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      throw new Error(passwordError); // Let controller decide status code
    }

    const user = await getUserByUsername(this.db, currentUsername);
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await comparePassword(currentPassword, user.password_hash);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    const newPasswordHash = await hashPassword(newPassword);

    await updateUserPassword(this.db, user.id, newPasswordHash);
    logger.info(`Password changed for user: ${user.username}`);
  }
}
