import type { DB } from '../db/index.js';
import type { UserPublic } from '../types/user.js';
import { logger } from '../utils/logger.js';
import { validatePasswordStrength } from '../utils/security.js';
import { hashPassword } from '../utils/password.js';
import {
  getAllUsers,
  getUserById,
  createUser as dbCreateUser,
  updateUserRole as dbUpdateUserRole,
  deleteUser as dbDeleteUser,
  getAdminCount,
  updateUserPassword as dbUpdateUserPassword,
} from '../db/user-queries.js';
import { roleExists, getRoleNameById } from '../db/role-queries.js';
import { revokeAllUserTokens } from '../repositories/refresh-token-repository.js';
import { ValidationError, NotFoundError, AuthError } from '../utils/errors.js';

// Username validation: alphanumeric only, 3-15 characters
const USERNAME_REGEX = /^[a-zA-Z0-9]{3,15}$/;

// Postgres unique-violation SQLSTATE — surfaced when a username collides on insert.
const PG_UNIQUE_VIOLATION = '23505';

/**
 * The single canonical role-name string used to identify the system admin role.
 *
 * NOTE: This constant exists because `middleware/auth.ts:isAdminUser` also
 * compares against the bare string `'admin'` (and additionally checks
 * `is_system_role`). The two checks have drifted apart: the auth middleware
 * requires the system flag, while the last-admin guards in this service
 * historically check only the name. This service preserves the previous
 * behaviour exactly — see `routes/users.ts` pre-refactor — so the wire
 * shape does not change. Centralising the literal here stops it from
 * drifting further inside this file.
 */
const ADMIN_ROLE_NAME = 'admin';

/**
 * Minimal acting-user context the service needs for self-delete checks and
 * structured audit logging. Matches the shape produced by `requireAuth`
 * (see `middleware/auth.ts:AuthRequest['user']`) but the service is
 * deliberately decoupled from the middleware type so it can be reused by
 * non-HTTP callers (admin CLI, scheduled jobs, etc.).
 */
export interface ActingUser {
  id: number;
  username: string;
}

export class UserService {
  constructor(private db: DB) {}

  /**
   * List users with pagination. Logs the audit event before returning so
   * every read of the admin user table is traceable.
   */
  async listUsers(options: { limit: number; offset: number }, acting: ActingUser): Promise<UserPublic[]> {
    const users = await getAllUsers(this.db, options);
    logger.info('Admin listed users', {
      adminId: acting.id,
      adminUsername: acting.username,
      count: users.length,
      limit: options.limit,
      offset: options.offset,
    });
    return users;
  }

  /**
   * Fetch a single user by ID. Throws `NotFoundError` if the user does not
   * exist so the route shim can surface a 404 without further branching.
   */
  async getUserById(userId: number, acting: ActingUser): Promise<UserPublic> {
    const user = await getUserById(this.db, userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    logger.info('Admin retrieved user details', {
      adminId: acting.id,
      adminUsername: acting.username,
      targetUserId: userId,
      targetUsername: user.username,
    });

    return user;
  }

  /**
   * Create a new user. Owns all input validation: username shape, password
   * strength, and the existence of the target role. Maps the Postgres
   * unique-violation error from the underlying `createUser` query to a
   * `ValidationError` so the HTTP layer can return a 400 with a stable
   * message.
   */
  async createUser(
    data: { username?: string; password?: string; roleId: number },
    acting: ActingUser,
  ): Promise<UserPublic> {
    const { username, password, roleId } = data;

    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }

    if (!USERNAME_REGEX.test(username)) {
      throw new ValidationError('Username must be alphanumeric and 3-15 characters long');
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      throw new ValidationError(passwordError);
    }

    if (!Number.isInteger(roleId)) {
      throw new ValidationError('role_id is required and must be a valid integer');
    }

    if (!(await roleExists(this.db, roleId))) {
      throw new ValidationError('Invalid role_id: role does not exist');
    }

    const passwordHash = await hashPassword(password);

    let newUser: UserPublic;
    try {
      newUser = await dbCreateUser(this.db, username, passwordHash, roleId);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ValidationError('Username already exists');
      }
      throw error;
    }

    logger.info('Admin created new user', {
      adminId: acting.id,
      adminUsername: acting.username,
      newUserId: newUser.id,
      newUsername: newUser.username,
      newUserRoleId: newUser.role_id,
      newUserRoleName: newUser.role_name,
    });

    return newUser;
  }

  /**
   * Change a user's role. Enforces the single shared last-admin invariant:
   * if the target is currently an admin and the new role is not admin, the
   * remaining admin count must be greater than one.
   *
   * Revokes the target's refresh tokens in the same transaction: permissions
   * are baked into the access token, so a refresh must not resurrect the old
   * role. Re-assigning the current role is a no-op and revokes nothing.
   */
  async updateUserRole(userId: number, roleId: number, acting: ActingUser): Promise<UserPublic> {
    const targetUser = await getUserById(this.db, userId);
    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    const newRoleName = await getRoleNameById(this.db, roleId);
    if (!newRoleName) {
      throw new ValidationError('Invalid role_id: role does not exist');
    }

    if (targetUser.role_id === roleId) {
      return targetUser;
    }

    await this.assertNotLastAdmin(targetUser.role_name, newRoleName);

    await this.db.transaction(async (tx) => {
      await dbUpdateUserRole(tx, userId, roleId);
      await revokeAllUserTokens(tx, userId);
    });

    const updatedUser = await getUserById(this.db, userId);

    logger.info('Admin updated user role', {
      adminId: acting.id,
      adminUsername: acting.username,
      targetUserId: userId,
      targetUsername: updatedUser!.username,
      oldRoleName: targetUser.role_name,
      newRoleId: roleId,
      sessionsRevoked: true,
    });

    return updatedUser!;
  }

  /**
   * Reset a user's password. The caller (client) generates the new password
   * and submits it; the service validates strength and stores a fresh hash,
   * revoking the target's refresh tokens in the same transaction so a
   * compromised account's existing sessions die with the old password.
   *
   * The user-existence check fires before password validation so the joint
   * case (missing user + invalid password) still surfaces 404 first,
   * preserving the pre-refactor wire shape exactly.
   */
  async resetPassword(userId: number, newPassword: unknown, acting: ActingUser): Promise<UserPublic> {
    const targetUser = await getUserById(this.db, userId);
    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    if (typeof newPassword !== 'string' || newPassword.length === 0) {
      throw new ValidationError('New password is required');
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      throw new ValidationError(passwordError);
    }

    const passwordHash = await hashPassword(newPassword);
    await this.db.transaction(async (tx) => {
      await dbUpdateUserPassword(tx, userId, passwordHash);
      await revokeAllUserTokens(tx, userId);
    });

    logger.info('Admin reset user password', {
      adminId: acting.id,
      adminUsername: acting.username,
      targetUserId: userId,
      targetUsername: targetUser.username,
      sessionsRevoked: true,
    });

    return targetUser;
  }

  /**
   * Delete a user. Enforces two safety guards:
   * 1. Self-delete: an admin cannot delete their own account.
   * 2. Last-admin: an admin whose removal would leave zero admins is rejected.
   * Both guards throw typed errors; the route shim surfaces them via the
   * shared error handler.
   */
  async deleteUser(userId: number, acting: ActingUser): Promise<void> {
    if (userId === acting.id) {
      throw new AuthError('Cannot delete your own account', 403);
    }

    const targetUser = await getUserById(this.db, userId);
    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    await this.assertNotLastAdmin(targetUser.role_name, null);

    const deleted = await dbDeleteUser(this.db, userId);
    if (!deleted) {
      throw new NotFoundError('User not found');
    }

    logger.info('Admin deleted user', {
      adminId: acting.id,
      adminUsername: acting.username,
      deletedUserId: userId,
      deletedUsername: targetUser.username,
      deletedUserRoleName: targetUser.role_name,
    });
  }

  /**
   * Single canonical implementation of the "at least one admin remains"
   * invariant. Both `updateUserRole` and `deleteUser` delegate here so the
   * rule exists in exactly one place in the source tree.
   *
   * Pass `nextRoleName === null` for delete flows (any non-admin role
   * suffices after the row is gone).
   */
  private async assertNotLastAdmin(currentRoleName: string, nextRoleName: string | null): Promise<void> {
    const isCurrentlyAdmin = currentRoleName === ADMIN_ROLE_NAME;
    const demotingFromAdmin = isCurrentlyAdmin && nextRoleName !== ADMIN_ROLE_NAME;
    const removingLastAdmin = isCurrentlyAdmin && nextRoleName === null;

    if (!demotingFromAdmin && !removingLastAdmin) {
      return;
    }

    const adminCount = await getAdminCount(this.db);
    if (adminCount <= 1) {
      const message = removingLastAdmin
        ? 'Cannot delete the last admin user'
        : 'Cannot demote the last admin user';
      throw new AuthError(message, 403);
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const e = error as { code?: unknown; message?: unknown };
  if (e.code === PG_UNIQUE_VIOLATION) {
    return true;
  }
  return typeof e.message === 'string' && e.message.includes('duplicate key');
}