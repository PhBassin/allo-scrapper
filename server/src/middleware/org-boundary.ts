import type { NextFunction, Response } from 'express';
import { AuthError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { AuthRequest } from './auth.js';

const CROSS_TENANT_MESSAGE = 'Cross-tenant access denied';

function parseOrgId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value, 10);
  }

  return null;
}

function logBoundaryEvent(
  req: AuthRequest,
  event: 'org_boundary_denied' | 'org_boundary_body_sanitized',
  authenticatedOrgId: number,
  requestedOrgId: number
): void {
  logger.warn('Tenant org boundary enforcement', {
    event,
    org_id: authenticatedOrgId,
    requested_org_id: requestedOrgId,
    user_id: req.user?.id,
    method: req.method,
    path: req.path,
  });
}

/**
 * Enforces tenant org boundary from JWT context.
 *
 * - Query mismatch (`?org_id=`) is rejected with 403
 * - Body `org_id` is normalized to authenticated org and manipulation is logged
 */
export function enforceOrgBoundary(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authenticatedOrgId = req.user?.org_id;

  if (authenticatedOrgId === undefined || authenticatedOrgId === null) {
    next();
    return;
  }

  const queryOrgId = parseOrgId((req.query as Record<string, unknown>)['org_id']);
  if (queryOrgId !== null && queryOrgId !== authenticatedOrgId) {
    logBoundaryEvent(req, 'org_boundary_denied', authenticatedOrgId, queryOrgId);
    next(new AuthError(CROSS_TENANT_MESSAGE, 403));
    return;
  }

  const body = req.body as Record<string, unknown> | undefined;
  if (body && Object.prototype.hasOwnProperty.call(body, 'org_id')) {
    const bodyOrgId = parseOrgId(body['org_id']);
    if (bodyOrgId !== null && bodyOrgId !== authenticatedOrgId) {
      logBoundaryEvent(req, 'org_boundary_body_sanitized', authenticatedOrgId, bodyOrgId);
    }
    body['org_id'] = authenticatedOrgId;
  }

  next();
}

export { CROSS_TENANT_MESSAGE };
