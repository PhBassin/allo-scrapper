import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUserByUsername, getTenantUserByUsername, hasTenantUserWithUsername, createUser, updateUserPassword } from '../db/user-queries.js';
import { getPermissionNamesByRoleId } from '../db/role-queries.js';
import type { DB } from '../db/client.js';
import { validatePasswordStrength, validateUsername } from '../utils/security.js';
import { logger } from '../utils/logger.js';
import { parseJwtExpiration } from '../utils/jwt-config.js';
import type { PermissionName } from '../types/role.js';
import { validateJWTSecret } from '../utils/jwt-secret-validator.js';

// Pre-computed hash for 'dummy' (cost 10) to prevent timing attacks
const DUMMY_HASH = '$2b$10$OjIEvY.r8hZtkpA2kEa0EeIJoxe2tgk/ANQghcJfuj5QA7h/lDEb2';

export class AuthService {
  constructor(private db: DB) {}

  async login(username?: string, password?: string) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const globalUser = await getUserByUsername(this.db, username);
    const isGlobalMatch = await bcrypt.compare(password, globalUser?.password_hash ?? DUMMY_HASH);

    const user = globalUser && isGlobalMatch
      ? globalUser
      : await getTenantUserByUsername(this.db, username);
    const isMatch = globalUser && isGlobalMatch
      ? true
      : await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);

    if (!user || !isMatch) {
      throw new Error('Invalid credentials');
    }

    const permissions = await getPermissionNamesByRoleId(this.db, user.role_id) as PermissionName[];

    const secret = validateJWTSecret();

    // Parse JWT expiration from env var (default: 24h)
    const expiresIn = parseJwtExpiration(process.env.JWT_EXPIRES_IN || '24h');

    // Add scope: 'superadmin' for system admins to enable single sign-on
    const payload: Record<string, any> = {
      id: user.id,
      username: user.username,
      role_name: user.role_name,
      is_system_role: user.is_system_role,
      permissions,
    };

    // System admins (is_system_role=true AND role_name='admin') get superadmin scope
    if (!user.org_slug && user.is_system_role && user.role_name === 'admin') {
      payload.scope = 'superadmin';
    }

    if (user.org_id) {
      payload.org_id = user.org_id;
    }

    if (user.org_slug) {
      payload.org_slug = user.org_slug;
    }

    const token = jwt.sign(payload, secret, { expiresIn: expiresIn as any });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role_id: user.role_id,
        role_name: user.role_name,
        is_system_role: user.is_system_role,
        permissions,
        org_slug: user.org_slug,
      },
    };
  }

  async register(username?: string, password?: string) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      throw new Error(usernameError);
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      throw new Error(passwordError); // Let controller decide status code
    }

    const existingUser = await getUserByUsername(this.db, username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    if (await hasTenantUserWithUsername(this.db, username)) {
      throw new Error('Username already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

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

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await updateUserPassword(this.db, user.id, newPasswordHash);
    logger.info(`Password changed for user: ${user.username}`);
  }
}
