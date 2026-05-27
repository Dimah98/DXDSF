/**
 * Unit tests for SecurityHeadersMiddleware
 *
 * Tests that all required security headers are set on responses.
 * Requirement 26: Security Headers
 */

import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { securityHeadersMiddleware, SecurityHeadersMiddleware } from './SecurityHeadersMiddleware';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock Express request.
 * Optionally simulate HTTPS via req.secure, req.protocol, or x-forwarded-proto.
 */
function makeReqResNext(opts: {
  secure?: boolean;
  protocol?: string;
  forwardedProto?: string;
} = {}) {
  const headers: Record<string, string> = {};
  if (opts.forwardedProto) {
    headers['x-forwarded-proto'] = opts.forwardedProto;
  }

  const req = {
    secure: opts.secure ?? false,
    protocol: opts.protocol ?? 'http',
    headers,
  } as unknown as Request;

  const setHeaders: Record<string, string> = {};
  const res = {
    setHeader: vi.fn((name: string, value: string) => {
      setHeaders[name] = value;
    }),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next, setHeaders };
}

// ─── securityHeadersMiddleware ────────────────────────────────────────────────

describe('securityHeadersMiddleware', () => {
  // ── Requirement 26.1: X-Content-Type-Options ─────────────────────────────

  it('sets X-Content-Type-Options to "nosniff" (Requirement 26.1)', () => {
    const { req, res, next, setHeaders } = makeReqResNext();
    securityHeadersMiddleware(req, res, next);
    expect(setHeaders['X-Content-Type-Options']).toBe('nosniff');
  });

  // ── Requirement 26.2: X-Frame-Options ────────────────────────────────────

  it('sets X-Frame-Options to "DENY" (Requirement 26.2)', () => {
    const { req, res, next, setHeaders } = makeReqResNext();
    securityHeadersMiddleware(req, res, next);
    expect(setHeaders['X-Frame-Options']).toBe('DENY');
  });

  // ── Requirement 26.3: X-XSS-Protection ───────────────────────────────────

  it('sets X-XSS-Protection to "1; mode=block" (Requirement 26.3)', () => {
    const { req, res, next, setHeaders } = makeReqResNext();
    securityHeadersMiddleware(req, res, next);
    expect(setHeaders['X-XSS-Protection']).toBe('1; mode=block');
  });

  // ── Requirement 26.4: Strict-Transport-Security ───────────────────────────

  it('does NOT set Strict-Transport-Security on plain HTTP (Requirement 26.4)', () => {
    const { req, res, next, setHeaders } = makeReqResNext({ secure: false, protocol: 'http' });
    securityHeadersMiddleware(req, res, next);
    expect(setHeaders['Strict-Transport-Security']).toBeUndefined();
  });

  it('sets Strict-Transport-Security when req.secure is true (Requirement 26.4)', () => {
    const { req, res, next, setHeaders } = makeReqResNext({ secure: true });
    securityHeadersMiddleware(req, res, next);
    expect(setHeaders['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
  });

  it('sets Strict-Transport-Security when req.protocol is "https" (Requirement 26.4)', () => {
    const { req, res, next, setHeaders } = makeReqResNext({ protocol: 'https' });
    securityHeadersMiddleware(req, res, next);
    expect(setHeaders['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
  });

  it('sets Strict-Transport-Security when x-forwarded-proto is "https" (Requirement 26.4)', () => {
    const { req, res, next, setHeaders } = makeReqResNext({ forwardedProto: 'https' });
    securityHeadersMiddleware(req, res, next);
    expect(setHeaders['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
  });

  // ── Requirement 26.5: Content-Security-Policy ─────────────────────────────

  it('sets Content-Security-Policy header (Requirement 26.5)', () => {
    const { req, res, next, setHeaders } = makeReqResNext();
    securityHeadersMiddleware(req, res, next);
    expect(setHeaders['Content-Security-Policy']).toBeDefined();
    expect(typeof setHeaders['Content-Security-Policy']).toBe('string');
    expect(setHeaders['Content-Security-Policy'].length).toBeGreaterThan(0);
  });

  it('CSP includes default-src directive (Requirement 26.5)', () => {
    const { req, res, next, setHeaders } = makeReqResNext();
    securityHeadersMiddleware(req, res, next);
    expect(setHeaders['Content-Security-Policy']).toContain("default-src 'self'");
  });

  it('CSP includes script-src directive (Requirement 26.5)', () => {
    const { req, res, next, setHeaders } = makeReqResNext();
    securityHeadersMiddleware(req, res, next);
    expect(setHeaders['Content-Security-Policy']).toContain('script-src');
  });

  it('CSP includes object-src none to block plugins (Requirement 26.5)', () => {
    const { req, res, next, setHeaders } = makeReqResNext();
    securityHeadersMiddleware(req, res, next);
    expect(setHeaders['Content-Security-Policy']).toContain("object-src 'none'");
  });

  it('CSP includes frame-ancestors none to prevent framing (Requirement 26.5)', () => {
    const { req, res, next, setHeaders } = makeReqResNext();
    securityHeadersMiddleware(req, res, next);
    expect(setHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  });

  // ── Middleware flow ────────────────────────────────────────────────────────

  it('calls next() after setting headers', () => {
    const { req, res, next } = makeReqResNext();
    securityHeadersMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('sets all required headers in a single call', () => {
    const { req, res, next, setHeaders } = makeReqResNext({ secure: true });
    securityHeadersMiddleware(req, res, next);

    expect(setHeaders['X-Content-Type-Options']).toBeDefined();
    expect(setHeaders['X-Frame-Options']).toBeDefined();
    expect(setHeaders['X-XSS-Protection']).toBeDefined();
    expect(setHeaders['Strict-Transport-Security']).toBeDefined();
    expect(setHeaders['Content-Security-Policy']).toBeDefined();
  });
});

// ─── SecurityHeadersMiddleware object ────────────────────────────────────────

describe('SecurityHeadersMiddleware', () => {
  it('exposes a middleware function', () => {
    expect(typeof SecurityHeadersMiddleware.middleware).toBe('function');
  });

  it('middleware property is the same as the named export', () => {
    expect(SecurityHeadersMiddleware.middleware).toBe(securityHeadersMiddleware);
  });

  it('exposes CSP_DIRECTIVES as a non-empty string', () => {
    expect(typeof SecurityHeadersMiddleware.CSP_DIRECTIVES).toBe('string');
    expect(SecurityHeadersMiddleware.CSP_DIRECTIVES.length).toBeGreaterThan(0);
  });

  it('CSP_DIRECTIVES contains expected security directives', () => {
    const csp = SecurityHeadersMiddleware.CSP_DIRECTIVES;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });
});
