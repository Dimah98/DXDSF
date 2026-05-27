/**
 * Shutdown Manager
 *
 * Manages graceful server shutdown by orchestrating sequential cleanup tasks
 * when the process receives SIGTERM or SIGINT signals.
 *
 * Features:
 * - Registers handlers for SIGTERM and SIGINT signals
 * - Executes cleanup tasks in registration order (sequential)
 * - 30-second timeout for graceful shutdown before forced exit
 * - Logs each cleanup step with the Logger
 * - Prevents double-shutdown via isShuttingDown guard
 *
 * Recommended cleanup task registration order (per design doc):
 *   1. Stop accepting new HTTP requests
 *   2. Close all WebSocket connections
 *   3. Close all browser instances
 *   4. Save session state to disk
 *   5. Clear all timers
 *   6. Close the HTTP server
 *
 * Requirement 20: Graceful Shutdown
 */

import { Logger } from '../logger';
import { ShutdownManager as IShutdownManager } from '../types';

/** Maximum time (ms) to wait for graceful shutdown before forcing exit */
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 30_000;

const logger = new Logger('ShutdownManager');

/**
 * ShutdownManager orchestrates graceful server shutdown.
 *
 * Usage:
 * ```typescript
 * const shutdownManager = new ShutdownManager();
 *
 * // Register cleanup tasks in the desired execution order
 * shutdownManager.registerCleanupTask('stop-requests', async () => {
 *   server.close();
 * });
 * shutdownManager.registerCleanupTask('websockets', async () => {
 *   await websocketLifecycle.closeAllConnections();
 * });
 * shutdownManager.registerCleanupTask('browsers', async () => {
 *   for (const session of sessions.values()) {
 *     await browserLifecycle.closeBrowser(session);
 *   }
 * });
 * shutdownManager.registerCleanupTask('save-state', async () => {
 *   await sessionPersister.saveState();
 * });
 * shutdownManager.registerCleanupTask('timers', async () => {
 *   timerManager.clearAllTimers();
 * });
 * shutdownManager.registerCleanupTask('http-server', async () => {
 *   await new Promise<void>((resolve) => server.close(() => resolve()));
 * });
 *
 * // Signal handlers are registered automatically in the constructor.
 * // You can also trigger shutdown manually:
 * // await shutdownManager.shutdown('manual');
 * ```
 */
export class ShutdownManager implements IShutdownManager {
  /**
   * Ordered list of cleanup tasks.
   * Using an array of [name, task] pairs to preserve insertion order.
   */
  private tasks: Array<[string, () => Promise<void>]> = [];

  /** Guard to prevent concurrent or repeated shutdown sequences */
  private isShuttingDown = false;

  /**
   * Creates a new ShutdownManager and registers SIGTERM / SIGINT handlers.
   *
   * Requirement 20.1: Register handlers for SIGTERM and SIGINT signals
   */
  constructor() {
    this.registerSignalHandlers();
  }

  /**
   * Register a cleanup task to be executed during shutdown.
   *
   * Tasks are executed sequentially in the order they are registered.
   * If a task with the same name already exists it will be replaced.
   *
   * Requirement 20.9: Log each cleanup step with the Logger
   *
   * @param name - Human-readable name for this cleanup task (used in logs)
   * @param task - Async function that performs the cleanup
   */
  registerCleanupTask(name: string, task: () => Promise<void>): void {
    // Replace existing task with the same name if present
    const existingIndex = this.tasks.findIndex(([n]) => n === name);
    if (existingIndex !== -1) {
      logger.warn('Replacing existing cleanup task with same name', { name });
      this.tasks[existingIndex] = [name, task];
    } else {
      this.tasks.push([name, task]);
    }

    logger.debug('Cleanup task registered', { name, totalTasks: this.tasks.length });
  }

  /**
   * Initiate graceful shutdown.
   *
   * Executes all registered cleanup tasks sequentially, then exits the process.
   * If shutdown does not complete within 30 seconds, forces process exit with code 1.
   *
   * This method is idempotent — subsequent calls while shutdown is in progress
   * are silently ignored.
   *
   * Requirement 20.1: Initiate graceful shutdown on SIGTERM or SIGINT
   * Requirement 20.8: Force process exit if graceful shutdown times out
   * Requirement 20.9: Log each cleanup step with the Logger
   *
   * @param signal - The signal name that triggered shutdown (e.g. 'SIGTERM', 'SIGINT')
   */
  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring duplicate signal', { signal });
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`, {
      taskCount: this.tasks.length,
    });

    // Requirement 20.8: Force exit after 30-second timeout
    const forceExitTimer = setTimeout(() => {
      logger.error(
        'Graceful shutdown timed out after 30 seconds, forcing process exit',
        undefined,
        { timeoutMs: GRACEFUL_SHUTDOWN_TIMEOUT_MS }
      );
      process.exit(1);
    }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);

    // Allow Node.js to exit normally even if this timer is still pending
    // (it will be cleared explicitly on success)
    if (forceExitTimer.unref) {
      forceExitTimer.unref();
    }

    try {
      // Requirement 20.9: Log each cleanup step
      for (const [name, task] of this.tasks) {
        logger.info(`Running cleanup task: ${name}`);
        try {
          await task();
          logger.info(`Cleanup task completed: ${name}`);
        } catch (err) {
          // A failing cleanup task must not abort the remaining tasks
          logger.error(
            `Cleanup task failed: ${name}`,
            err instanceof Error ? err : new Error(String(err))
          );
        }
      }

      clearTimeout(forceExitTimer);
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      // Unexpected error in the shutdown loop itself
      clearTimeout(forceExitTimer);
      logger.error(
        'Unexpected error during shutdown sequence',
        err instanceof Error ? err : new Error(String(err))
      );
      process.exit(1);
    }
  }

  /**
   * Returns whether a shutdown is currently in progress.
   * Useful for middleware that needs to reject new requests during shutdown.
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Returns the number of registered cleanup tasks.
   * Useful for health checks and testing.
   */
  getTaskCount(): number {
    return this.tasks.length;
  }

  /**
   * Returns the names of all registered cleanup tasks in execution order.
   * Useful for debugging and testing.
   */
  getTaskNames(): string[] {
    return this.tasks.map(([name]) => name);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register OS signal handlers for SIGTERM and SIGINT.
   *
   * Requirement 20.1: Register handlers for SIGTERM and SIGINT signals
   */
  private registerSignalHandlers(): void {
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received');
      this.shutdown('SIGTERM').catch((err) => {
        logger.error(
          'Unhandled error in SIGTERM shutdown handler',
          err instanceof Error ? err : new Error(String(err))
        );
        process.exit(1);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT signal received');
      this.shutdown('SIGINT').catch((err) => {
        logger.error(
          'Unhandled error in SIGINT shutdown handler',
          err instanceof Error ? err : new Error(String(err))
        );
        process.exit(1);
      });
    });

    logger.debug('Signal handlers registered for SIGTERM and SIGINT');
  }
}
