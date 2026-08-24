/**
 * Unit tests for CSRFMiddleware
 *
 * Tests CSRF token generation, verification, and the Express middleware function.
 * Requirement 2: CSRF Protection
 */

import { describe, it, expect, vi } from 'vitest';
import { generateToken, verifyToken, removeToken, csrfMiddleware } from './CSRFMiddleware';
import type { Request, Response, NextFunction } from 'express';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeReqResNext(
  method: string,
  headers: Record<string, string> = {}
) {
  const req = {
    method,
    headers,
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

// ─── generateToken ───────────────────────────────────────────────────────────

describe('generateToken', () => {
  it('returns a non-empty hex string', () => {
    const token = generateToken('session-1');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it('generates a 64-character hex string (32 bytes)', () => {
    const token = generateToken('session-2');
    expect(token.length).toBe(64);
  });

  it('generates different tokens for different sessions (Requirement 2.1)', () => {
    const t1 = generateToken('session-a');
    const t2 = generateToken('session-b');
    expect(t1).not.toBe(t2);
  });

  it('generates different tokens on repeated calls for the same session', () => {
    const t1 = generateToken('session-c');
    const t2 = generateToken('session-c');
    // Tokens should be different each time (random)
    expect(t1).not.toBe(t2);
  });
});

// ─── verifyToken ─────────────────────────────────────────────────────────────

describe('verifyToken', () => {
  it('returns true for a valid token/session pair (Requirement 2.6)', () => {
    const sessionId = 'verify-session-1';
    const token = generateToken(sessionId);
    expect(verifyToken(token, sessionId)).toBe(true);
  });

  it('returns false for an incorrect token (Requirement 2.5)', () => {
    const sessionId = 'verify-session-2';
    generateToken(sessionId);
    expect(verifyToken('wrong-token', sessionId)).toBe(false);
  });

  it('returns false for an unknown session ID', () => {
    expect(verifyToken('any-token', 'nonexistent-session')).toBe(false);
  });

  it('returns false after the token has been removed', () => {
    const sessionId = 'verify-session-3';
    const token = generateToken(sessionId);
    removeToken(sessionId);
    expect(verifyToken(token, sessionId)).toBe(false);
  });

  it('returns false for an empty token string', () => {
    const sessionId = 'verify-session-4';
    generateToken(sessionId);
    expect(verifyToken('', sessionId)).toBe(false);
  });

  it('returns false when token from a different session is used', () => {
    const token = generateToken('session-x');
    generateToken('session-y');
    // token belongs to session-x, not session-y
    expect(verifyToken(token, 'session-y')).toBe(false);
  });
});

// ─── csrfMiddleware ───────────────────────────────────────────────────────────

describe('csrfMiddleware', () => {
  // ── GET requests ──────────────────────────────────────────────────────────

  it('calls next() for GET requests without any CSRF header (Requirement 2.3)', () => {
    const { req, res, next } = makeReqResNext('GET');
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() for GET requests even with no session header', () => {
    const { req, res, next } = makeReqResNext('GET', { 'x-csrf-token': 'anything' });
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  // ── Non-mutating methods ───────────────────────────────────────────────────

  it('calls next() for HEAD requests without CSRF header', () => {
    const { req, res, next } = makeReqResNext('HEAD');
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next() for OPTIONS requests without CSRF header', () => {
    const { req, res, next } = makeReqResNext('OPTIONS');
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  // ── POST without CSRF token ────────────────────────────────────────────────

  it('returns 403 for POST without X-CSRF-Token header (Requirement 2.4)', () => {
    const { req, res, next } = makeReqResNext('POST');
    csrfMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for PUT without X-CSRF-Token header (Requirement 2.4)', () => {
    const { req, res, next } = makeReqResNext('PUT');
    csrfMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for DELETE without X-CSRF-Token header (Requirement 2.4)', () => {
    const { req, res, next } = makeReqResNext('DELETE');
    csrfMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ── POST with CSRF token but no session ID ─────────────────────────────────

  it('returns 403 for POST with X-CSRF-Token but missing X-Session-Id', () => {
    const { req, res, next } = makeReqResNext('POST', {
      'x-csrf-token': 'some-token',
    });
    csrfMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ── POST with invalid CSRF token ───────────────────────────────────────────

  it('returns 403 for POST with invalid CSRF token (Requirement 2.5)', () => {
    const sessionId = 'middleware-session-1';
    generateToken(sessionId); // store a real token
    const { req, res, next } = makeReqResNext('POST', {
      'x-csrf-token': 'invalid-token',
      'x-session-id': sessionId,
    });
    csrfMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for POST with token from a different session (Requirement 2.5)', () => {
    const sessionA = 'middleware-session-a';
    const sessionB = 'middleware-session-b';
    const tokenA = generateToken(sessionA);
    generateToken(sessionB);

    const { req, res, next } = makeReqResNext('POST', {
      'x-csrf-token': tokenA,
      'x-session-id': sessionB, // wrong session
    });
    csrfMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ── POST with valid CSRF token ─────────────────────────────────────────────

  it('calls next() for POST with valid CSRF token (Requirement 2.6)', () => {
    const sessionId = 'middleware-session-valid-post';
    const token = generateToken(sessionId);
    const { req, res, next } = makeReqResNext('POST', {
      'x-csrf-token': token,
      'x-session-id': sessionId,
    });
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() for PUT with valid CSRF token (Requirement 2.6)', () => {
    const sessionId = 'middleware-session-valid-put';
    const token = generateToken(sessionId);
    const { req, res, next } = makeReqResNext('PUT', {
      'x-csrf-token': token,
      'x-session-id': sessionId,
    });
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() for DELETE with valid CSRF token (Requirement 2.6)', () => {
    const sessionId = 'middleware-session-valid-delete';
    const token = generateToken(sessionId);
    const { req, res, next } = makeReqResNext('DELETE', {
      'x-csrf-token': token,
      'x-session-id': sessionId,
    });
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  // ── Token removed / expired ────────────────────────────────────────────────

  it('returns 403 after the session token has been removed', () => {
    const sessionId = 'middleware-session-removed';
    const token = generateToken(sessionId);
    removeToken(sessionId);

    const { req, res, next } = makeReqResNext('POST', {
      'x-csrf-token': token,
      'x-session-id': sessionId,
    });
    csrfMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
