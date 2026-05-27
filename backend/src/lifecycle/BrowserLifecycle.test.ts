/**
 * Tests for BrowserLifecycle
 *
 * Covers:
 * - launchBrowser: delegates to connectToBrowser, updates lastActivity
 * - closeBrowser: clears safety timeout, calls closeSessionBrowser, handles no-browser case
 * - setupSafetyTimeout: sets timeout, replaces existing timeout, triggers auto-close
 * - cleanupZombieBrowsers: skips alive browsers, kills zombie processes, handles empty sessions
 * - withBrowser: try-finally guarantees cleanup on success and failure
 *
 * Requirements: 9, 27
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserLifecycle, withBrowser } from './BrowserLifecycle';
import { ProjectSession, BrowserSettings } from '../types';

// ─── Mock external dependencies ─────────────────────────────────────────────

// Mock browserManager so we don't need a real Playwright browser
vi.mock('../browserManager', () => ({
  connectToBrowser: vi.fn(),
  closeSessionBrowser: vi.fn(),
}));

// Mock child_process execSync for zombie cleanup tests
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { connectToBrowser, closeSessionBrowser } from '../browserManager';
import { execSync } from 'child_process';

const mockConnectToBrowser = vi.mocked(connectToBrowser);
const mockCloseSessionBrowser = vi.mocked(closeSessionBrowser);
const mockExecSync = vi.mocked(execSync);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockPage() {
  return { url: () => 'https://sunflower-land.com/play/#/' } as any;
}

function createMockBrowser(connected = true) {
  return {
    isConnected: vi.fn(() => connected),
    close: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockSession(overrides: Partial<ProjectSession> = {}): ProjectSession {
  return {
    projectName: 'test-project',
    browser: null,
    context: null,
    page: null,
    cdpPort: 9222,
    currentlyRunningProfileDir: null,
    activeWs: null,
    isBotRunning: false,
    lastActiveNodeId: null,
    lastActiveNodeTitle: null,
    botSettings: { photoDebug: false },
    globalVariables: {},
    nodeRuntimeState: new Map(),
    isStreaming: false,
    photoDebugEnabled: false,
    createdAt: Date.now(),
    lastActivity: 0,
    safetyTimeout: null,
    ...overrides,
  };
}

const defaultSettings: BrowserSettings = {
  width: 1280,
  height: 720,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BrowserLifecycle', () => {
  let lifecycle: BrowserLifecycle;

  beforeEach(() => {
    vi.useFakeTimers();
    lifecycle = new BrowserLifecycle();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── launchBrowser ──────────────────────────────────────────────────────────

  describe('launchBrowser', () => {
    it('calls connectToBrowser with correct arguments', async () => {
      const session = createMockSession();
      const mockPage = createMockPage();
      mockConnectToBrowser.mockResolvedValue(mockPage);

      const settings: BrowserSettings = {
        width: 1920,
        height: 1080,
        profile: 'myProfile',
        profileDir: 'profileDir123',
        proxy: 'http://proxy:8080',
      };

      await lifecycle.launchBrowser(session, settings);

      expect(mockConnectToBrowser).toHaveBeenCalledWith(
        session,
        1920,
        1080,
        'myProfile',
        'profileDir123',
        'http://proxy:8080'
      );
    });

    it('returns the page from connectToBrowser', async () => {
      const session = createMockSession();
      const mockPage = createMockPage();
      mockConnectToBrowser.mockResolvedValue(mockPage);

      const result = await lifecycle.launchBrowser(session, defaultSettings);

      expect(result).toBe(mockPage);
    });

    it('updates session.lastActivity after launch', async () => {
      const session = createMockSession({ lastActivity: 0 });
      mockConnectToBrowser.mockResolvedValue(createMockPage());

      const before = Date.now();
      await lifecycle.launchBrowser(session, defaultSettings);

      expect(session.lastActivity).toBeGreaterThanOrEqual(before);
    });

    it('propagates errors from connectToBrowser', async () => {
      const session = createMockSession();
      mockConnectToBrowser.mockRejectedValue(new Error('CDP connection failed'));

      await expect(lifecycle.launchBrowser(session, defaultSettings)).rejects.toThrow(
        'CDP connection failed'
      );
    });

    it('passes undefined width/height when not provided in settings', async () => {
      const session = createMockSession();
      mockConnectToBrowser.mockResolvedValue(createMockPage());

      await lifecycle.launchBrowser(session, {});

      expect(mockConnectToBrowser).toHaveBeenCalledWith(
        session,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
    });
  });

  // ── closeBrowser ──────────────────────────────────────────────────────────

  describe('closeBrowser', () => {
    it('does nothing when session has no browser', async () => {
      const session = createMockSession({ browser: null });

      await lifecycle.closeBrowser(session);

      expect(mockCloseSessionBrowser).not.toHaveBeenCalled();
    });

    it('calls closeSessionBrowser when browser exists', async () => {
      const session = createMockSession({ browser: createMockBrowser() });
      mockCloseSessionBrowser.mockResolvedValue(undefined);

      await lifecycle.closeBrowser(session);

      expect(mockCloseSessionBrowser).toHaveBeenCalledWith(session);
    });

    it('clears the safety timeout before closing', async () => {
      const session = createMockSession({ browser: createMockBrowser() });
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      mockCloseSessionBrowser.mockResolvedValue(undefined);

      // Set up a safety timeout first
      lifecycle.setupSafetyTimeout(session, 60000);
      const timeoutRef = session.safetyTimeout;
      expect(timeoutRef).not.toBeNull();

      await lifecycle.closeBrowser(session);

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutRef);
      expect(session.safetyTimeout).toBeNull();
    });

    it('sets session.safetyTimeout to null after clearing', async () => {
      const session = createMockSession({ browser: createMockBrowser() });
      mockCloseSessionBrowser.mockResolvedValue(undefined);

      lifecycle.setupSafetyTimeout(session, 60000);
      await lifecycle.closeBrowser(session);

      expect(session.safetyTimeout).toBeNull();
    });

    it('does not throw when closeSessionBrowser rejects', async () => {
      const session = createMockSession({ browser: createMockBrowser() });
      mockCloseSessionBrowser.mockRejectedValue(new Error('close failed'));

      await expect(lifecycle.closeBrowser(session)).resolves.toBeUndefined();
    });

    it('handles session with no safety timeout gracefully', async () => {
      const session = createMockSession({ browser: createMockBrowser(), safetyTimeout: null });
      mockCloseSessionBrowser.mockResolvedValue(undefined);

      await expect(lifecycle.closeBrowser(session)).resolves.toBeUndefined();
      expect(mockCloseSessionBrowser).toHaveBeenCalledWith(session);
    });
  });

  // ── setupSafetyTimeout ────────────────────────────────────────────────────

  describe('setupSafetyTimeout', () => {
    it('sets session.safetyTimeout to a non-null value', () => {
      const session = createMockSession();

      lifecycle.setupSafetyTimeout(session, 60000);

      expect(session.safetyTimeout).not.toBeNull();
    });

    it('replaces an existing safety timeout', () => {
      const session = createMockSession();
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      lifecycle.setupSafetyTimeout(session, 60000);
      const firstTimeout = session.safetyTimeout;

      lifecycle.setupSafetyTimeout(session, 60000);

      expect(clearTimeoutSpy).toHaveBeenCalledWith(firstTimeout);
    });

    it('triggers closeSessionBrowser after the timeout fires', async () => {
      const session = createMockSession({ browser: createMockBrowser() });
      mockCloseSessionBrowser.mockResolvedValue(undefined);

      lifecycle.setupSafetyTimeout(session, 5000);

      // Advance time past the timeout
      await vi.advanceTimersByTimeAsync(5001);

      expect(mockCloseSessionBrowser).toHaveBeenCalledWith(session);
    });

    it('sets isBotRunning to false after timeout fires', async () => {
      const session = createMockSession({ browser: createMockBrowser(), isBotRunning: true });
      mockCloseSessionBrowser.mockResolvedValue(undefined);

      lifecycle.setupSafetyTimeout(session, 5000);
      await vi.advanceTimersByTimeAsync(5001);

      expect(session.isBotRunning).toBe(false);
    });

    it('sets session.safetyTimeout to null after timeout fires', async () => {
      const session = createMockSession({ browser: createMockBrowser() });
      mockCloseSessionBrowser.mockResolvedValue(undefined);

      lifecycle.setupSafetyTimeout(session, 5000);
      await vi.advanceTimersByTimeAsync(5001);

      expect(session.safetyTimeout).toBeNull();
    });

    it('does not throw when closeSessionBrowser rejects during timeout', async () => {
      const session = createMockSession({ browser: createMockBrowser() });
      mockCloseSessionBrowser.mockRejectedValue(new Error('close error'));

      lifecycle.setupSafetyTimeout(session, 5000);

      // Should not throw — just advance time and verify no unhandled rejection
      await vi.advanceTimersByTimeAsync(5001);
      // If we reach here without an unhandled rejection, the test passes
      expect(mockCloseSessionBrowser).toHaveBeenCalled();
    });

    it('does not fire before the timeout duration', () => {
      const session = createMockSession({ browser: createMockBrowser() });

      lifecycle.setupSafetyTimeout(session, 10000);
      vi.advanceTimersByTime(9999);

      expect(mockCloseSessionBrowser).not.toHaveBeenCalled();
    });

    it('uses 10 minutes as default timeout', () => {
      const session = createMockSession({ browser: createMockBrowser() });
      mockCloseSessionBrowser.mockResolvedValue(undefined);

      lifecycle.setupSafetyTimeout(session);

      // Should not fire before 10 minutes
      vi.advanceTimersByTime(10 * 60 * 1000 - 1);
      expect(mockCloseSessionBrowser).not.toHaveBeenCalled();
    });
  });

  // ── cleanupZombieBrowsers ─────────────────────────────────────────────────

  describe('cleanupZombieBrowsers', () => {
    it('resolves immediately when sessions map is undefined', async () => {
      await expect(lifecycle.cleanupZombieBrowsers(undefined)).resolves.toBeUndefined();
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('resolves immediately when sessions map is empty', async () => {
      await expect(lifecycle.cleanupZombieBrowsers(new Map())).resolves.toBeUndefined();
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('skips sessions where browser is alive and connected', async () => {
      const session = createMockSession({ browser: createMockBrowser(true), cdpPort: 9222 });
      const sessions = new Map([['proj1', session]]);

      await lifecycle.cleanupZombieBrowsers(sessions);

      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('skips sessions with no CDP port', async () => {
      const session = createMockSession({ browser: null, cdpPort: 0 });
      const sessions = new Map([['proj1', session]]);

      await lifecycle.cleanupZombieBrowsers(sessions);

      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('runs netstat to find zombie process on CDP port', async () => {
      const session = createMockSession({ browser: null, cdpPort: 9222 });
      const sessions = new Map([['proj1', session]]);

      // netstat finds nothing
      mockExecSync.mockImplementation(() => { throw new Error('no match'); });

      await lifecycle.cleanupZombieBrowsers(sessions);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('9222'),
        expect.any(Object)
      );
    });

    it('kills zombie process when found on CDP port', async () => {
      const session = createMockSession({ browser: null, cdpPort: 9222 });
      const sessions = new Map([['proj1', session]]);

      // First call: netstat finds PID 1234 listening
      // Second call: taskkill succeeds
      // Third call: netstat finds nothing (process gone)
      mockExecSync
        .mockReturnValueOnce('  TCP    0.0.0.0:9222    0.0.0.0:0    LISTENING    1234\n' as any)
        .mockReturnValueOnce('' as any) // taskkill success
        .mockImplementationOnce(() => { throw new Error('no match'); }); // verify gone

      await lifecycle.cleanupZombieBrowsers(sessions);

      // Should have called taskkill with the PID
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('taskkill'),
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('1234'),
        expect.any(Object)
      );
    });

    it('does not call taskkill when no process is found on port', async () => {
      const session = createMockSession({ browser: null, cdpPort: 9222 });
      const sessions = new Map([['proj1', session]]);

      // netstat returns output without LISTENING
      mockExecSync.mockReturnValueOnce('  TCP    0.0.0.0:9222    0.0.0.0:0    TIME_WAIT    1234\n' as any);

      await lifecycle.cleanupZombieBrowsers(sessions);

      // Only netstat was called, not taskkill
      expect(mockExecSync).toHaveBeenCalledTimes(1);
      expect(mockExecSync).not.toHaveBeenCalledWith(
        expect.stringContaining('taskkill'),
        expect.any(Object)
      );
    });

    it('continues processing other sessions when taskkill fails', async () => {
      const session1 = createMockSession({ projectName: 'proj1', browser: null, cdpPort: 9222 });
      const session2 = createMockSession({ projectName: 'proj2', browser: null, cdpPort: 9223 });
      const sessions = new Map([['proj1', session1], ['proj2', session2]]);

      mockExecSync
        // proj1: netstat finds PID
        .mockReturnValueOnce('  TCP    0.0.0.0:9222    0.0.0.0:0    LISTENING    1234\n' as any)
        // proj1: taskkill fails
        .mockImplementationOnce(() => { throw new Error('access denied'); })
        // proj2: netstat finds nothing
        .mockImplementationOnce(() => { throw new Error('no match'); });

      // Should not throw
      await expect(lifecycle.cleanupZombieBrowsers(sessions)).resolves.toBeUndefined();
    });

    it('skips sessions where browser is disconnected but cdpPort is 0', async () => {
      const disconnectedBrowser = createMockBrowser(false);
      const session = createMockSession({ browser: disconnectedBrowser, cdpPort: 0 });
      const sessions = new Map([['proj1', session]]);

      await lifecycle.cleanupZombieBrowsers(sessions);

      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  // ── withBrowser ───────────────────────────────────────────────────────────

  describe('withBrowser', () => {
    it('calls launchBrowser, runFn, and closeBrowser in order', async () => {
      const session = createMockSession();
      const mockPage = createMockPage();
      mockConnectToBrowser.mockResolvedValue(mockPage);
      mockCloseSessionBrowser.mockResolvedValue(undefined);

      const callOrder: string[] = [];
      const runFn = vi.fn(async () => { callOrder.push('runFn'); });

      // Spy on lifecycle methods
      const launchSpy = vi.spyOn(lifecycle, 'launchBrowser').mockImplementation(async () => {
        callOrder.push('launchBrowser');
        return mockPage;
      });
      const closeSpy = vi.spyOn(lifecycle, 'closeBrowser').mockImplementation(async () => {
        callOrder.push('closeBrowser');
      });

      await withBrowser(lifecycle, session, defaultSettings, runFn);

      expect(callOrder).toEqual(['launchBrowser', 'runFn', 'closeBrowser']);
      launchSpy.mockRestore();
      closeSpy.mockRestore();
    });

    it('calls closeBrowser even when runFn throws', async () => {
      const session = createMockSession();
      const mockPage = createMockPage();
      mockConnectToBrowser.mockResolvedValue(mockPage);
      mockCloseSessionBrowser.mockResolvedValue(undefined);

      const closeSpy = vi.spyOn(lifecycle, 'closeBrowser').mockResolvedValue(undefined);
      vi.spyOn(lifecycle, 'launchBrowser').mockResolvedValue(mockPage);

      const runFn = vi.fn().mockRejectedValue(new Error('bot error'));

      await expect(withBrowser(lifecycle, session, defaultSettings, runFn)).rejects.toThrow(
        'bot error'
      );

      expect(closeSpy).toHaveBeenCalledWith(session);
      closeSpy.mockRestore();
    });

    it('sets session.isBotRunning to false in finally block', async () => {
      const session = createMockSession({ isBotRunning: true });
      const mockPage = createMockPage();

      vi.spyOn(lifecycle, 'launchBrowser').mockResolvedValue(mockPage);
      vi.spyOn(lifecycle, 'closeBrowser').mockResolvedValue(undefined);

      const runFn = vi.fn().mockResolvedValue(undefined);

      await withBrowser(lifecycle, session, defaultSettings, runFn);

      expect(session.isBotRunning).toBe(false);
    });

    it('sets session.isBotRunning to false even when runFn throws', async () => {
      const session = createMockSession({ isBotRunning: true });
      const mockPage = createMockPage();

      vi.spyOn(lifecycle, 'launchBrowser').mockResolvedValue(mockPage);
      vi.spyOn(lifecycle, 'closeBrowser').mockResolvedValue(undefined);

      const runFn = vi.fn().mockRejectedValue(new Error('crash'));

      await expect(withBrowser(lifecycle, session, defaultSettings, runFn)).rejects.toThrow();

      expect(session.isBotRunning).toBe(false);
    });

    it('calls setupSafetyTimeout after launching browser', async () => {
      const session = createMockSession();
      const mockPage = createMockPage();

      vi.spyOn(lifecycle, 'launchBrowser').mockResolvedValue(mockPage);
      vi.spyOn(lifecycle, 'closeBrowser').mockResolvedValue(undefined);
      const setupSpy = vi.spyOn(lifecycle, 'setupSafetyTimeout');

      const runFn = vi.fn().mockResolvedValue(undefined);

      await withBrowser(lifecycle, session, defaultSettings, runFn);

      expect(setupSpy).toHaveBeenCalledWith(session, 10 * 60 * 1000);
      setupSpy.mockRestore();
    });

    it('passes the launched page to runFn', async () => {
      const session = createMockSession();
      const mockPage = createMockPage();

      vi.spyOn(lifecycle, 'launchBrowser').mockResolvedValue(mockPage);
      vi.spyOn(lifecycle, 'closeBrowser').mockResolvedValue(undefined);

      const runFn = vi.fn().mockResolvedValue(undefined);

      await withBrowser(lifecycle, session, defaultSettings, runFn);

      expect(runFn).toHaveBeenCalledWith(mockPage);
    });

    it('re-throws the error from runFn', async () => {
      const session = createMockSession();
      const mockPage = createMockPage();

      vi.spyOn(lifecycle, 'launchBrowser').mockResolvedValue(mockPage);
      vi.spyOn(lifecycle, 'closeBrowser').mockResolvedValue(undefined);

      const runFn = vi.fn().mockRejectedValue(new Error('specific error'));

      await expect(withBrowser(lifecycle, session, defaultSettings, runFn)).rejects.toThrow(
        'specific error'
      );
    });

    it('calls closeBrowser even when launchBrowser throws', async () => {
      const session = createMockSession();

      vi.spyOn(lifecycle, 'launchBrowser').mockRejectedValue(new Error('launch failed'));
      const closeSpy = vi.spyOn(lifecycle, 'closeBrowser').mockResolvedValue(undefined);

      const runFn = vi.fn();

      await expect(withBrowser(lifecycle, session, defaultSettings, runFn)).rejects.toThrow(
        'launch failed'
      );

      expect(closeSpy).toHaveBeenCalledWith(session);
      expect(runFn).not.toHaveBeenCalled();
      closeSpy.mockRestore();
    });
  });
});
