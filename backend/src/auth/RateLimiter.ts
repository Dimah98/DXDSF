/**
 * RateLimiter - Rate Limiting Middleware
 *
 * Protects API endpoints from denial-of-service attacks and abuse by limiting
 * the number of requests per client within a time window.
 *
 * Clients are identified by:
 *   - userId (from JWT payload) for authenticated requests
 *   - IP address for unauthenticated requests
 *
 * Configured limits (Requirement 7):
 *   - /api/*                       : 100 requests per 15 minutes
 *   - /ws                          : 10 connections per 15 minutes
 *   - /api/projects/run-multiple   : 5 requests per 15 minutes
 *
 * Requirement 7: Rate Limiting for API Endpoints
 */

import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';

// ─── Window / limit constants ────────────────────────────────────────────────

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Requirement 7.1 – /api/* : 100 req / 15 min */
const API_MAX = 9999999;

/** Requirement 7.2 – /ws : 10 connections / 15 min */
const WS_MAX = 9999999;

/** Requirement 7.3 – /api/projects/run-multiple : 5 req / 15 min */
const RUN_MULTIPLE_MAX = 9999999;

// ─── Client key generator ────────────────────────────────────────────────────

/**
 * Derive a stable client identifier from the request.
 *
 * Requirement 7.4: Identify clients by IP address for unauthenticated requests
 * Requirement 7.5: Identify clients by userId for authenticated requests
 */
function keyGenerator(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.userId) {
    return `user:${authReq.user.userId}`;
  }
  // Fall back to IP address
  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  return `ip:${ip}`;
}

// ─── Shared handler options ──────────────────────────────────────────────────

/**
 * Build shared options for all rate limiters.
 *
 * Requirement 7.6: Return HTTP 429 Too Many Requests when limit exceeded
 * Requirement 7.7: Include X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers
 */
function buildOptions(max: number, message: string): Partial<Options> {
  return {
    windowMs: WINDOW_MS,
    max,
    keyGenerator,
    standardHeaders: true,   // sets X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
    legacyHeaders: false,     // disable deprecated X-RateLimit-* headers from v6
    statusCode: 429,
    message: { success: false, error: message },
    handler(req: Request, res: Response) {
      res.status(429).json({ success: false, error: message });
    },
    skip: () => false,
  };
}

// ─── Rate limiter instances ──────────────────────────────────────────────────

/**
 * Rate limiter for all /api/* endpoints.
 * Requirement 7.1: 100 requests per 15 minutes per client
 */
export const apiRateLimiter: RateLimitRequestHandler = rateLimit({
  ...buildOptions(API_MAX, 'Too many requests. Please try again later.'),
});

/**
 * Rate limiter for /ws connections.
 * Requirement 7.2: 10 connections per 15 minutes per client
 */
export const wsRateLimiter: RateLimitRequestHandler = rateLimit({
  ...buildOptions(WS_MAX, 'Too many WebSocket connection attempts. Please try again later.'),
});

/**
 * Stricter rate limiter for /api/projects/run-multiple.
 * Requirement 7.3: 5 requests per 15 minutes per client
 */
export const runMultipleRateLimiter: RateLimitRequestHandler = rateLimit({
  ...buildOptions(RUN_MULTIPLE_MAX, 'Too many run-multiple requests. Please try again later.'),
});

// ─── Named export object (matches RateLimiter interface from types.ts) ────────

export const RateLimiter = {
  apiRateLimiter,
  wsRateLimiter,
  runMultipleRateLimiter,
};

export default RateLimiter;
