/**
 * SessionPersister Tests
 *
 * Tests for session state persistence logic.
 *
 * Requirement 21: Session State Persistence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionPersister } from './SessionPersister';
import { ProjectSession, PersistedSession } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Create a minimal ProjectSession stub */
function makeSession(projectName: string, globalVariables: Record<string, any> = {}): ProjectSession {
  return {
    projectName,
    browser: null,
    context: null,
    page: null,
    cdpPort: 0,
    currentlyRunningProfileDir: null,
    activeWs: null,
    isBotRunning: false,
    lastActiveNodeId: null,
    lastActiveNodeTitle: null,
    botSettings: { photoDebug: false },
    globalVariables,
    nodeRuntimeState: new Map(),
    isStreaming: false,
    photoDebugEnabled: false,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    safetyTimeout: null,
  };
}

/** Create a temporary file path in the OS temp directory */
function tempFilePath(name: string): string {
  return path.join(os.tmpdir(), `session-persister-test-${name}-${Date.now()}.json`);
}

/** Build a SessionPersister backed by a given sessions Map */
function buildPersister(
  sessions: Map<string, ProjectSession>,
  filePath: string
): SessionPersister {
  const sessionsProvider = () => sessions;
  const sessionRestorer = (name: string) => {
    if (!sessions.has(name)) {
      sessions.set(name, makeSession(name));
    }
    return sessions.get(name)!;
  };
  return new SessionPersister(sessionsProvider, sessionRestorer, filePath);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('SessionPersister', () => {
  let filePath: string;

  beforeEach(() => {
    filePath = tempFilePath('main');
  });

  afterEach(() => {
    // Clean up temp files
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  });

  // ── saveState ─────────────────────────────────────────────────────────────

  describe('saveState', () => {
    it('creates sessions.json with correct structure', async () => {
      const sessions = new Map<string, ProjectSession>();
      sessions.set('project-a', makeSession('project-a', { score: 42 }));

      const persister = buildPersister(sessions, filePath);
      await persister.saveState();

      const raw = fs.readFileSync(filePath, 'utf-8');
      const saved: PersistedSession[] = JSON.parse(raw);

      expect(Array.isArray(saved)).toBe(true);
      expect(saved).toHaveLength(1);
      expect(saved[0].projectName).toBe('project-a');
      expect(saved[0].globalVariables).toEqual({ score: 42 });
      expect(typeof saved[0].timestamp).toBe('number');
    });

    it('saves multiple sessions', async () => {
      const sessions = new Map<string, ProjectSession>();
      sessions.set('alpha', makeSession('alpha', { x: 1 }));
      sessions.set('beta', makeSession('beta', { y: 2 }));

      const persister = buildPersister(sessions, filePath);
      await persister.saveState();

      const saved: PersistedSession[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(saved).toHaveLength(2);

      const names = saved.map((s) => s.projectName).sort();
      expect(names).toEqual(['alpha', 'beta']);
    });

    it('saves empty array when there are no sessions', async () => {
      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);
      await persister.saveState();

      const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(saved).toEqual([]);
    });

    it('does NOT persist isBotRunning as true (Requirement 21.4)', async () => {
      const sessions = new Map<string, ProjectSession>();
      const session = makeSession('running-project');
      session.isBotRunning = true; // simulate a running bot
      sessions.set('running-project', session);

      const persister = buildPersister(sessions, filePath);
      await persister.saveState();

      const saved: PersistedSession[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(saved[0].isBotRunning).toBe(false);
    });

    it('includes a timestamp close to now', async () => {
      const before = Date.now();
      const sessions = new Map<string, ProjectSession>();
      sessions.set('ts-project', makeSession('ts-project'));

      const persister = buildPersister(sessions, filePath);
      await persister.saveState();
      const after = Date.now();

      const saved: PersistedSession[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(saved[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(saved[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('overwrites the file on subsequent saves', async () => {
      const sessions = new Map<string, ProjectSession>();
      sessions.set('proj', makeSession('proj', { v: 1 }));

      const persister = buildPersister(sessions, filePath);
      await persister.saveState();

      // Update variable and save again
      sessions.get('proj')!.globalVariables = { v: 99 };
      await persister.saveState();

      const saved: PersistedSession[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(saved[0].globalVariables).toEqual({ v: 99 });
    });
  });

  // ── loadState ─────────────────────────────────────────────────────────────

  describe('loadState', () => {
    it('restores globalVariables from sessions.json', async () => {
      const state: PersistedSession[] = [
        {
          projectName: 'restored-project',
          isBotRunning: false,
          lastActiveNodeId: null,
          globalVariables: { coins: 100 },
          timestamp: Date.now(),
        },
      ];
      fs.writeFileSync(filePath, JSON.stringify(state), 'utf-8');

      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);
      await persister.loadState();

      expect(sessions.has('restored-project')).toBe(true);
      expect(sessions.get('restored-project')!.globalVariables).toEqual({ coins: 100 });
    });

    it('does nothing when sessions.json does not exist (Requirement 21.6)', async () => {
      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath); // file doesn't exist yet
      await expect(persister.loadState()).resolves.not.toThrow();
      expect(sessions.size).toBe(0);
    });

    it('falls back to empty state when sessions.json is corrupted (Requirement 21.6)', async () => {
      fs.writeFileSync(filePath, 'NOT VALID JSON }{', 'utf-8');

      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);
      await expect(persister.loadState()).resolves.not.toThrow();
      expect(sessions.size).toBe(0);
    });

    it('falls back to empty state when sessions.json root is not an array', async () => {
      fs.writeFileSync(filePath, JSON.stringify({ notAnArray: true }), 'utf-8');

      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);
      await expect(persister.loadState()).resolves.not.toThrow();
      expect(sessions.size).toBe(0);
    });

    it('does NOT restore isBotRunning as true', async () => {
      const state: PersistedSession[] = [
        {
          projectName: 'was-running',
          isBotRunning: true, // stale value in file
          lastActiveNodeId: 'node-1',
          globalVariables: {},
          timestamp: Date.now(),
        },
      ];
      fs.writeFileSync(filePath, JSON.stringify(state), 'utf-8');

      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);
      await persister.loadState();

      // isBotRunning should remain false (browser not running after restart)
      expect(sessions.get('was-running')!.isBotRunning).toBe(false);
    });

    it('skips entries with missing projectName', async () => {
      const state = [
        { globalVariables: {}, timestamp: Date.now() }, // no projectName
        { projectName: 'valid-project', globalVariables: { ok: true }, timestamp: Date.now() },
      ];
      fs.writeFileSync(filePath, JSON.stringify(state), 'utf-8');

      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);
      await persister.loadState();

      expect(sessions.has('valid-project')).toBe(true);
      expect(sessions.size).toBe(1);
    });

    it('restores multiple sessions', async () => {
      const state: PersistedSession[] = [
        { projectName: 'p1', isBotRunning: false, lastActiveNodeId: null, globalVariables: { a: 1 }, timestamp: Date.now() },
        { projectName: 'p2', isBotRunning: false, lastActiveNodeId: null, globalVariables: { b: 2 }, timestamp: Date.now() },
      ];
      fs.writeFileSync(filePath, JSON.stringify(state), 'utf-8');

      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);
      await persister.loadState();

      expect(sessions.size).toBe(2);
      expect(sessions.get('p1')!.globalVariables).toEqual({ a: 1 });
      expect(sessions.get('p2')!.globalVariables).toEqual({ b: 2 });
    });
  });

  // ── scheduleAutoSave ──────────────────────────────────────────────────────

  describe('scheduleAutoSave', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('starts auto-save and isAutoSaveActive() returns true', () => {
      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);

      expect(persister.isAutoSaveActive()).toBe(false);
      persister.scheduleAutoSave(30_000);
      expect(persister.isAutoSaveActive()).toBe(true);
    });

    it('triggers saveState after the interval elapses', async () => {
      const sessions = new Map<string, ProjectSession>();
      sessions.set('auto-proj', makeSession('auto-proj', { tick: 1 }));

      const persister = buildPersister(sessions, filePath);

      // Spy on saveState to verify it is called without relying on real async I/O
      const saveSpy = vi.spyOn(persister, 'saveState').mockResolvedValue(undefined);

      persister.scheduleAutoSave(30_000);

      // Advance time by 30 seconds to fire the interval
      await vi.advanceTimersByTimeAsync(30_000);

      // Allow the microtask queue to drain
      await Promise.resolve();

      expect(saveSpy).toHaveBeenCalledTimes(1);

      persister.stopAutoSave();
      saveSpy.mockRestore();
    });

    it('replaces existing auto-save timer when called again', () => {
      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);

      persister.scheduleAutoSave(30_000);
      persister.scheduleAutoSave(60_000); // replace

      expect(persister.isAutoSaveActive()).toBe(true);
      persister.stopAutoSave();
    });
  });

  // ── stopAutoSave ──────────────────────────────────────────────────────────

  describe('stopAutoSave', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('stops the auto-save timer and isAutoSaveActive() returns false', () => {
      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);

      persister.scheduleAutoSave(30_000);
      expect(persister.isAutoSaveActive()).toBe(true);

      persister.stopAutoSave();
      expect(persister.isAutoSaveActive()).toBe(false);
    });

    it('does not trigger saveState after being stopped', async () => {
      const sessions = new Map<string, ProjectSession>();
      sessions.set('stopped-proj', makeSession('stopped-proj'));

      const persister = buildPersister(sessions, filePath);
      persister.scheduleAutoSave(30_000);
      persister.stopAutoSave();

      // Advance time — no save should occur
      await vi.advanceTimersByTimeAsync(60_000);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('is safe to call when no timer is active', () => {
      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);
      expect(() => persister.stopAutoSave()).not.toThrow();
    });
  });

  // ── round-trip ────────────────────────────────────────────────────────────

  describe('round-trip (save then load)', () => {
    it('preserves globalVariables across save and load', async () => {
      const variables = { level: 5, gold: 1000, items: ['sword', 'shield'] };

      // Save
      const saveSessions = new Map<string, ProjectSession>();
      saveSessions.set('round-trip', makeSession('round-trip', variables));
      const savePersister = buildPersister(saveSessions, filePath);
      await savePersister.saveState();

      // Load into a fresh sessions map
      const loadSessions = new Map<string, ProjectSession>();
      const loadPersister = buildPersister(loadSessions, filePath);
      await loadPersister.loadState();

      expect(loadSessions.get('round-trip')!.globalVariables).toEqual(variables);
    });
  });

  // ── getSessionFilePath ────────────────────────────────────────────────────

  describe('getSessionFilePath', () => {
    it('returns the configured file path', () => {
      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);
      expect(persister.getSessionFilePath()).toBe(filePath);
    });
  });

  // ── Requirement 21 acceptance criteria ───────────────────────────────────

  describe('Requirement 21 acceptance criteria', () => {
    it('21.3 — persisted state includes projectName, globalVariables, and timestamp', async () => {
      const sessions = new Map<string, ProjectSession>();
      sessions.set('req21', makeSession('req21', { key: 'value' }));

      const persister = buildPersister(sessions, filePath);
      await persister.saveState();

      const saved: PersistedSession[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const entry = saved[0];

      expect(entry).toHaveProperty('projectName', 'req21');
      expect(entry).toHaveProperty('globalVariables', { key: 'value' });
      expect(entry).toHaveProperty('timestamp');
      expect(typeof entry.timestamp).toBe('number');
    });

    it('21.4 — isBotRunning is always false in persisted state', async () => {
      const sessions = new Map<string, ProjectSession>();
      const session = makeSession('req21-4');
      session.isBotRunning = true;
      sessions.set('req21-4', session);

      const persister = buildPersister(sessions, filePath);
      await persister.saveState();

      const saved: PersistedSession[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(saved[0].isBotRunning).toBe(false);
    });

    it('21.5 — loads state from sessions.json on startup', async () => {
      const state: PersistedSession[] = [
        { projectName: 'startup-proj', isBotRunning: false, lastActiveNodeId: null, globalVariables: { loaded: true }, timestamp: Date.now() },
      ];
      fs.writeFileSync(filePath, JSON.stringify(state), 'utf-8');

      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);
      await persister.loadState();

      expect(sessions.get('startup-proj')!.globalVariables).toEqual({ loaded: true });
    });

    it('21.6 — starts with empty state when file is missing', async () => {
      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);
      await persister.loadState();
      expect(sessions.size).toBe(0);
    });

    it('21.6 — starts with empty state when file is corrupted', async () => {
      fs.writeFileSync(filePath, '{ corrupted json [[[', 'utf-8');

      const sessions = new Map<string, ProjectSession>();
      const persister = buildPersister(sessions, filePath);
      await persister.loadState();
      expect(sessions.size).toBe(0);
    });
  });
});
