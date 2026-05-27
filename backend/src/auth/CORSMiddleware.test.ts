/**
 * Unit tests for CORSMiddleware
 *
 * Tests that CORS headers are set correctly for allowed origins and that
 * requests from disallowed origins are rejected with HTTP 403.
 *
 * Requirement 25: CORS Configuration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Mock ConfigManager before importing the middleware ──────────────────────

// vi.mock is hoisted to the top of the file, so we use vi.hoisted() to ensure
// mockGet is available inside the factory function.
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('../config/ConfigManager', () => ({
  config: {
    get: mockGet,
  },
}));

// Import AFTER the mock is in place.
import { corsMiddleware, isOriginAllowed, CORSMiddleware } from './CORSMiddleware';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReqResNext(opts: {
  origin?: string;
  method?: string;
} = {}) {
  const req = {
    headers: opts.origin ? { origin: opts.origin } : {},
    method: opts.method ?? 'GET',
  } as unknown as Request;

  const setHeaders: Record<string, string> = {};
  let statusCode = 200;
  let endCalled = false;
  let jsonBody: unknown = undefined;

  const res = {
    setHeader: vi.fn((name: string, value: string) => {
      setHeaders[name] = value;
    }),
    status: vi.fn((code: number) => {
      statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      jsonBody = body;
      return res;
    }),
    end: vi.fn(() => {
      endCalled = true;
      return res;
    }),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return {
    req,
    res,
    next,
    setHeaders,
    getStatus: () => statusCode,
    getJsonBody: () => jsonBody,
    isEnded: () => endCalled,
  };
}

// ─── isOriginAllowed ─────────────────────────────────────────────────────────

describe('isOriginAllowed', () => {
  beforeEach(() => {
    mockGet.mockReturnValue(['http://localhost:5173', 'http://localhost:3000']);
  });

  it('returns true for an origin in the allowed list (Requirement 25.2)', () => {
    expect(isOriginAllowed('http://localhost:5173')).toBe(true);
  });

  it('returns true for a second allowed origin (Requirement 25.5)', () => {
    expect(isOriginAllowed('http://localhost:3000')).toBe(true);
  });

  it('returns false for an origin not in the allowed list (Requirement 25.4)', () => {
    expect(isOriginAllowed('http://evil.example.com')).toBe(false);
  });

  it('returns false for an empty string origin', () => {
    expect(isOriginAllowed('')).toBe(false);
  });

  it('is case-sensitive — different case is rejected', () => {
    expect(isOriginAllowed('HTTP://LOCALHOST:5173')).toBe(false);
  });

  it('reads allowed origins from config (Requirement 25.1)', () => {
    mockGet.mockReturnValue(['https://app.example.com']);
    expect(isOriginAllowed('https://app.example.com')).toBe(true);
    expect(isOriginAllowed('http://localhost:5173')).toBe(false);
  });
});

// ─── corsMiddleware — no Origin header ───────────────────────────────────────

describe('corsMiddleware — no Origin header', () => {
  beforeEach(() => {
    mockGet.mockReturnValue(['http://localhost:5173']);
  });

  it('calls next() when there is no Origin header', () => {
    const { req, res, next } = makeReqResNext();
    corsMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('does not set any CORS headers when there is no Origin header', () => {
    const { req, res, next, setHeaders } = makeReqResNext();
    corsMiddleware(req, res, next);
    expect(setHeaders['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('does not call res.status() when there is no Origin header', () => {
    const { req, res, next } = makeReqResNext();
    corsMiddleware(req, res, next);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ─── corsMiddleware — allowed origin ─────────────────────────────────────────

describe('corsMiddleware — allowed origin', () => {
  beforeEach(() => {
    mockGet.mockReturnValue(['http://localhost:5173', 'http://localhost:3000']);
  });

  it('sets Access-Control-Allow-Origin to the request origin (Requirement 25.3)', () => {
    const { req, res, next, setHeaders } = makeReqResNext({ origin: 'http://localhost:5173' });
    corsMiddleware(req, res, next);
    expect(setHeaders['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
  });

  it('sets Access-Control-Allow-Credentials to "true" (Requirement 25.3)', () => {
    const { req, res, next, setHeaders } = makeReqResNext({ origin: 'http://localhost:5173' });
    corsMiddleware(req, res, next);
    expect(setHeaders['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('sets Access-Control-Allow-Methods header (Requirement 25.3)', () => {
    const { req, res, next, setHeaders } = makeReqResNext({ origin: 'http://localhost:5173' });
    corsMiddleware(req, res, next);
    expect(setHeaders['Access-Control-Allow-Methods']).toBeDefined();
    expect(setHeaders['Access-Control-Allow-Methods']).toContain('GET');
    expect(setHeaders['Access-Control-Allow-Methods']).toContain('POST');
  });

  it('sets Access-Control-Allow-Headers header (Requirement 25.3)', () => {
    const { req, res, next, setHeaders } = makeReqResNext({ origin: 'http://localhost:5173' });
    corsMiddleware(req, res, next);
    expect(setHeaders['Access-Control-Allow-Headers']).toBeDefined();
    expect(setHeaders['Access-Control-Allow-Headers']).toContain('Authorization');
  });

  it('calls next() for an allowed origin on a regular request (Requirement 25.3)', () => {
    const { req, res, next } = makeReqResNext({ origin: 'http://localhost:5173' });
    corsMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('reflects the exact origin in the response header (Requirement 25.5)', () => {
    const { req, res, next, setHeaders } = makeReqResNext({ origin: 'http://localhost:3000' });
    corsMiddleware(req, res, next);
    expect(setHeaders['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });
});

// ─── corsMiddleware — disallowed origin ──────────────────────────────────────

describe('corsMiddleware — disallowed origin', () => {
  beforeEach(() => {
    mockGet.mockReturnValue(['http://localhost:5173']);
  });

  it('returns HTTP 403 for a disallowed origin (Requirement 25.4)', () => {
    const { req, res, next, getStatus } = makeReqResNext({ origin: 'http://evil.example.com' });
    corsMiddleware(req, res, next);
    expect(getStatus()).toBe(403);
  });

  it('returns an error JSON body for a disallowed origin (Requirement 25.4)', () => {
    const { req, res, next, getJsonBody } = makeReqResNext({ origin: 'http://evil.example.com' });
    corsMiddleware(req, res, next);
    expect(getJsonBody()).toMatchObject({ success: false });
  });

  it('does NOT call next() for a disallowed origin (Requirement 25.4)', () => {
    const { req, res, next } = makeReqResNext({ origin: 'http://evil.example.com' });
    corsMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('does NOT set Access-Control-Allow-Origin for a disallowed origin', () => {
    const { req, res, next, setHeaders } = makeReqResNext({ origin: 'http://evil.example.com' });
    corsMiddleware(req, res, next);
    expect(setHeaders['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

// ─── corsMiddleware — OPTIONS preflight ──────────────────────────────────────

describe('corsMiddleware — OPTIONS preflight', () => {
  beforeEach(() => {
    mockGet.mockReturnValue(['http://localhost:5173']);
  });

  it('responds with 204 for a preflight OPTIONS request from an allowed origin', () => {
    const { req, res, next, getStatus, isEnded } = makeReqResNext({
      origin: 'http://localhost:5173',
      method: 'OPTIONS',
    });
    corsMiddleware(req, res, next);
    expect(getStatus()).toBe(204);
    expect(isEnded()).toBe(true);
  });

  it('does NOT call next() for a preflight OPTIONS request', () => {
    const { req, res, next } = makeReqResNext({
      origin: 'http://localhost:5173',
      method: 'OPTIONS',
    });
    corsMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets CORS headers on a preflight OPTIONS request', () => {
    const { req, res, next, setHeaders } = makeReqResNext({
      origin: 'http://localhost:5173',
      method: 'OPTIONS',
    });
    corsMiddleware(req, res, next);
    expect(setHeaders['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(setHeaders['Access-Control-Allow-Methods']).toBeDefined();
  });

  it('rejects a preflight OPTIONS request from a disallowed origin with 403', () => {
    const { req, res, next, getStatus } = makeReqResNext({
      origin: 'http://evil.example.com',
      method: 'OPTIONS',
    });
    corsMiddleware(req, res, next);
    expect(getStatus()).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── CORSMiddleware object ────────────────────────────────────────────────────

describe('CORSMiddleware', () => {
  it('exposes a middleware function', () => {
    expect(typeof CORSMiddleware.middleware).toBe('function');
  });

  it('middleware property is the same as the named export', () => {
    expect(CORSMiddleware.middleware).toBe(corsMiddleware);
  });

  it('exposes an isOriginAllowed function', () => {
    expect(typeof CORSMiddleware.isOriginAllowed).toBe('function');
  });

  it('isOriginAllowed property is the same as the named export', () => {
    expect(CORSMiddleware.isOriginAllowed).toBe(isOriginAllowed);
  });
});
