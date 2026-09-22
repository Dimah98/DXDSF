/**
 * Browser Lifecycle Manager
 *
 * Manages the lifecycle of Playwright browser instances to prevent memory leaks
 * from abandoned browsers and zombie processes.
 *
 * Features:
 * - Launches browsers and registers them in the session
 * - Guarantees browser cleanup via try-finally blocks
 * - 10-minute inactivity safety timeout for automatic browser closure
 * - Tracks CDP ports for each session
 * - Zombie process cleanup using netstat and taskkill (Windows)
 * - Ensures browser cleanup on profile changes
 *
 * Requirements: 9, 27
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { Page } from 'playwright';
import { Logger } from '../logger';
import { BrowserLifecycle as IBrowserLifecycle, BrowserSettings, ProjectSession } from '../types';
import { connectToBrowser, closeSessionBrowser } from '../browserManager';
import { internalConfig } from '../internalConfig';

/** Safety timeout default: 24 hours in milliseconds (customizable via frontend settings/internalConfig) */
export const SAFETY_TIMEOUT_MS = 24 * 60 * 60 * 1000;

/**
 * Get the effective browser safety timeout in milliseconds from internalConfig,
 * or fallback to SAFETY_TIMEOUT_MS.
 */
export function getBrowserSafetyTimeoutMs(): number {
  const customMinutes = internalConfig.get('browserSafetyTimeoutMinutes');
  if (customMinutes && customMinutes > 0) {
    return customMinutes * 60 * 1000;
  }
  const customMs = internalConfig.get('browserSafetyTimeoutMs');
  if (customMs && customMs > 0) {
    return customMs;
  }
  return SAFETY_TIMEOUT_MS;
}

const logger = new Logger('BrowserLifecycle');

/**
 * BrowserLifecycle manages the full lifecycle of Playwright browser instances.
 *
 * Usage:
 * ```typescript
 * const lifecycle = new BrowserLifecycle();
 *
 * // Launch a browser with a safety timeout
 * const page = await lifecycle.launchBrowser(session, { width: 1280, height: 720 });
 * lifecycle.setupSafetyTimeout(session, 10 * 60 * 1000);
 *
 * try {
 *   // ... run bot logic ...
 * } finally {
 *   await lifecycle.closeBrowser(session);
 * }
 * ```
 */
export class BrowserLifecycle implements IBrowserLifecycle {
  /**
   * Launch a browser for the given session with the provided settings.
   *
   * Delegates to the existing connectToBrowser function which handles:
   * - Connecting to an already-running IT Browser via CDP
   * - Launching a new IT Browser instance if none is running
   * - Profile changes (closes old browser, kills zombie processes)
   * - Proxy configuration
   *
   * Requirement 9.1: Register the browser instance in the Session
   * Requirement 9.4: Terminate existing browser process before launching new one on profile change
   *
   * @param session - The project session to launch the browser for
   * @param settings - Browser configuration (width, height, profile, proxy, etc.)
   * @returns The active Playwright Page
   */
  async launchBrowser(session: ProjectSession, settings: BrowserSettings): Promise<Page> {
    logger.info('Launching browser for session', {
      projectName: session.projectName,
      cdpPort: session.cdpPort,
      profileDir: settings.profileDir,
      width: settings.width,
      height: settings.height,
    });

    const page = await connectToBrowser(
      session,
      settings.width,
      settings.height,
      settings.profile,
      settings.profileDir,
      settings.proxy
    );

    // Update last activity timestamp
    session.lastActivity = Date.now();

    logger.info('Browser launched successfully', {
      projectName: session.projectName,
      cdpPort: session.cdpPort,
    });

    return page;
  }

  /**
   * Close the browser for the given session and clean up all associated resources.
   *
   * Clears any active safety timeout before closing to prevent double-close races.
   *
   * Requirement 9.2: Close the browser instance regardless of success or failure
   * Requirement 9.5: Use try-finally blocks to guarantee browser cleanup
   *
   * @param session - The project session whose browser should be closed
   */
  async closeBrowser(session: ProjectSession): Promise<void> {
    // Clear any pending safety timeout to avoid a second close attempt
    if (session.safetyTimeout) {
      clearTimeout(session.safetyTimeout);
      session.safetyTimeout = null;
      logger.debug('Cleared safety timeout before closing browser', {
        projectName: session.projectName,
      });
    }

    if (!session.browser && !session.context) {
      logger.debug('No browser or context to close for session', { projectName: session.projectName });
      return;
    }

    logger.info('Closing browser for session', { projectName: session.projectName });

    try {
      await closeSessionBrowser(session);
      logger.info('Browser closed successfully', { projectName: session.projectName });
    } catch (err) {
      logger.error(
        'Error closing browser for session',
        err instanceof Error ? err : new Error(String(err)),
        { projectName: session.projectName }
      );
    }
  }

  /**
   * Set up a safety timeout that automatically closes the browser after a period
   * of inactivity. Clears any previously registered timeout for the session first.
   *
   * Requirement 9.3: Automatically close browser after 10 minutes of inactivity
   *
   * @param session - The project session to set the timeout for
   * @param timeoutMs - Inactivity duration in milliseconds (default: 10 minutes)
   */
  setupSafetyTimeout(session: ProjectSession, timeoutMs: number = getBrowserSafetyTimeoutMs()): void {
    // Clear any existing safety timeout
    if (session.safetyTimeout) {
      clearTimeout(session.safetyTimeout);
      session.safetyTimeout = null;
    }

    logger.debug('Setting up safety timeout', {
      projectName: session.projectName,
      timeoutMs,
    });

    session.safetyTimeout = setTimeout(async () => {
      logger.warn('Safety timeout triggered — closing browser due to inactivity', {
        projectName: session.projectName,
        inactiveMs: timeoutMs,
      });

      session.safetyTimeout = null;

      try {
        await closeSessionBrowser(session);
        session.isBotRunning = false;
        logger.info('Browser closed by safety timeout', { projectName: session.projectName });
      } catch (err) {
        logger.error(
          'Error closing browser during safety timeout',
          err instanceof Error ? err : new Error(String(err)),
          { projectName: session.projectName }
        );
      }
    }, timeoutMs);

    // Allow Node.js to exit even if this timer is still running
    if (session.safetyTimeout.unref) {
      session.safetyTimeout.unref();
    }
  }

  /**
   * Scan all tracked sessions and kill any zombie browser processes that are
   * still listening on a session's CDP port but whose browser object is gone
   * (or disconnected).
   *
   * Uses `netstat -ano` to find the PID listening on the port, then
   * `taskkill /F /PID <pid> /T` to terminate the process tree.
   *
   * Requirement 27.1: Track CDP ports for all launched browser instances
   * Requirement 27.2: Identify processes using the old CDP port
   * Requirement 27.3: Terminate zombie browser processes using platform-specific commands
   * Requirement 27.4: Verify process termination by checking process list
   * Requirement 27.5: Log error and continue if termination fails
   *
   * @param sessions - Map of all project sessions to inspect
   */
  async cleanupZombieBrowsers(sessions?: Map<string, ProjectSession>): Promise<void> {
    logger.info('Starting zombie browser cleanup');

    if (!sessions || sessions.size === 0) {
      logger.debug('No sessions to inspect for zombie browsers');
      return;
    }

    let killedCount = 0;

    for (const [projectName, session] of sessions) {
      // Only check sessions where the browser object is gone or disconnected
      const browserAlive = session.browser && session.browser.isConnected();
      if (browserAlive) {
        continue;
      }

      const port = session.cdpPort;
      if (!port) {
        continue;
      }

      logger.debug('Checking for zombie process on CDP port', { projectName, port });

      const pid = await this.findPidOnPort(port);
      if (!pid) {
        continue;
      }

      logger.warn('Found zombie browser process', { projectName, port, pid });

      const killed = await this.killProcess(pid, projectName, port);
      if (killed) {
        killedCount++;
        // Verify the process is gone
        const stillRunning = await this.findPidOnPort(port);
        if (stillRunning) {
          logger.warn('Zombie process still running after kill attempt', {
            projectName,
            port,
            pid,
          });
        } else {
          logger.info('Zombie process successfully terminated', { projectName, port, pid });
        }
      }
    }

    logger.info('Zombie browser cleanup complete', { killedCount });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Find the PID of the process listening on the given TCP port.
   * Uses lsof on Linux/macOS (Docker), netstat on Windows.
   *
   * Requirement 27.2: Identify processes using the CDP port
   *
   * @param port - The TCP port to check
   * @returns The PID as a string, or null if not found
   */
  private async findPidOnPort(port: number): Promise<string | null> {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0' && /^\d+$/.test(pid)) {
              return pid;
            }
          }
        }
      } else {
        // Linux / macOS (Docker)
        const { stdout } = await execAsync(`lsof -ti tcp:${port}`);
        const pid = stdout.trim().split('\n')[0];
        if (pid && /^\d+$/.test(pid)) {
          return pid;
        }
      }
    } catch {
      // No process found on port — that's fine
    }

    return null;
  }

  /**
   * Kill a process and its entire process tree.
   * Uses kill on Linux/macOS (Docker), taskkill on Windows.
   *
   * Requirement 27.3: Terminate zombie browser processes
   * Requirement 27.5: Log error and continue if termination fails
   *
   * @param pid - The PID to kill
   * @param projectName - Used for logging context
   * @param port - Used for logging context
   * @returns true if the kill command succeeded, false otherwise
   */
  private async killProcess(pid: string, projectName: string, port: number): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        await execAsync(`taskkill /F /PID ${pid} /T`);
      } else {
        await execAsync(`kill -9 ${pid}`);
      }
      logger.info('Killed zombie browser process', { projectName, port, pid });
      return true;
    } catch (err) {
      logger.error(
        'Failed to kill zombie browser process',
        err instanceof Error ? err : new Error(String(err)),
        { projectName, port, pid }
      );
      return false;
    }
  }
}

/**
 * Convenience wrapper that runs a bot operation with guaranteed browser cleanup.
 *
 * Implements the try-finally pattern from the design document:
 *
 * ```
 * try {
 *   page = await lifecycle.launchBrowser(session, settings);
 *   lifecycle.setupSafetyTimeout(session, SAFETY_TIMEOUT_MS);
 *   await runFn(page);
 * } catch (err) {
 *   logger.error(...)
 * } finally {
 *   await lifecycle.closeBrowser(session);
 *   session.isBotRunning = false;
 * }
 * ```
 *
 * Requirement 9.2: Close browser regardless of success or failure
 * Requirement 9.5: Use try-finally blocks to guarantee browser cleanup
 *
 * @param lifecycle - The BrowserLifecycle instance to use
 * @param session - The project session
 * @param settings - Browser settings
 * @param runFn - The async function to run with the browser page
 */
export async function withBrowser(
  lifecycle: BrowserLifecycle,
  session: ProjectSession,
  settings: BrowserSettings,
  runFn: (page: Page) => Promise<void>
): Promise<void> {
  let page: Page | null = null;

  try {
    page = await lifecycle.launchBrowser(session, settings);
    lifecycle.setupSafetyTimeout(session, getBrowserSafetyTimeoutMs());
    await runFn(page);
  } catch (err) {
    logger.error(
      `Error during browser operation for project ${session.projectName}`,
      err instanceof Error ? err : new Error(String(err))
    );
    throw err;
  } finally {
    await lifecycle.closeBrowser(session);
    session.isBotRunning = false;
  }
}
