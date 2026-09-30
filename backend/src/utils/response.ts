import { Response } from 'express';
import { isAppError, normalizeError } from '../errors';

/**
 * Standard API response interfaces
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
  [key: string]: any;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Send standard success response
 */
export function sendSuccess<T>(
  res: Response,
  data?: T,
  statusCode: number = 200,
  extra?: Record<string, any>
): Response {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    ...(data !== undefined ? { data } : {}),
    ...(extra || {}),
  };
  return res.status(statusCode).json(payload);
}

/**
 * Send standard error response
 */
export function sendError(
  res: Response,
  error: unknown,
  defaultStatusCode: number = 500,
  fallbackCode: string = 'INTERNAL_ERROR'
): Response {
  const normalized = normalizeError(error);
  let statusCode = defaultStatusCode;
  let code = fallbackCode;
  let details: Record<string, unknown> | undefined;

  if (isAppError(normalized)) {
    statusCode = normalized.statusCode;
    code = normalized.code;
    details = normalized.context;
  }

  const payload: ApiErrorResponse = {
    success: false,
    error: normalized.message || 'An unexpected error occurred',
    code,
    statusCode,
    ...(details ? { details } : {}),
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(payload);
}
