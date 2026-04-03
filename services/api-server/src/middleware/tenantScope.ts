/**
 * Tenant scoping middleware for the API server.
 * Ensures every admin DB query is scoped to the authenticated user's tenant.
 * Extracts tenant_id from the JWT claims and attaches it to the request.
 * @module api-server/middleware/tenantScope
 */

import type { Request, Response, NextFunction } from 'express';

import type { AuthenticatedRequest } from './auth.js';
import { AppError, ErrorCode } from '../errors.js';

/** Request with tenant scope attached */
export interface TenantScopedRequest extends AuthenticatedRequest {
  tenantId: string;
}

/**
 * Middleware that extracts the tenant ID from the authenticated user's JWT claims.
 * Must be used after requireAuth middleware.
 * Attaches `req.tenantId` for use in downstream route handlers and service calls.
 */
export function tenantScope(req: Request, _res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user?.tenantId) {
    throw new AppError(
      ErrorCode.UNAUTHORIZED,
      'Tenant context missing from authentication token',
      401,
    );
  }

  (req as TenantScopedRequest).tenantId = authReq.user.tenantId;
  next();
}
