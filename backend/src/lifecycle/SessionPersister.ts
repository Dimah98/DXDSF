/**
 * Session Persister
 *
 * Manages persistence of session state to disk so that state is preserved
 * across server restarts.
 *
 * Features:
 * - Saves session state to sessions.json every 30 seconds (auto-save)
 * - Saves session state during graceful shutdown
 * - Persists projectName, globalVariables, and timestamp per session
 * - Does NOT persist isBotRunning or browser instances
 * - Loads session state on server startup
 * - Falls back to empty state when sessions.json is missing or corrupted
 *
 * Requirement 21: Session State Persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../logger';
import { PersistedSession, ProjectSession, SessionPersister as ISessionPersister } from '../types';

const logger = new Logger('SessionPersister');

/**
 * Callback type for retrieving all current sessions.
 * Returns a Map of projectName → ProjectSession.
 */
export type SessionsProvider = () => Map<string, ProjectSession>;

/**
 * Callback type for restoring a session by project name.
 * Should create the session if it does not exist and return it.
 */
export type SessionRestorer = (projectName: string) => ProjectSession;

/**
 * SessionPersister saves and loads session state to/from disk.
 *
 * Usage:
 * ```typescript
 * const persister = new SessionPersister(
 *   () => sessions,                          // provide current sessions map
 *   (name) => getOrCreateSession(name),      // restore / create session
 *   path.join(__dirname, '../sessions.json') // optional custom path
 * );
 *
 * // Load state on startup
 * await persister.loadState();
 *
 * // Schedule auto-save every 30 seconds
 * persister.scheduleAutoSave(30_000);
 *
 * // Save state during graceful shutdown
 * await persister.saveState();
 *
 * // Stop auto-save timer (e.g. during shutdown)
 * persister.stopAutoSave();
 * ```
 */
export class SessionPersister implements ISessionPersister {
  /** Path to the sessions state file */
  private readonly sessionFile: string;

  /** Handle for the auto-save interval timer */
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * @param sessionsProvider - Function that returns the current sessions Map
   * @param sessionRestorer  - Function that retrieves or creates a session by project name
   * @param sessionFilePath  - Optional path to the sessions.json file.
   *                           Defaults to `<package-root>/sessions.json`.
   */
  constructor(
    private readonly sessionsProvider: SessionsProvider,
    private readonly sessionRestorer: SessionRestorer,
    sessionFilePath?: string
  ) {
    this.sessionFile =
      sessionFilePath ?? path.join(__dirname, '..', '..', 'sessions.json');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Persist the current session state to disk.
   *
   * Only projectName, globalVariables, and timestamp are saved.
   * isBotRunning and browser instances are intentionally excluded.
   *
   * Requirement 21.1: Save session state to sessions.json
   * Requirement 21.2: Save session state during graceful shutdown
   * Requirement 21.3: Include projectName, globalVariables, timestamp
   * Requirement 21.4: Do NOT persist isBotRunning or browser instances
   */
  async saveState(): Promise<void> {
    const sessions = this.sessionsProvider();
    const state: PersistedSession[] = [];

    for (const [name, session] of sessions) {
      state.push({
        projectName: name,
        // Requirement 21.4: isBotRunning is intentionally NOT persisted
        // (browser is not running after restart, so this would be stale)
        isBotRunning: false,
        lastActiveNodeId: null,
        globalVariables: session.globalVariables,
        timestamp: Date.now(),
      });
    }

    try {
      await fs.promises.writeFile(
        this.sessionFile,
        JSON.stringify(state, null, 2),
        'utf-8'
      );
      logger.debug('Session state saved', {
        sessionCount: state.length,
        file: this.sessionFile,
      });
    } catch (err) {
      logger.error(
        'Failed to save session state',
        err instanceof Error ? err : new Error(String(err)),
        { file: this.sessionFile }
      );
    }
  }

  /**
   * Load session state from disk and restore globalVariables for each session.
   *
   * isBotRunning and browser-related fields are NOT restored because browsers
   * are not running after a server restart.
   *
   * Falls back to empty state when:
   * - sessions.json does not exist
   * - sessions.json contains invalid JSON
   *
   * Requirement 21.5: Load session state on server startup
   * Requirement 21.6: Fall back to empty state for missing/corrupted files
   */
  async loadState(): Promise<void> {
    let raw: string;
    try {
      raw = await fs.promises.readFile(this.sessionFile, 'utf-8');
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        logger.info('No session state file found, starting with empty state', {
          file: this.sessionFile,
        });
      } else {
        logger.warn(
          'Could not read session state file, starting with empty state',
          { file: this.sessionFile, error: err instanceof Error ? err.message : String(err) }
        );
      }
      return;
    }

    let state: PersistedSession[];
    try {
      state = JSON.parse(raw);

      // Basic structural validation
      if (!Array.isArray(state)) {
        throw new TypeError('sessions.json root must be an array');
      }
    } catch (err) {
      // Requirement 21.6: Corrupted file → warn and start fresh
      logger.warn(
        'sessions.json is corrupted or invalid, starting with empty state',
        { file: this.sessionFile, error: err instanceof Error ? err.message : String(err) }
      );
      return;
    }

    let restoredCount = 0;

    for (const persisted of state) {
      if (!persisted || typeof persisted.projectName !== 'string') {
        logger.warn('Skipping invalid persisted session entry', { entry: persisted });
        continue;
      }

      try {
        const session = this.sessionRestorer(persisted.projectName);

        // Restore only globalVariables — browser state is not restored
        if (persisted.globalVariables && typeof persisted.globalVariables === 'object') {
          session.globalVariables = persisted.globalVariables;
        }

        restoredCount++;
      } catch (err) {
        logger.error(
          `Failed to restore session for project: ${persisted.projectName}`,
          err instanceof Error ? err : new Error(String(err))
        );
      }
    }

    logger.info('Session state loaded', {
      totalEntries: state.length,
      restoredCount,
      file: this.sessionFile,
    });
  }

  /**
   * Schedule automatic state saves at the given interval.
   *
   * Calling this method again replaces any previously scheduled auto-save.
   *
   * Requirement 21.1: Save session state every 30 seconds
   *
   * @param intervalMs - Interval in milliseconds between auto-saves (default: 30 000)
   */
  scheduleAutoSave(intervalMs: number = 30_000): void {
    // Cancel any existing auto-save timer
    this.stopAutoSave();

    this.autoSaveTimer = setInterval(() => {
      this.saveState().catch((err) => {
        logger.error(
          'Auto-save failed unexpectedly',
          err instanceof Error ? err : new Error(String(err))
        );
      });
    }, intervalMs);

    // Allow Node.js to exit even if this timer is still pending
    if (this.autoSaveTimer.unref) {
      this.autoSaveTimer.unref();
    }

    logger.debug('Auto-save scheduled', { intervalMs });
  }

  /**
   * Stop the auto-save timer.
   * Should be called during graceful shutdown before the final saveState() call.
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      logger.debug('Auto-save timer stopped');
    }
  }

  /**
   * Returns whether an auto-save timer is currently active.
   * Useful for testing and health checks.
   */
  isAutoSaveActive(): boolean {
    return this.autoSaveTimer !== null;
  }

  /**
   * Returns the path to the sessions state file.
   * Useful for testing and diagnostics.
   */
  getSessionFilePath(): string {
    return this.sessionFile;
  }
}
