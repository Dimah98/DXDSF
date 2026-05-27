/**
 * ShutdownManager Tests
 *
 * Tests for the graceful shutdown orchestration logic.
 *
 * Requirement 20: Graceful Shutdown
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShutdownManager } from './ShutdownManager';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Create a ShutdownManager without triggering real process.exit */
function createManager(): ShutdownManager {
  return new ShutdownManager();
}

/** Spy on process.exit so tests don't actually terminate the process */
function mockProcessExit() {
  return vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null | undefined) => {
    // no-op — prevent actual exit during tests
    return undefined as never;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ShutdownManager', () => {
  let exitSpy: ReturnType<typeof mockProcessExit>;

  beforeEach(() => {
    exitSpy = mockProcessExit();
    vi.useFakeTimers();
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.useRealTimers();
    // Remove any signal listeners added by the manager under test
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
  });

  // ── registerCleanupTask ────────────────────────────────────────────────────

  describe('registerCleanupTask', () => {
    it('registers a cleanup task and increments task count', () => {
      const manager = createManager();
      expect(manager.getTaskCount()).toBe(0);

      manager.registerCleanupTask('test-task', async () => {});
      expect(manager.getTaskCount()).toBe(1);
    });

    it('preserves registration order', () => {
      const manager = createManager();
      manager.registerCleanupTask('first', async () => {});
      manager.registerCleanupTask('second', async () => {});
      manager.registerCleanupTask('third', async () => {});

      expect(manager.getTaskNames()).toEqual(['first', 'second', 'third']);
    });

    it('replaces an existing task with the same name', () => {
      const manager = createManager();
      const original = vi.fn().mockResolvedValue(undefined);
      const replacement = vi.fn().mockResolvedValue(undefined);

      manager.registerCleanupTask('my-task', original);
      manager.registerCleanupTask('my-task', replacement);

      expect(manager.getTaskCount()).toBe(1);
      expect(manager.getTaskNames()).toEqual(['my-task']);
    });
  });

  // ── shutdown — sequential execution ───────────────────────────────────────

  describe('shutdown — sequential execution', () => {
    it('executes all registered tasks in order', async () => {
      const manager = createManager();
      const order: string[] = [];

      manager.registerCleanupTask('step-1', async () => { order.push('step-1'); });
      manager.registerCleanupTask('step-2', async () => { order.push('step-2'); });
      manager.registerCleanupTask('step-3', async () => { order.push('step-3'); });

      await manager.shutdown('SIGTERM');

      expect(order).toEqual(['step-1', 'step-2', 'step-3']);
    });

    it('calls process.exit(0) after all tasks complete', async () => {
      const manager = createManager();
      manager.registerCleanupTask('noop', async () => {});

      await manager.shutdown('SIGTERM');

      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('calls process.exit(0) even when no tasks are registered', async () => {
      const manager = createManager();
      await manager.shutdown('SIGTERM');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('continues executing remaining tasks when one task throws', async () => {
      const manager = createManager();
      const order: string[] = [];

      manager.registerCleanupTask('step-1', async () => { order.push('step-1'); });
      manager.registerCleanupTask('step-2', async () => { throw new Error('task failed'); });
      manager.registerCleanupTask('step-3', async () => { order.push('step-3'); });

      await manager.shutdown('SIGTERM');

      // step-2 threw but step-3 should still run
      expect(order).toContain('step-1');
      expect(order).toContain('step-3');
      // And we still exit cleanly
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  // ── shutdown — idempotency ─────────────────────────────────────────────────

  describe('shutdown — idempotency', () => {
    it('ignores a second shutdown call while the first is in progress', async () => {
      const manager = createManager();
      let callCount = 0;
      manager.registerCleanupTask('counter', async () => { callCount++; });

      // Fire two concurrent shutdowns
      const p1 = manager.shutdown('SIGTERM');
      const p2 = manager.shutdown('SIGINT');
      await Promise.all([p1, p2]);

      // Tasks should only have run once
      expect(callCount).toBe(1);
    });

    it('reports isShutdownInProgress() as true once shutdown starts', async () => {
      const manager = createManager();
      let seenDuringShutdown = false;

      manager.registerCleanupTask('check', async () => {
        seenDuringShutdown = manager.isShutdownInProgress();
      });

      await manager.shutdown('SIGTERM');
      expect(seenDuringShutdown).toBe(true);
    });
  });

  // ── shutdown — forced exit on timeout ─────────────────────────────────────

  describe('shutdown — forced exit on timeout', () => {
    it('calls process.exit(1) when shutdown exceeds 30 seconds', async () => {
      const manager = createManager();

      // Register a task that never resolves
      manager.registerCleanupTask('hanging-task', () => new Promise(() => {}));

      // Start shutdown but don't await — let the timer fire
      manager.shutdown('SIGTERM');

      // Advance fake timers past the 30-second timeout
      await vi.advanceTimersByTimeAsync(31_000);

      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── signal handler registration ───────────────────────────────────────────

  describe('signal handler registration', () => {
    it('registers SIGTERM and SIGINT handlers on construction', () => {
      // Count listeners before
      const sigtermBefore = process.listenerCount('SIGTERM');
      const sigintBefore = process.listenerCount('SIGINT');

      createManager();

      expect(process.listenerCount('SIGTERM')).toBe(sigtermBefore + 1);
      expect(process.listenerCount('SIGINT')).toBe(sigintBefore + 1);
    });

    it('triggers shutdown when SIGTERM is emitted', async () => {
      const manager = createManager();
      const task = vi.fn().mockResolvedValue(undefined);
      manager.registerCleanupTask('sigterm-task', task);

      // Emit the signal synchronously
      process.emit('SIGTERM');

      // Allow the async shutdown handler to run
      await vi.runAllTimersAsync();
      // Flush microtasks
      await Promise.resolve();
      await Promise.resolve();

      expect(task).toHaveBeenCalled();
    });

    it('triggers shutdown when SIGINT is emitted', async () => {
      const manager = createManager();
      const task = vi.fn().mockResolvedValue(undefined);
      manager.registerCleanupTask('sigint-task', task);

      process.emit('SIGINT');

      await vi.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();

      expect(task).toHaveBeenCalled();
    });
  });

  // ── getTaskNames ──────────────────────────────────────────────────────────

  describe('getTaskNames', () => {
    it('returns an empty array when no tasks are registered', () => {
      const manager = createManager();
      expect(manager.getTaskNames()).toEqual([]);
    });

    it('returns task names in registration order', () => {
      const manager = createManager();
      manager.registerCleanupTask('websockets', async () => {});
      manager.registerCleanupTask('browsers', async () => {});
      manager.registerCleanupTask('timers', async () => {});

      expect(manager.getTaskNames()).toEqual(['websockets', 'browsers', 'timers']);
    });
  });

  // ── Requirement 20 acceptance criteria ───────────────────────────────────

  describe('Requirement 20 acceptance criteria', () => {
    it('20.2 — stop-requests task runs first when registered first', async () => {
      const manager = createManager();
      const order: string[] = [];

      // Simulate the recommended shutdown order from the design doc
      manager.registerCleanupTask('stop-requests', async () => { order.push('stop-requests'); });
      manager.registerCleanupTask('close-websockets', async () => { order.push('close-websockets'); });
      manager.registerCleanupTask('close-browsers', async () => { order.push('close-browsers'); });
      manager.registerCleanupTask('save-state', async () => { order.push('save-state'); });
      manager.registerCleanupTask('clear-timers', async () => { order.push('clear-timers'); });
      manager.registerCleanupTask('close-server', async () => { order.push('close-server'); });

      await manager.shutdown('SIGTERM');

      expect(order).toEqual([
        'stop-requests',
        'close-websockets',
        'close-browsers',
        'save-state',
        'clear-timers',
        'close-server',
      ]);
    });

    it('20.9 — each cleanup step is logged (tasks are called)', async () => {
      const manager = createManager();
      const executed: string[] = [];

      manager.registerCleanupTask('task-a', async () => { executed.push('task-a'); });
      manager.registerCleanupTask('task-b', async () => { executed.push('task-b'); });

      await manager.shutdown('SIGTERM');

      expect(executed).toEqual(['task-a', 'task-b']);
    });
  });
});
