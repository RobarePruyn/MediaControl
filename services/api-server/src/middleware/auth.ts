/**
 * JWT authentication middleware for the API server.
 * Verifies access tokens on protected routes and attaches decoded user
 * claims to the request object for downstream handlers.
 * @module api-server/middleware/auth
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { AppError, ErrorCode } from '../errors.js';
import type { UserRole } from '@suitecommand/types';

/** JWT payload claims stored in access tokens */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string;
  iat: number;
  exp: number;
}

/** Extended request with authenticated user claims */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * Middleware that requires a valid JWT access token in the Authorization header.
 * Attaches decoded claims to `req.user`.
 * @param accessSecret - JWT signing secret for access tokens
 */
export function requireAuth(accessSecret: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Missing or invalid Authorization header', 401);
    }

    const token = authHeader.slice(7);

    try {
      const decoded = jwt.verify(token, accessSecret) as JwtPayload;
      (req as AuthenticatedRequest).user = decoded;
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError(ErrorCode.TOKEN_EXPIRED, 'Access token has expired', 401);
      }
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid access token', 401);
    }
  };
}

/**
 * Middleware that requires the authenticated user to have one of the specified roles.
 * Must be used after requireAuth.
 * @param allowedRoles - Array of roles permitted to access the route
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    if (!allowedRoles.includes(user.role)) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        `Role '${user.role}' is not authorized for this action`,
        403,
      );
    }

    next();
  };
}
