/**
 * Venue-scoped permission middleware for the API server.
 * Validates venue access via the user_venues join table and checks
 * role-based permissions against the PERMISSION_MATRIX.
 * @module api-server/middleware/permissions
 */

import type { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';

import type { UserRole } from '@suitecommand/types';
import type { Database } from '../db/client.js';
import { userVenues } from '../db/schema.js';
import type { TenantScopedRequest } from './tenantScope.js';
import { AppError, ErrorCode } from '../errors.js';

/** Request with venue scope attached (extends tenant scope) */
export interface VenueScopedRequest extends TenantScopedRequest {
  venueId: string;
}

/** Permissions that can be checked against the matrix */
export type PermissionAction =
  | 'venue:create'
  | 'venue:delete'
  | 'venue:view'
  | 'venue:assign_users'
  | 'entity:crud'       // controllers, groups, endpoints, triggers
  | 'entity:edit_light'  // channels, branding (lighter writes)
  | 'trigger:execute'
  | 'settings:manage'   // TLS, SSO
  | 'users:manage';

/** Permission matrix mapping roles to allowed actions */
const PERMISSION_MATRIX: Record<UserRole, Set<PermissionAction>> = {
  super_admin: new Set([
    'venue:create', 'venue:delete', 'venue:view', 'venue:assign_users',
    'entity:crud', 'entity:edit_light', 'trigger:execute',
    'settings:manage', 'users:manage',
  ]),
  app_admin: new Set([
    'venue:create', 'venue:view', 'venue:assign_users',
    'settings:manage', 'users:manage',
  ]),
  venue_super_admin: new Set([
    'venue:view', 'venue:assign_users',
    'entity:crud', 'entity:edit_light', 'trigger:execute',
  ]),
  venue_operator: new Set([
    'venue:view', 'entity:edit_light', 'trigger:execute',
  ]),
  end_user: new Set([]),
};

/**
 * Fetch the venue IDs a user has access to. Memoized per-request on req object.
 * @param db - Database client
 * @param userId - User ID to look up
 * @param req - Request object for memoization
 */
async function getUserVenueIds(db: Database, userId: string, req: Request): Promise<string[]> {
  const memo = req as Request & { _venueIds?: string[] };
  if (memo._venueIds) return memo._venueIds;

  const rows = await db
    .select({ venueId: userVenues.venueId })
    .from(userVenues)
    .where(eq(userVenues.userId, userId));

  memo._venueIds = rows.map(r => r.venueId);
  return memo._venueIds;
}

/**
 * Middleware that validates the user has access to the venue specified in req.params.venueId.
 * super_admin skips the check — they have implicit access to all venues.
 * Attaches req.venueId for downstream handlers.
 * @param db - Database client
 */
export function requireVenueAccess(db: Database) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const tsReq = req as TenantScopedRequest;
    const venueId = String(req.params.venueId);

    if (!venueId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Venue ID is required in the URL path', 400);
    }

    // super_admin has implicit access to all venues
    if (tsReq.user.role === 'super_admin') {
      (req as VenueScopedRequest).venueId = venueId;
      return next();
    }

    const venueIds = await getUserVenueIds(db, tsReq.user.sub, req);

    if (!venueIds.includes(venueId)) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'You do not have access to this venue',
        403,
      );
    }

    (req as VenueScopedRequest).venueId = venueId;
    next();
  };
}

/**
 * Middleware that checks the user's role against the permission matrix for a given action.
 * Also validates venue access if a venueId is in the URL params.
 * @param db - Database client
 * @param action - The permission action to check
 */
export function requirePermission(db: Database, action: PermissionAction) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const tsReq = req as TenantScopedRequest;
    const { role } = tsReq.user;

    const allowed = PERMISSION_MATRIX[role];
    if (!allowed?.has(action)) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        `Role '${role}' is not authorized for action '${action}'`,
        403,
      );
    }

    // If there's a venueId param, also verify venue access
    const venueId = req.params.venueId ? String(req.params.venueId) : undefined;
    if (venueId && role !== 'super_admin') {
      const venueIds = await getUserVenueIds(db, tsReq.user.sub, req);
      if (!venueIds.includes(venueId)) {
        throw new AppError(
          ErrorCode.FORBIDDEN,
          'You do not have access to this venue',
          403,
        );
      }
      (req as VenueScopedRequest).venueId = venueId;
    } else if (venueId) {
      (req as VenueScopedRequest).venueId = venueId;
    }

    next();
  };
}

/**
 * Fetch venue IDs for a user (exported for use in auth service / login response).
 * @param db - Database client
 * @param userId - User ID
 */
export async function fetchUserVenueIds(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .select({ venueId: userVenues.venueId })
    .from(userVenues)
    .where(eq(userVenues.userId, userId));

  return rows.map(r => r.venueId);
}
