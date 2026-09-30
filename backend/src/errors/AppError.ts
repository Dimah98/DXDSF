/**
 * Application Error Hierarchy
 *
 * Provides strongly-typed error classes to replace generic Error | string:
 * - AppError: Base operational/programmatic error with HTTP status, code, context & timestamp
 * - ValidationError: Input/schema validation failures (HTTP 400)
 * - AuthenticationError: Invalid token/credentials (HTTP 401)
 * - NotFoundError: Missing project, run, file, or resource (HTTP 404)
 * - DatabaseError: SQLite or data persistence failures (HTTP 500)
 * - BrowserError: Playwright/Camoufox automation failures (HTTP 500)
 */

export interface ErrorOptions {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
  context?: Record<string, unknown>;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(message: string, options?: ErrorOptions) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = options?.statusCode ?? 500;
    this.code = options?.code ?? 'INTERNAL_ERROR';
    this.isOperational = options?.isOperational ?? true;
    this.context = options?.context;
    this.timestamp = new Date().toISOString();

    if (options?.cause) {
      const causeStack = options.cause instanceof Error ? options.cause.stack : String(options.cause);
      this.stack = `${this.stack}\nCaused by: ${causeStack}`;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * 400 Bad Request — Input validation failure
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>, cause?: unknown) {
    super(message, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      isOperational: true,
      context,
      cause,
    });
  }
}

/**
 * 401 Unauthorized — Authentication or token validation failure
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', context?: Record<string, unknown>, cause?: unknown) {
    super(message, {
      statusCode: 401,
      code: 'AUTHENTICATION_ERROR',
      isOperational: true,
      context,
      cause,
    });
  }
}

/**
 * 404 Not Found — Requested resource does not exist
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', context?: Record<string, unknown>) {
    super(message, {
      statusCode: 404,
      code: 'NOT_FOUND',
      isOperational: true,
      context,
    });
  }
}

/**
 * 500 Internal Server Error — SQLite database query/transaction error
 */
export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, unknown>, cause?: unknown) {
    super(message, {
      statusCode: 500,
      code: 'DATABASE_ERROR',
      isOperational: true,
      context,
      cause,
    });
  }
}

/**
 * 500 Internal Server Error — Playwright / Camoufox automation error
 */
export class BrowserError extends AppError {
  constructor(message: string, context?: Record<string, unknown>, cause?: unknown) {
    super(message, {
      statusCode: 500,
      code: 'BROWSER_ERROR',
      isOperational: true,
      context,
      cause,
    });
  }
}

/**
 * Type guard to check if an unknown value is an AppError instance
 */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/**
 * Normalizes any unknown thrown value (Error, string, plain object) into an Error
 * while rigorously preserving the original stack trace.
 */
export function normalizeError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    const message = typeof obj.message === 'string' ? obj.message : JSON.stringify(err);
    const normalized = new Error(message);
    if (typeof obj.stack === 'string') {
      normalized.stack = obj.stack;
    }
    return normalized;
  }
  return new Error(typeof err === 'string' ? err : String(err));
}
