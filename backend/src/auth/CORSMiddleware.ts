/**
 * CORSMiddleware - Cross-Origin Resource Sharing Middleware
 *
 * Validates the Origin header against the ALLOWED_ORIGINS configuration and
 * sets the appropriate CORS response headers for allowed origins.
 * Requests from disallowed origins are rejected with HTTP 403 Forbidden.
 *
 * Requirement 25: CORS Configuration
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/ConfigManager';

/**
 * Determine whether the given origin is in the allowed origins list.
 *
 * Requirement 25.1: Read allowed origins from ALLOWED_ORIGINS env variable.
 * Requirement 25.2: Validate the Origin header against the allowed origins list.
 * Requirement 25.5: Support multiple allowed origins separated by commas.
 */
export function isOriginAllowed(origin: string): boolean {
  const allowedOrigins = config.get('ALLOWED_ORIGINS');
  return allowedOrigins.includes(origin);
}

/**
 * Express middleware that enforces CORS policy.
 *
 * For requests with an Origin header:
 *   - Allowed origin  → set CORS headers and call next() (Requirement 25.3)
 *   - Disallowed origin → return HTTP 403 Forbidden (Requirement 25.4)
 *
 * For requests without an Origin header (e.g. same-origin or server-to-server):
 *   - Pass through without setting CORS headers.
 *
 * Preflight (OPTIONS) requests from an allowed origin receive a 204 No Content
 * response with the appropriate CORS headers so browsers can proceed.
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers['origin'] as string | undefined;

  // No Origin header — not a cross-origin request; pass through.
  if (!origin) {
    next();
    return;
  }

  // Requirement 25.2 / 25.4: Reject disallowed origins with HTTP 403.
  if (!isOriginAllowed(origin)) {
    res.status(403).json({ success: false, error: 'Origin not allowed' });
    return;
  }

  // Requirement 25.3: Set CORS headers for allowed origins.
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS, PATCH'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-CSRF-Token, X-Session-Id'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours preflight cache

  // Handle preflight OPTIONS request — respond immediately with 204.
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

/**
 * CORSMiddleware object providing a unified API consistent with the other
 * middleware modules in this project.
 */
export const CORSMiddleware = {
  middleware: corsMiddleware,
  isOriginAllowed,
};

export default CORSMiddleware;
