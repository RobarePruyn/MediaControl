/**
 * Internal authentication middleware for the Bridge Agent.
 * Verifies the X-Internal-Secret header on every request to ensure
 * only the API server can call the bridge agent.
 * @module bridge-agent/middleware/internalAuth
 */

import type { Request, Response, NextFunction } from 'express';

const INTERNAL_SECRET_HEADER = 'x-internal-secret';

/**
 * Create middleware that validates the internal secret header.
 * @param secret - The expected shared secret value
 * @returns Express middleware function
 */
export function createInternalAuthMiddleware(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const provided = req.headers[INTERNAL_SECRET_HEADER];

    if (!provided || provided !== secret) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing internal secret' },
      });
      return;
    }

    next();
  };
}
