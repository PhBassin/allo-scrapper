/**
 * Test helpers for mocking the permission middleware (`../middleware/permission.js`).
 *
 * Usage:
 *   import { mockPermissionPassthrough } from '../test-utils/permission.js';
 *   vi.mock('../middleware/permission.js', mockPermissionPassthrough);
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Simple passthrough — accept everything
// ---------------------------------------------------------------------------

/** Mock that lets every request through permission checks unconditionally. */
export const mockPermissionPassthrough = () => ({
  requirePermission: (..._perms: string[]) =>
    vi.fn(function requirePermission(_req: any, _res: any, next: any) { next(); }),
});

// ---------------------------------------------------------------------------
// Conditional — only certain user IDs pass
// ---------------------------------------------------------------------------

/**
 * Mock that only allows users whose `id` is in the `allowedIds` set.
 * Other users get a 403.
 *
 * @param allowedIds - User IDs that pass permission checks. Default: [1] (admin only).
 */
export const mockPermissionContext = (allowedIds: number[] = [1]) => ({
  requirePermission: (..._perms: string[]) =>
    async (req: any, res: any, next: any) => {
      if (allowedIds.includes(req.user?.id)) {
        next();
      } else {
        res.status(403).json({ success: false, error: 'Permission denied' });
      }
    },
});

// ---------------------------------------------------------------------------
// Flat passthrough (no curried vi.fn wrapper)
// ---------------------------------------------------------------------------

/** Simpler variant — returns a direct middleware, not wrapped in vi.fn. */
export const mockPermissionFlat = () => ({
  requirePermission: (..._perms: string[]) =>
    function requirePermission(_req: any, _res: any, next: any) { next(); },
});
