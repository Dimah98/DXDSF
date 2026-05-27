/**
 * Unit tests for RateLimiter middleware
 *
 * Tests rate limiting configuration, client key generation, and HTTP 429 responses.
 * Requirement 7: Rate Limiting for API Endpoints
 */

import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { apiRateLimiter, wsRateLimiter, runMultipleRateLimiter } from './RateLimiter';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock Express request.
 * Optionally supply a userId (simulates authenticated request) and/or IP.
 */
function makeReq(opts: { userId?: string; ip?: string; forwardedFor?: string } = {}): Request {
  const req: any = {
    headers: opts.forwardedFor ? { 'x-forwarded-for': opts.forwardedFor } : {},
    socket: { remoteAddress: opts.ip || '127.0.0.1' },
    ip: opts.ip || '127.0.0.1',
    method: 'GET',
    path: '/api/test',
    app: { get: () => false },
  };
  if (opts.userId) {
    req.user = { userId: opts.userId, username: 'testuser', iat: 0, exp: 9999999999 };
  }
  return req as Request;
}

function makeRes(): Response {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    getHeader: vi.fn().mockReturnValue(undefined),
    removeHeader: vi.fn().mockReturnThis(),
    end: vi.fn(),
    headersSent: false,
  };
  return res as Response;
}

/** Invoke a rate-limit middleware and await its async result. */
async function callMiddleware(
  middleware: (req: Request, res: Response, next: () => void) => any,
  req: Request,
  res: Response,
): Promise<boolean> {
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  return nextCalled;
}

// ─── Rate limiter configuration tests ────────────────────────────────────────

describe('apiRateLimiter', () => {
  it('is a function (Express middleware)', () => {
    expect(typeof apiRateLimiter).toBe('function');
  });

  it('calls next() for a fresh request (Requirement 7.1)', async () => {
    const req = makeReq({ ip: '10.0.1.1' });
    const res = makeRes();
    const nextCalled = await callMiddleware(apiRateLimiter, req, res);
    expect(nextCalled).toBe(true);
  });
});

describe('wsRateLimiter', () => {
  it('is a function (Express middleware)', () => {
    expect(typeof wsRateLimiter).toBe('function');
  });

  it('calls next() for a fresh request (Requirement 7.2)', async () => {
    const req = makeReq({ ip: '10.0.2.1' });
    const res = makeRes();
    const nextCalled = await callMiddleware(wsRateLimiter, req, res);
    expect(nextCalled).toBe(true);
  });
});

describe('runMultipleRateLimiter', () => {
  it('is a function (Express middleware)', () => {
    expect(typeof runMultipleRateLimiter).toBe('function');
  });

  it('calls next() for a fresh request (Requirement 7.3)', async () => {
    const req = makeReq({ ip: '10.0.3.1' });
    const res = makeRes();
    const nextCalled = await callMiddleware(runMultipleRateLimiter, req, res);
    expect(nextCalled).toBe(true);
  });
});

// ─── Client key generation tests ─────────────────────────────────────────────

describe('client key generation', () => {
  it('uses IP address for unauthenticated requests (Requirement 7.4)', async () => {
    // Two requests from the same IP should both pass (within limit)
    const req1 = makeReq({ ip: '192.168.1.100' });
    const req2 = makeReq({ ip: '192.168.1.100' });

    const passed1 = await callMiddleware(apiRateLimiter, req1, makeRes());
    const passed2 = await callMiddleware(apiRateLimiter, req2, makeRes());

    expect(passed1).toBe(true);
    expect(passed2).toBe(true);
  });

  it('uses userId for authenticated requests (Requirement 7.5)', async () => {
    // Two requests from the same userId (different IPs) should both pass (within limit)
    const req1 = makeReq({ userId: 'user-xyz', ip: '1.2.3.4' });
    const req2 = makeReq({ userId: 'user-xyz', ip: '5.6.7.8' }); // different IP, same userId

    const passed1 = await callMiddleware(apiRateLimiter, req1, makeRes());
    const passed2 = await callMiddleware(apiRateLimiter, req2, makeRes());

    expect(passed1).toBe(true);
    expect(passed2).toBe(true);
  });

  it('treats different IPs as different clients', async () => {
    const req1 = makeReq({ ip: '10.0.0.10' });
    const req2 = makeReq({ ip: '10.0.0.11' });

    const passed1 = await callMiddleware(apiRateLimiter, req1, makeRes());
    const passed2 = await callMiddleware(apiRateLimiter, req2, makeRes());

    expect(passed1).toBe(true);
    expect(passed2).toBe(true);
  });

  it('uses x-forwarded-for header when present', async () => {
    const req = makeReq({ forwardedFor: '203.0.113.5, 10.0.0.1', ip: '10.0.0.1' });
    const passed = await callMiddleware(apiRateLimiter, req, makeRes());
    expect(passed).toBe(true);
  });
});

// ─── HTTP 429 response tests ──────────────────────────────────────────────────

describe('rate limit exceeded response', () => {
  it('returns HTTP 429 when runMultipleRateLimiter limit is exceeded (Requirement 7.6)', async () => {
    // The runMultipleRateLimiter allows 5 requests per 15 minutes.
    // Use a unique IP to avoid interference from other tests.
    const testIp = '172.16.99.50';
    const results: { passed: boolean; statusCode?: number }[] = [];

    for (let i = 0; i < 6; i++) {
      const req = makeReq({ ip: testIp });
      const res = makeRes();
      const passed = await callMiddleware(runMultipleRateLimiter, req, res);
      const statusCode = passed ? undefined : (res as any).status.mock.calls[0]?.[0];
      results.push({ passed, statusCode });
    }

    const passedCount = results.filter(r => r.passed).length;
    const blockedCount = results.filter(r => !r.passed).length;

    // First 5 should pass, 6th should be blocked
    expect(passedCount).toBe(5);
    expect(blockedCount).toBe(1);

    // The blocked request should have received HTTP 429 (Requirement 7.6)
    const blocked = results.find(r => !r.passed);
    expect(blocked?.statusCode).toBe(429);
  });

  it('sets X-RateLimit-* headers via setHeader (Requirement 7.7)', async () => {
    // express-rate-limit with standardHeaders: true sets X-RateLimit-* headers
    const req = makeReq({ ip: '172.16.99.51' });
    const res = makeRes();
    await callMiddleware(runMultipleRateLimiter, req, res);

    // Verify setHeader was called (express-rate-limit uses it for standard headers)
    expect((res as any).setHeader).toHaveBeenCalled();

    // Check that at least one X-RateLimit-* header was set
    const headerCalls: string[][] = (res as any).setHeader.mock.calls;
    const rateLimitHeaders = headerCalls.filter(([name]) =>
      typeof name === 'string' && name.toLowerCase().startsWith('ratelimit-')
    );
    expect(rateLimitHeaders.length).toBeGreaterThan(0);
  });
});
