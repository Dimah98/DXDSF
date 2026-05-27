/**
 * SecurityHeadersMiddleware - Security Headers Middleware
 *
 * Sets security-related HTTP response headers on all responses to mitigate
 * common web vulnerabilities such as MIME-type sniffing, clickjacking,
 * XSS attacks, and protocol downgrade attacks.
 *
 * Requirement 26: Security Headers
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Content-Security-Policy directives.
 *
 * The policy is intentionally strict:
 * - default-src 'self'  — only allow resources from the same origin by default
 * - script-src 'self'   — only allow scripts from the same origin
 * - style-src 'self' 'unsafe-inline' — allow inline styles (needed for many UI frameworks)
 * - img-src 'self' data: blob: — allow images from same origin, data URIs, and blobs
 * - connect-src 'self' ws: wss: — allow WebSocket connections
 * - font-src 'self'     — only allow fonts from the same origin
 * - object-src 'none'   — disallow plugins (Flash, etc.)
 * - frame-ancestors 'none' — disallow embedding in frames (complements X-Frame-Options)
 * - base-uri 'self'     — restrict <base> tag to same origin
 * - form-action 'self'  — restrict form submissions to same origin
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' ws: wss:",
  "font-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/**
 * Determine whether the current request was made over HTTPS.
 *
 * Checks both the native TLS flag and the common X-Forwarded-Proto header
 * that reverse proxies (nginx, AWS ALB, etc.) set when terminating TLS.
 */
function isHttps(req: Request): boolean {
  return (
    req.secure ||
    req.protocol === 'https' ||
    req.headers['x-forwarded-proto'] === 'https'
  );
}

/**
 * Express middleware that sets security headers on every response.
 *
 * Requirement 26.1: X-Content-Type-Options: nosniff
 * Requirement 26.2: X-Frame-Options: DENY
 * Requirement 26.3: X-XSS-Protection: 1; mode=block
 * Requirement 26.4: Strict-Transport-Security on HTTPS responses
 * Requirement 26.5: Content-Security-Policy with appropriate directives
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Requirement 26.1: Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Requirement 26.2: Prevent clickjacking by disallowing framing
  res.setHeader('X-Frame-Options', 'DENY');

  // Requirement 26.3: Enable browser's built-in XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Requirement 26.4: Enforce HTTPS for 1 year (only on HTTPS connections)
  if (isHttps(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Requirement 26.5: Content Security Policy
  res.setHeader('Content-Security-Policy', CSP_DIRECTIVES);

  next();
}

/**
 * SecurityHeadersMiddleware object providing a unified API consistent with
 * the other middleware modules in this project.
 */
export const SecurityHeadersMiddleware = {
  middleware: securityHeadersMiddleware,
  CSP_DIRECTIVES,
};

export default SecurityHeadersMiddleware;
