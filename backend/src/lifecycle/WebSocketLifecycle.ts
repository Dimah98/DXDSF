/**
 * WebSocket Lifecycle Manager
 *
 * Manages the lifecycle of WebSocket connections to prevent memory leaks
 * from abandoned connections.
 *
 * Features:
 * - Registers close and error event handlers on WebSocket creation
 * - Removes WebSocket reference from ProjectSession on close
 * - Periodic cleanup of inactive connections (every 5 minutes)
 * - Closes connections inactive for more than 10 minutes
 * - Removes all event listeners on WebSocket cleanup
 *
 * Requirements: 8, 28
 */

import { WebSocket } from 'ws';
import { Logger } from '../logger';
import { ExtendedWebSocket, ProjectSession } from '../types';

/** Inactivity threshold: 10 minutes in milliseconds */
const INACTIVITY_THRESHOLD_MS = 10 * 60 * 1000;

/** Cleanup interval: 5 minutes in milliseconds */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/** WebSocket close code for normal closure */
const WS_CLOSE_NORMAL = 1000;

/** WebSocket close code for policy violation (inactive) */
const WS_CLOSE_POLICY = 1008;

const logger = new Logger('WebSocketLifecycle');

/**
 * Callback type for session lookup by project name.
 * Returns the ProjectSession if found, or undefined.
 */
export type SessionLookup = (projectName: string) => ProjectSession | undefined;

/**
 * WebSocketLifecycle manages the full lifecycle of WebSocket connections.
 *
 * Usage:
 * ```typescript
 * const lifecycle = new WebSocketLifecycle(sessions.get.bind(sessions));
 * lifecycle.registerConnection(ws, 'myProject');
 * // ... later during shutdown:
 * await lifecycle.closeAllConnections();
 * lifecycle.stopCleanupTimer();
 * ```
 */
export class WebSocketLifecycle {
  /** All currently tracked WebSocket connections */
  private connections: Set<ExtendedWebSocket> = new Set();

  /** Handle for the periodic cleanup interval */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * @param sessionLookup - Function to retrieve a ProjectSession by project name.
   *   Used to clear the activeWs reference when a connection closes.
   */
  constructor(private readonly sessionLookup: SessionLookup) {
    this.startCleanupTimer();
  }

  /**
   * Register a new WebSocket connection with the lifecycle manager.
   *
   * Attaches close and error event handlers that:
   * - Remove the WebSocket reference from the associated ProjectSession
   * - Remove all event listeners from the WebSocket
   * - Unregister the connection from this manager
   *
   * Requirement 8.1: Register close and error event handlers on WebSocket creation
   *
   * @param ws - The WebSocket connection to register
   * @param projectName - The project name associated with this connection
   */
  registerConnection(ws: ExtendedWebSocket, projectName: string): void {
    // Ensure lastActivity is set so inactivity tracking works from the start
    ws.lastActivity = ws.lastActivity || Date.now();
    ws.projectName = projectName;

    this.connections.add(ws);
    logger.debug('WebSocket connection registered', { projectName, totalConnections: this.connections.size });

    // Requirement 8.1: Register close event handler
    const onClose = (code: number, reason: Buffer) => {
      logger.info('WebSocket connection closed', {
        projectName,
        code,
        reason: reason.toString(),
      });
      this.cleanupConnection(ws);
    };

    // Requirement 28.1-28.3: Handle WebSocket errors gracefully
    const onError = (err: Error) => {
      logger.error(`WebSocket error for project ${projectName}`, err);
      this.cleanupConnection(ws);
    };

    ws.on('close', onClose);
    ws.on('error', onError);
  }

  /**
   * Unregister a WebSocket connection from the lifecycle manager.
   * Does NOT close the connection or remove event listeners — use cleanupConnection for that.
   *
   * @param ws - The WebSocket connection to unregister
   */
  unregisterConnection(ws: ExtendedWebSocket): void {
    const removed = this.connections.delete(ws);
    if (removed) {
      logger.debug('WebSocket connection unregistered', {
        projectName: ws.projectName,
        totalConnections: this.connections.size,
      });
    }
  }

  /**
   * Clean up a single WebSocket connection:
   * - Removes the WebSocket reference from the associated ProjectSession
   * - Removes all event listeners from the WebSocket
   * - Unregisters the connection from this manager
   *
   * Requirement 8.2: Remove WebSocket reference from ProjectSession on close
   * Requirement 8.3: Remove all event listeners on WebSocket cleanup
   * Requirement 28.2: Clean up associated Session resources on error
   * Requirement 28.3: Remove all event listeners on error
   *
   * @param ws - The WebSocket connection to clean up
   */
  private cleanupConnection(ws: ExtendedWebSocket): void {
    try {
      // Requirement 8.2: Remove WebSocket reference from the associated session
      const session = this.sessionLookup(ws.projectName);
      if (session && session.activeWs === ws) {
        session.activeWs = null;
        logger.debug('Cleared activeWs from session', { projectName: ws.projectName });
      }

      // Requirement 8.3 / 28.3: Remove all event listeners
      ws.removeAllListeners();

      // Unregister from tracking set
      this.connections.delete(ws);

      logger.debug('WebSocket connection cleaned up', {
        projectName: ws.projectName,
        totalConnections: this.connections.size,
      });
    } catch (err) {
      logger.error('Error during WebSocket connection cleanup', err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Check all tracked connections and close any that have been inactive
   * for more than INACTIVITY_THRESHOLD_MS (10 minutes).
   *
   * Requirement 8.4: Check for inactive connections every 5 minutes
   * Requirement 8.5: Close connections inactive for more than 10 minutes
   */
  cleanupInactiveConnections(): void {
    const now = Date.now();
    let closedCount = 0;

    for (const ws of this.connections) {
      const lastActivity = ws.lastActivity || 0;
      const inactiveMs = now - lastActivity;

      if (inactiveMs > INACTIVITY_THRESHOLD_MS) {
        logger.warn('Closing inactive WebSocket connection', {
          projectName: ws.projectName,
          inactiveMinutes: Math.floor(inactiveMs / 60000),
        });

        try {
          ws.close(WS_CLOSE_POLICY, 'Connection inactive for more than 10 minutes');
        } catch (err) {
          logger.error(
            'Error closing inactive WebSocket',
            err instanceof Error ? err : new Error(String(err)),
            { projectName: ws.projectName }
          );
          // Force cleanup even if close() throws
          this.cleanupConnection(ws);
        }

        closedCount++;
      }
    }

    if (closedCount > 0) {
      logger.info('Inactive WebSocket cleanup complete', { closedCount });
    } else {
      logger.debug('Inactive WebSocket cleanup: no inactive connections found', {
        totalConnections: this.connections.size,
      });
    }
  }

  /**
   * Close all active WebSocket connections gracefully.
   * Waits for all connections to close or times out after 30 seconds.
   *
   * Requirement 8.6: Close all active WebSocket connections on shutdown
   *
   * @returns Promise that resolves when all connections are closed
   */
  async closeAllConnections(): Promise<void> {
    const connectionCount = this.connections.size;

    if (connectionCount === 0) {
      logger.info('No active WebSocket connections to close');
      return;
    }

    logger.info('Closing all WebSocket connections', { count: connectionCount });

    const closePromises: Promise<void>[] = [];

    for (const ws of this.connections) {
      const closePromise = new Promise<void>((resolve) => {
        // If already closed, resolve immediately
        if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          this.cleanupConnection(ws);
          resolve();
          return;
        }

        // Listen for close event to resolve
        const onClose = () => {
          resolve();
        };

        ws.once('close', onClose);

        // Attempt graceful close
        try {
          ws.close(WS_CLOSE_NORMAL, 'Server shutting down');
        } catch (err) {
          logger.error(
            'Error sending close frame to WebSocket',
            err instanceof Error ? err : new Error(String(err)),
            { projectName: ws.projectName }
          );
          ws.removeListener('close', onClose);
          this.cleanupConnection(ws);
          resolve();
        }
      });

      closePromises.push(closePromise);
    }

    // Wait for all connections to close, with a 30-second timeout
    const timeout = new Promise<void>((resolve) => {
      setTimeout(() => {
        logger.warn('Timeout waiting for WebSocket connections to close, forcing cleanup');
        // Force cleanup any remaining connections
        for (const ws of this.connections) {
          this.cleanupConnection(ws);
        }
        resolve();
      }, 30000);
    });

    await Promise.race([Promise.all(closePromises), timeout]);

    logger.info('All WebSocket connections closed', { closedCount: connectionCount });
  }

  /**
   * Start the periodic cleanup timer that runs every 5 minutes.
   *
   * Requirement 8.4: Check for inactive connections every 5 minutes
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      logger.debug('Running periodic inactive WebSocket cleanup');
      this.cleanupInactiveConnections();
    }, CLEANUP_INTERVAL_MS);

    // Allow Node.js to exit even if this timer is still running
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }

    logger.debug('WebSocket cleanup timer started', {
      intervalMs: CLEANUP_INTERVAL_MS,
    });
  }

  /**
   * Stop the periodic cleanup timer.
   * Should be called during graceful shutdown.
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logger.debug('WebSocket cleanup timer stopped');
    }
  }

  /**
   * Get the number of currently tracked connections.
   * Useful for health checks and monitoring.
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Update the last activity timestamp for a WebSocket connection.
   * Should be called whenever a message is received from the client.
   *
   * @param ws - The WebSocket connection that had activity
   */
  updateActivity(ws: ExtendedWebSocket): void {
    ws.lastActivity = Date.now();
  }
}
