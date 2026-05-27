/**
 * Unit tests for AuthMiddleware
 *
 * Tests JWT token generation, verification, and the Express middleware function.
 * Requirement 1: JWT Authentication
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateToken, verifyToken, authMiddleware } from './AuthMiddleware';
import type { AuthenticatedRequest } from '../types';
import type { Response, NextFunction } from 'express';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeReqResNext(authHeader?: string) {
  const req = {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as AuthenticatedRequest;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

// ─── generateToken ───────────────────────────────────────────────────────────

describe('generateToken', () => {
  it('returns a non-empty string', () => {
    const token = generateToken('user-1', 'alice');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('produces a valid JWT with correct payload fields', () => {
    const token = generateToken('user-42', 'bob');
    // Decode without verification to inspect payload
    const decoded = jwt.decode(token) as any;
    expect(decoded).not.toBeNull();
    expect(decoded.userId).toBe('user-42');
    expect(decoded.username).toBe('bob');
    expect(typeof decoded.iat).toBe('number');
    expect(typeof decoded.exp).toBe('number');
  });

  it('sets expiration to approximately 24 hours from now (Requirement 1.2)', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = generateToken('u', 'u');
    const after = Math.floor(Date.now() / 1000);
    const decoded = jwt.decode(token) as any;

    const expectedExpMin = before + 24 * 60 * 60;
    const expectedExpMax = after + 24 * 60 * 60;

    expect(decoded.exp).toBeGreaterThanOrEqual(expectedExpMin);
    expect(decoded.exp).toBeLessThanOrEqual(expectedExpMax);
  });

  it('generates different tokens for different users', () => {
    const t1 = generateToken('user-1', 'alice');
    const t2 = generateToken('user-2', 'bob');
    expect(t1).not.toBe(t2);
  });
});

// ─── verifyToken ─────────────────────────────────────────────────────────────

describe('verifyToken', () => {
  it('returns the payload for a valid token (Requirement 1.7)', () => {
    const token = generateToken('user-1', 'alice');
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe('user-1');
    expect(payload!.username).toBe('alice');
  });

  it('returns null for a malformed token (Requirement 1.5)', () => {
    expect(verifyToken('not.a.valid.token')).toBeNull();
  });

  it('returns null for an empty string (Requirement 1.5)', () => {
    expect(verifyToken('')).toBeNull();
  });

  it('returns null for a token signed with a different secret (Requirement 1.5)', () => {
    const fakeToken = jwt.sign({ userId: 'x', username: 'x' }, 'wrong-secret-that-is-at-least-32-chars-long', { expiresIn: 3600 });
    expect(verifyToken(fakeToken)).toBeNull();
  });

  it('returns null for an expired token (Requirement 1.6)', () => {
    const secret = process.env.JWT_SECRET || 'test-secret-key-that-is-at-least-32-chars';
    const expiredToken = jwt.sign(
      { userId: 'u', username: 'u' },
      secret,
      { expiresIn: -1 } // already expired
    );
    expect(verifyToken(expiredToken)).toBeNull();
  });
});

// ─── authMiddleware ───────────────────────────────────────────────────────────

describe('authMiddleware', () => {
  it('returns 401 when Authorization header is missing (Requirement 1.4)', () => {
    const { req, res, next } = makeReqResNext();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for malformed Authorization header (no Bearer prefix)', () => {
    const { req, res, next } = makeReqResNext('Token abc123');
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for Authorization header with only one part', () => {
    const { req, res, next } = makeReqResNext('Bearer');
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid token (Requirement 1.5)', () => {
    const { req, res, next } = makeReqResNext('Bearer invalid.token.here');
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired token (Requirement 1.6)', () => {
    const secret = process.env.JWT_SECRET || 'test-secret-key-that-is-at-least-32-chars';
    const expiredToken = jwt.sign({ userId: 'u', username: 'u' }, secret, { expiresIn: -1 });
    const { req, res, next } = makeReqResNext(`Bearer ${expiredToken}`);
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and attaches user payload for a valid token (Requirement 1.7)', () => {
    const token = generateToken('user-99', 'charlie');
    const { req, res, next } = makeReqResNext(`Bearer ${token}`);
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe('user-99');
    expect(req.user!.username).toBe('charlie');
  });

  it('is case-insensitive for the Bearer prefix', () => {
    const token = generateToken('user-1', 'alice');
    const { req, res, next } = makeReqResNext(`BEARER ${token}`);
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
