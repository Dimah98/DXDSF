/**
 * Tests for TimerManager
 *
 * Covers:
 * - registerTimer: stores timer, replaces existing timer with same key
 * - clearTimer: clears and removes a specific timer
 * - cleanupInactiveTimers: removes timers for projects with no active WebSocket
 * - clearAllTimers: clears all registered timers
 * - Periodic cleanup runs every 60 minutes
 * - stopCleanupTimer: stops the periodic cleanup interval
 *
 * Requirement 10: Timer Lifecycle Management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimerManager, SessionLookup } from './TimerManager';
import { ProjectSession, ExtendedWebSocket } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create a minimal mock ProjectSession.
 */
function createMockSession(activeWs: ExtendedWebSocket | null = null): ProjectSession {
  return {
    projectName: 'test-project',
    browser: null,
    context: null,
    page: null,
    cdpPort: 0,
    currentlyRunningProfileDir: null,
    activeWs,
    isBotRunning: false,
    lastActiveNodeId: null,
    lastActiveNodeTitle: null,
    botSettings: { photoDebug: false },
    globalVariables: {},
    nodeRuntimeState: new Map(),
    isStreaming: false,
    photoDebugEnabled: false,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    safetyTimeout: null,
  };
}

/**
 * Create a fake active WebSocket reference (just needs to be non-null).
 */
function createMockWs(): ExtendedWebSocket {
  return {
    projectName: 'test-project',
    isStreaming: false,
    isBotRunning: false,
    isSingleNodeRun: false,
    lastActivity: Date.now(),
  } as unknown as ExtendedWebSocket;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TimerManager', () => {
  let timerManager: TimerManager;
  let sessions: Map<string, ProjectSession>;
  let sessionLookup: SessionLookup;

  beforeEach(() => {
    vi.useFakeTimers();
    sessions = new Map();
    sessionLookup = (name) => sessions.get(name);
    timerManager = new TimerManager(sessionLookup);
  });

  afterEach(() => {
    timerManager.stopCleanupTimer();
    timerManager.clearAllTimers();
    vi.useRealTimers();
  });

  // ── registerTimer ───────────────────────────────────────────────────────

  describe('registerTimer', () => {
    it('registers a timer and increments count', () => {
      const timer = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      timerManager.registerTimer('proj1:autoSave', timer);
      expect(timerManager.getTimerCount()).toBe(1);
    });

    it('hasTimer returns true after registration', () => {
      const timer = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      timerManager.registerTimer('proj1:autoSave', timer);
      expect(timerManager.hasTimer('proj1:autoSave')).toBe(true);
    });

    it('hasTimer returns false for unregistered key', () => {
      expect(timerManager.hasTimer('nonexistent:key')).toBe(false);
    });

    it('replaces an existing timer with the same key', () => {
      const timer1 = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      const timer2 = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;

      timerManager.registerTimer('proj1:autoSave', timer1);
      timerManager.registerTimer('proj1:autoSave', timer2);

      // Count should still be 1 — old timer was replaced
      expect(timerManager.getTimerCount()).toBe(1);
      expect(timerManager.hasTimer('proj1:autoSave')).toBe(true);
    });

    it('can register multiple timers with different keys', () => {
      const t1 = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      const t2 = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      const t3 = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;

      timerManager.registerTimer('proj1:autoSave', t1);
      timerManager.registerTimer('proj2:autoSave', t2);
      timerManager.registerTimer('proj1:cleanup', t3);

      expect(timerManager.getTimerCount()).toBe(3);
    });
  });

  // ── clearTimer ──────────────────────────────────────────────────────────

  describe('clearTimer', () => {
    it('removes the timer from the registry', () => {
      const timer = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      timerManager.registerTimer('proj1:autoSave', timer);

      timerManager.clearTimer('proj1:autoSave');

      expect(timerManager.hasTimer('proj1:autoSave')).toBe(false);
      expect(timerManager.getTimerCount()).toBe(0);
    });

    it('is a no-op for an unknown key', () => {
      expect(() => timerManager.clearTimer('nonexistent:key')).not.toThrow();
    });

    it('does not affect other registered timers', () => {
      const t1 = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      const t2 = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;

      timerManager.registerTimer('proj1:autoSave', t1);
      timerManager.registerTimer('proj2:autoSave', t2);

      timerManager.clearTimer('proj1:autoSave');

      expect(timerManager.hasTimer('proj1:autoSave')).toBe(false);
      expect(timerManager.hasTimer('proj2:autoSave')).toBe(true);
      expect(timerManager.getTimerCount()).toBe(1);
    });

    it('prevents the cleared timer callback from firing', () => {
      const callback = vi.fn();
      const timer = setTimeout(callback, 5000) as unknown as ReturnType<typeof setTimeout>;
      timerManager.registerTimer('proj1:test', timer);

      timerManager.clearTimer('proj1:test');

      vi.advanceTimersByTime(10000);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ── cleanupInactiveTimers ───────────────────────────────────────────────

  describe('cleanupInactiveTimers', () => {
    it('clears timers for projects with no active WebSocket', () => {
      // Session exists but has no active WebSocket
      sessions.set('proj1', createMockSession(null));

      const timer = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      timerManager.registerTimer('proj1:autoSave', timer);

      timerManager.cleanupInactiveTimers();

      expect(timerManager.hasTimer('proj1:autoSave')).toBe(false);
    });

    it('clears timers for projects with no session at all', () => {
      // No session registered for proj1
      const timer = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      timerManager.registerTimer('proj1:autoSave', timer);

      timerManager.cleanupInactiveTimers();

      expect(timerManager.hasTimer('proj1:autoSave')).toBe(false);
    });

    it('keeps timers for projects with an active WebSocket', () => {
      const ws = createMockWs();
      sessions.set('proj1', createMockSession(ws));

      const timer = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      timerManager.registerTimer('proj1:autoSave', timer);

      timerManager.cleanupInactiveTimers();

      expect(timerManager.hasTimer('proj1:autoSave')).toBe(true);
    });

    it('only clears inactive project timers, not active ones', () => {
      const ws = createMockWs();
      sessions.set('proj1', createMockSession(ws));
      sessions.set('proj2', createMockSession(null)); // no active WS

      const t1 = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      const t2 = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;

      timerManager.registerTimer('proj1:autoSave', t1);
      timerManager.registerTimer('proj2:autoSave', t2);

      timerManager.cleanupInactiveTimers();

      expect(timerManager.hasTimer('proj1:autoSave')).toBe(true);
      expect(timerManager.hasTimer('proj2:autoSave')).toBe(false);
    });

    // Тест на перевірку ігнорування ключів без префікса проекту (без двокрапки)
    it('skips keys without a project prefix (no colon)', () => {
      // Створюємо тестовий таймер
      const timer = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      // Реєструємо його з ключем без двокрапки
      timerManager.registerTimer('globalCleanup', timer);

      // Викликаємо очищення неактивних таймерів
      timerManager.cleanupInactiveTimers();

      // Очікуємо, що таймер не буде видалено
      expect(timerManager.hasTimer('globalCleanup')).toBe(true);
    });

    // Тест на перевірку ігнорування ключів із системним префіксом
    it('skips keys with system prefix', () => {
      // Створюємо тестовий таймер
      const timer = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      // Реєструємо його з системним ключем
      timerManager.registerTimer('system:scheduler', timer);

      // Викликаємо очищення неактивних таймерів
      timerManager.cleanupInactiveTimers();

      // Очікуємо, що системний таймер залишиться активним
      expect(timerManager.hasTimer('system:scheduler')).toBe(true);
    });

    it('is a no-op when no sessionLookup is provided', () => {
      const managerWithoutLookup = new TimerManager();
      const timer = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      managerWithoutLookup.registerTimer('proj1:autoSave', timer);

      expect(() => managerWithoutLookup.cleanupInactiveTimers()).not.toThrow();
      expect(managerWithoutLookup.hasTimer('proj1:autoSave')).toBe(true);

      managerWithoutLookup.stopCleanupTimer();
      managerWithoutLookup.clearAllTimers();
    });

    it('runs automatically every 60 minutes via the cleanup timer', () => {
      sessions.set('proj1', createMockSession(null)); // no active WS

      const timer = setTimeout(() => {}, 10 * 60 * 60 * 1000) as unknown as ReturnType<typeof setTimeout>; // long-lived timer
      timerManager.registerTimer('proj1:autoSave', timer);

      // Advance time by 60 minutes to trigger the cleanup interval
      vi.advanceTimersByTime(60 * 60 * 1000);

      expect(timerManager.hasTimer('proj1:autoSave')).toBe(false);
    });
  });

  // ── clearAllTimers ──────────────────────────────────────────────────────

  describe('clearAllTimers', () => {
    it('clears all registered timers', () => {
      const t1 = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      const t2 = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      const t3 = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;

      timerManager.registerTimer('proj1:autoSave', t1);
      timerManager.registerTimer('proj2:autoSave', t2);
      timerManager.registerTimer('proj1:cleanup', t3);

      timerManager.clearAllTimers();

      expect(timerManager.getTimerCount()).toBe(0);
    });

    it('is a no-op when there are no timers', () => {
      expect(() => timerManager.clearAllTimers()).not.toThrow();
      expect(timerManager.getTimerCount()).toBe(0);
    });

    it('prevents all cleared timer callbacks from firing', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const t1 = setTimeout(cb1, 5000) as unknown as ReturnType<typeof setTimeout>;
      const t2 = setTimeout(cb2, 5000) as unknown as ReturnType<typeof setTimeout>;

      timerManager.registerTimer('proj1:t1', t1);
      timerManager.registerTimer('proj2:t2', t2);

      timerManager.clearAllTimers();

      vi.advanceTimersByTime(10000);

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });
  });

  // ── stopCleanupTimer ────────────────────────────────────────────────────

  describe('stopCleanupTimer', () => {
    it('stops the periodic cleanup timer', () => {
      sessions.set('proj1', createMockSession(null)); // no active WS

      const timer = setTimeout(() => {}, 10 * 60 * 60 * 1000) as unknown as ReturnType<typeof setTimeout>;
      timerManager.registerTimer('proj1:autoSave', timer);

      timerManager.stopCleanupTimer();

      // Advance time — cleanup should NOT run since timer was stopped
      vi.advanceTimersByTime(60 * 60 * 1000);

      expect(timerManager.hasTimer('proj1:autoSave')).toBe(true);
    });

    it('is safe to call multiple times', () => {
      expect(() => {
        timerManager.stopCleanupTimer();
        timerManager.stopCleanupTimer();
      }).not.toThrow();
    });
  });

  // ── getTimerCount ───────────────────────────────────────────────────────

  describe('getTimerCount', () => {
    it('returns 0 when no timers are registered', () => {
      expect(timerManager.getTimerCount()).toBe(0);
    });

    it('returns the correct count after registrations and clears', () => {
      const t1 = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      const t2 = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;

      timerManager.registerTimer('proj1:t1', t1);
      timerManager.registerTimer('proj2:t2', t2);
      expect(timerManager.getTimerCount()).toBe(2);

      timerManager.clearTimer('proj1:t1');
      expect(timerManager.getTimerCount()).toBe(1);

      timerManager.clearAllTimers();
      expect(timerManager.getTimerCount()).toBe(0);
    });
  });
});
