/**
 * Tests for WebSocketLifecycle
 *
 * Covers:
 * - registerConnection: attaches close/error handlers, tracks connection
 * - unregisterConnection: removes from tracking set
 * - cleanupInactiveConnections: closes connections inactive > 10 minutes
 * - closeAllConnections: closes all connections and resolves
 * - Session activeWs cleared on close/error
 * - All event listeners removed on cleanup
 *
 * Requirements: 8, 28
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { WebSocketLifecycle, SessionLookup } from './WebSocketLifecycle';
import { ExtendedWebSocket, ProjectSession } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create a minimal mock WebSocket that behaves like an EventEmitter
 * and has the ExtendedWebSocket properties.
 */
function createMockWs(projectName = 'test-project', lastActivity?: number): ExtendedWebSocket {
  const emitter = new EventEmitter() as any;

  emitter.projectName = projectName;
  emitter.isStreaming = false;
  emitter.isBotRunning = false;
  emitter.isSingleNodeRun = false;
  emitter.lastActivity = lastActivity ?? Date.now();
  emitter.readyState = 1; // OPEN

  // Mock close method — emits close synchronously so tests don't need timer tricks
  emitter.close = vi.fn((code?: number, reason?: string) => {
    emitter.readyState = 3; // CLOSED
    emitter.emit('close', code ?? 1000, Buffer.from(reason ?? ''));
  });

  return emitter as ExtendedWebSocket;
}

/**
 * Create a minimal mock ProjectSession.
 */
function createMockSession(ws: ExtendedWebSocket | null = null): ProjectSession {
  return {
    projectName: 'test-project',
    browser: null,
    context: null,
    page: null,
    cdpPort: 0,
    currentlyRunningProfileDir: null,
    activeWs: ws,
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WebSocketLifecycle', () => {
  let lifecycle: WebSocketLifecycle;
  let sessions: Map<string, ProjectSession>;
  let sessionLookup: SessionLookup;

  beforeEach(() => {
    vi.useFakeTimers();
    sessions = new Map();
    sessionLookup = (name) => sessions.get(name);
    lifecycle = new WebSocketLifecycle(sessionLookup);
  });

  afterEach(() => {
    lifecycle.stopCleanupTimer();
    vi.useRealTimers();
  });

  // ── registerConnection ──────────────────────────────────────────────────

  describe('registerConnection', () => {
    it('tracks the connection', () => {
      const ws = createMockWs();
      lifecycle.registerConnection(ws, 'proj1');
      expect(lifecycle.getConnectionCount()).toBe(1);
    });

    it('sets projectName on the WebSocket', () => {
      const ws = createMockWs();
      lifecycle.registerConnection(ws, 'proj1');
      expect(ws.projectName).toBe('proj1');
    });

    it('sets lastActivity if not already set', () => {
      const ws = createMockWs();
      (ws as any).lastActivity = 0;
      lifecycle.registerConnection(ws, 'proj1');
      expect(ws.lastActivity).toBeGreaterThan(0);
    });

    it('attaches a close handler that clears session.activeWs', async () => {
      const ws = createMockWs('proj1');
      const session = createMockSession(ws);
      sessions.set('proj1', session);

      lifecycle.registerConnection(ws, 'proj1');

      // Trigger close (synchronous event emission — cleanup runs synchronously)
      ws.emit('close', 1000, Buffer.from(''));

      expect(session.activeWs).toBeNull();
    });

    it('attaches an error handler that clears session.activeWs', () => {
      const ws = createMockWs('proj1');
      const session = createMockSession(ws);
      sessions.set('proj1', session);

      lifecycle.registerConnection(ws, 'proj1');

      // Trigger error
      ws.emit('error', new Error('network error'));

      expect(session.activeWs).toBeNull();
    });

    it('removes all listeners after close', () => {
      const ws = createMockWs('proj1');
      sessions.set('proj1', createMockSession(ws));

      lifecycle.registerConnection(ws, 'proj1');
      ws.emit('close', 1000, Buffer.from(''));

      expect(ws.listenerCount('close')).toBe(0);
      expect(ws.listenerCount('error')).toBe(0);
      expect(ws.listenerCount('message')).toBe(0);
    });

    it('removes all listeners after error', () => {
      const ws = createMockWs('proj1');
      sessions.set('proj1', createMockSession(ws));

      lifecycle.registerConnection(ws, 'proj1');
      ws.emit('error', new Error('test'));

      expect(ws.listenerCount('close')).toBe(0);
      expect(ws.listenerCount('error')).toBe(0);
    });

    it('unregisters the connection after close', () => {
      const ws = createMockWs('proj1');
      sessions.set('proj1', createMockSession(ws));

      lifecycle.registerConnection(ws, 'proj1');
      expect(lifecycle.getConnectionCount()).toBe(1);

      ws.emit('close', 1000, Buffer.from(''));

      expect(lifecycle.getConnectionCount()).toBe(0);
    });

    it('does not clear session.activeWs if it points to a different ws', () => {
      const ws1 = createMockWs('proj1');
      const ws2 = createMockWs('proj1');
      const session = createMockSession(ws2); // session points to ws2
      sessions.set('proj1', session);

      lifecycle.registerConnection(ws1, 'proj1');
      ws1.emit('close', 1000, Buffer.from(''));

      // session.activeWs should still be ws2
      expect(session.activeWs).toBe(ws2);
    });
  });

  // ── unregisterConnection ────────────────────────────────────────────────

  describe('unregisterConnection', () => {
    it('removes the connection from tracking', () => {
      const ws = createMockWs();
      lifecycle.registerConnection(ws, 'proj1');
      lifecycle.unregisterConnection(ws);
      expect(lifecycle.getConnectionCount()).toBe(0);
    });

    it('is a no-op for unknown connections', () => {
      const ws = createMockWs();
      expect(() => lifecycle.unregisterConnection(ws)).not.toThrow();
    });
  });

  // ── cleanupInactiveConnections ──────────────────────────────────────────

  describe('cleanupInactiveConnections', () => {
    it('closes connections inactive for more than 10 minutes', () => {
      const tenMinutesAgo = Date.now() - 11 * 60 * 1000;
      const ws = createMockWs('proj1', tenMinutesAgo);
      sessions.set('proj1', createMockSession(ws));

      lifecycle.registerConnection(ws, 'proj1');
      lifecycle.cleanupInactiveConnections();

      expect(ws.close).toHaveBeenCalledWith(1008, 'Connection inactive for more than 10 minutes');
    });

    it('does not close recently active connections', () => {
      const ws = createMockWs('proj1', Date.now());
      sessions.set('proj1', createMockSession(ws));

      lifecycle.registerConnection(ws, 'proj1');
      lifecycle.cleanupInactiveConnections();

      expect(ws.close).not.toHaveBeenCalled();
    });

    it('runs automatically every 5 minutes via the cleanup timer', () => {
      const tenMinutesAgo = Date.now() - 11 * 60 * 1000;
      const ws = createMockWs('proj1', tenMinutesAgo);
      sessions.set('proj1', createMockSession(ws));

      lifecycle.registerConnection(ws, 'proj1');

      // Advance time by 5 minutes to trigger the cleanup interval
      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(ws.close).toHaveBeenCalled();
    });
  });

  // ── closeAllConnections ─────────────────────────────────────────────────

  describe('closeAllConnections', () => {
    it('resolves immediately when there are no connections', async () => {
      await expect(lifecycle.closeAllConnections()).resolves.toBeUndefined();
    });

    it('closes all tracked connections', async () => {
      const ws1 = createMockWs('proj1');
      const ws2 = createMockWs('proj2');
      sessions.set('proj1', createMockSession(ws1));
      sessions.set('proj2', createMockSession(ws2));

      lifecycle.registerConnection(ws1, 'proj1');
      lifecycle.registerConnection(ws2, 'proj2');

      // Since mock ws.close() emits 'close' synchronously, the promise resolves immediately
      await lifecycle.closeAllConnections();

      expect(ws1.close).toHaveBeenCalledWith(1000, 'Server shutting down');
      expect(ws2.close).toHaveBeenCalledWith(1000, 'Server shutting down');
    });

    it('clears all connections after closing', async () => {
      const ws = createMockWs('proj1');
      sessions.set('proj1', createMockSession(ws));

      lifecycle.registerConnection(ws, 'proj1');

      await lifecycle.closeAllConnections();

      expect(lifecycle.getConnectionCount()).toBe(0);
    });

    it('handles already-closed connections without throwing', async () => {
      const ws = createMockWs('proj1');
      (ws as any).readyState = 3; // CLOSED
      sessions.set('proj1', createMockSession(ws));

      lifecycle.registerConnection(ws, 'proj1');

      await expect(lifecycle.closeAllConnections()).resolves.toBeUndefined();
    });
  });

  // ── updateActivity ──────────────────────────────────────────────────────

  describe('updateActivity', () => {
    it('updates lastActivity timestamp', () => {
      const ws = createMockWs('proj1', 0);
      lifecycle.updateActivity(ws);
      expect(ws.lastActivity).toBeGreaterThan(0);
    });
  });

  // ── stopCleanupTimer ────────────────────────────────────────────────────

  describe('stopCleanupTimer', () => {
    it('stops the periodic cleanup timer', () => {
      const tenMinutesAgo = Date.now() - 11 * 60 * 1000;
      const ws = createMockWs('proj1', tenMinutesAgo);
      sessions.set('proj1', createMockSession(ws));

      lifecycle.registerConnection(ws, 'proj1');
      lifecycle.stopCleanupTimer();

      // Advance time — cleanup should NOT run since timer was stopped
      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(ws.close).not.toHaveBeenCalled();
    });
  });
});
