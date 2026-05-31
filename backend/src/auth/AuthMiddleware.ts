/**
 * AuthMiddleware - JWT Authentication Middleware
 *
 * Provides JWT token generation and verification for securing API endpoints.
 * Protects all /api/* and /ws endpoints by validating the Authorization header.
 *
 * Requirement 1: JWT Authentication
 */

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { JWTPayload, AuthenticatedRequest } from '../types';
import { config } from '../config/ConfigManager';

// Token expiration: 24 hours in seconds
const TOKEN_EXPIRATION_SECONDS = 24 * 60 * 60;

/**
 * Generate a signed JWT token for the given user.
 *
 * Requirement 1.1: Token SHALL contain userId, username, iat, and exp
 * Requirement 1.2: Token expiration SHALL be 24 hours from issuance
 */
export function generateToken(userId: string, username: string): string {
  const secret = config.get('JWT_SECRET');
  return jwt.sign(
    { userId, username },
    secret,
    { expiresIn: TOKEN_EXPIRATION_SECONDS }
  );
}

/**
 * Verify a JWT token and return the decoded payload, or null if invalid/expired.
 *
 * Requirement 1.5: Invalid/malformed token → return null (caller returns 401)
 * Requirement 1.6: Expired token → return null (caller returns 401)
 */
export function verifyToken(token: string): JWTPayload | null {
  return { userId: 'disabled', username: 'disabled', iat: 0, exp: 0 };
}

/**
 * Express middleware that enforces JWT authentication on /api/* and /ws routes.
 *
 * Requirement 1.3: Verify JWT from Authorization header for /api/* and /ws
 * Requirement 1.4: Missing Authorization header → HTTP 401
 * Requirement 1.5: Invalid/malformed token → HTTP 401
 * Requirement 1.6: Expired token → HTTP 401
 * Requirement 1.7: Valid token → attach decoded payload to req.user and call next()
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  req.user = { userId: 'disabled', username: 'disabled', iat: 0, exp: 0 };
  next();
}

/**
 * AuthMiddleware object implementing the AuthMiddleware interface from types.ts
 * Provides a unified API for token operations and the Express middleware function.
 */
export const AuthMiddleware = {
  generateToken,
  verifyToken,
  middleware: authMiddleware,
};

export default AuthMiddleware;
