/**
 * Centralized error handler middleware for the API server.
 * Catches AppError instances and Zod validation errors, returning
 * consistent JSON error responses.
 * @module api-server/middleware/errorHandler
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import { AppError, ErrorCode } from '../errors.js';

/**
 * Express error-handling middleware. Must be registered last in the middleware chain.
 * Converts errors into the standard ApiErrorResponse shape.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // AppError — use its code and status directly
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    });
    return;
  }

  // Zod validation error — map to 400
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Request validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // Unexpected error — log and return 500
  console.error('[ErrorHandler] Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    },
  });
}
