/**
 * Custom application error class with HTTP status code and error code.
 * All service-layer errors should use this class for consistent error handling.
 * @module api-server/errors
 */

/** Standard error codes used across the application */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  RATE_LIMITED: 'RATE_LIMITED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  BRIDGE_ERROR: 'BRIDGE_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Application error with HTTP status code and machine-readable error code.
 * Thrown by service functions and caught by the centralized error handler.
 */
export class AppError extends Error {
  /** Machine-readable error code */
  readonly code: ErrorCodeValue;
  /** HTTP status code to return */
  readonly statusCode: number;
  /** Optional additional details for debugging */
  readonly details?: unknown;

  /**
   * @param code - Machine-readable error code
   * @param message - Human-readable error message
   * @param statusCode - HTTP status code (default 500)
   * @param details - Optional additional error details
   */
  constructor(code: ErrorCodeValue, message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
