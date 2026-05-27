/**
 * Memory Monitor
 *
 * Monitors and limits memory usage to prevent the system from consuming
 * excessive memory over time.
 *
 * Features:
 * - Checks memory usage via process.memoryUsage() every 30 minutes
 * - Logs memory statistics (heapUsed, heapTotal, external, RSS)
 * - Warns when nodeRuntimeState exceeds 5000 entries
 * - Limits nodeRuntimeState to 10000 entries using FIFO eviction
 * - Logs the number of entries removed during eviction
 *
 * Requirement 11: Memory Usage Monitoring
 */

import { Logger } from '../logger';
import { MemoryStats } from '../types';

/** Warning threshold: log a warning when nodeRuntimeState exceeds this size */
const WARNING_THRESHOLD = 5000;

/** Hard limit: evict oldest entries when nodeRuntimeState exceeds this size */
const MAX_SIZE = 10000;

/** Reporting interval: 30 minutes in milliseconds */
const REPORT_INTERVAL_MS = 30 * 60 * 1000;

const logger = new Logger('MemoryMonitor');

/**
 * MemoryMonitor tracks process memory usage and enforces size limits on
 * per-session nodeRuntimeState Maps to prevent unbounded memory growth.
 *
 * Usage:
 * ```typescript
 * const monitor = new MemoryMonitor();
 *
 * // Manually check and report memory at any time
 * const stats = monitor.checkMemoryUsage();
 * monitor.reportMemoryStats();
 *
 * // Enforce size limits on a session's nodeRuntimeState
 * monitor.limitNodeRuntimeState(session.nodeRuntimeState, 10000);
 *
 * // Stop the periodic reporting timer during shutdown
 * monitor.stopReportingTimer();
 * ```
 */
export class MemoryMonitor {
  /** Handle for the periodic reporting interval */
  private reportingTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startReportingTimer();
  }

  /**
   * Read current process memory usage and return it as a MemoryStats object.
   *
   * Requirement 11.1: Check memory usage using process.memoryUsage() every 30 minutes
   * Requirement 11.2: Log memory statistics including heapUsed, heapTotal, external, and RSS
   *
   * @returns Current memory statistics in bytes
   */
  checkMemoryUsage(): MemoryStats {
    const usage = process.memoryUsage();

    const stats: MemoryStats = {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
    };

    return stats;
  }

  /**
   * Enforce a maximum size on a nodeRuntimeState Map using FIFO eviction.
   *
   * - If the map size exceeds WARNING_THRESHOLD (5000), a warning is logged.
   * - If the map size exceeds maxSize (default 10000), the oldest entries are
   *   removed until the map is exactly maxSize entries, and the number of
   *   removed entries is logged.
   *
   * Requirement 11.3: Log a warning when nodeRuntimeState exceeds 5000 entries
   * Requirement 11.4: Remove oldest entries using FIFO when size exceeds 10000
   * Requirement 11.5: Log the number of entries removed
   *
   * @param state   - The nodeRuntimeState Map to inspect and potentially trim
   * @param maxSize - Maximum allowed entries (defaults to MAX_SIZE = 10000)
   */
  limitNodeRuntimeState(state: Map<string, any>, maxSize: number = MAX_SIZE): void {
    // Warn when approaching the limit
    if (state.size > WARNING_THRESHOLD) {
      logger.warn('nodeRuntimeState is growing large', {
        currentSize: state.size,
        warningThreshold: WARNING_THRESHOLD,
        maxSize,
      });
    }

    // Evict oldest entries (FIFO) when the hard limit is exceeded
    if (state.size > maxSize) {
      const toDelete = state.size - maxSize;
      const keys = Array.from(state.keys());

      for (let i = 0; i < toDelete; i++) {
        state.delete(keys[i]);
      }

      logger.warn('Evicted entries from nodeRuntimeState (FIFO)', {
        removedCount: toDelete,
        newSize: state.size,
        maxSize,
      });
    }
  }

  /**
   * Read current memory usage, log all statistics, and check all provided
   * nodeRuntimeState maps for size violations.
   *
   * Requirement 11.1: Periodic memory check every 30 minutes
   * Requirement 11.2: Log heapUsed, heapTotal, external, RSS
   *
   * @param sessions - Optional iterable of nodeRuntimeState Maps to check
   *                   (e.g. Array.from(sessions.values()).map(s => s.nodeRuntimeState))
   */
  reportMemoryStats(sessions?: Iterable<Map<string, any>>): void {
    const stats = this.checkMemoryUsage();

    logger.info('Memory usage report', {
      heapUsed: `${(stats.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(stats.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(stats.external / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(stats.rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsedBytes: stats.heapUsed,
      heapTotalBytes: stats.heapTotal,
      externalBytes: stats.external,
      rssBytes: stats.rss,
    });

    // Optionally check all provided nodeRuntimeState maps
    if (sessions) {
      for (const state of sessions) {
        this.limitNodeRuntimeState(state);
      }
    }
  }

  /**
   * Start the periodic timer that calls reportMemoryStats every 30 minutes.
   *
   * Requirement 11.1: Check memory usage every 30 minutes
   */
  private startReportingTimer(): void {
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
    }

    this.reportingTimer = setInterval(() => {
      logger.debug('Running periodic memory usage report');
      this.reportMemoryStats();
    }, REPORT_INTERVAL_MS);

    // Allow Node.js to exit even if this timer is still running
    if (this.reportingTimer.unref) {
      this.reportingTimer.unref();
    }

    logger.debug('Memory reporting timer started', { intervalMs: REPORT_INTERVAL_MS });
  }

  /**
   * Stop the periodic reporting timer.
   * Should be called during graceful shutdown.
   */
  stopReportingTimer(): void {
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = null;
      logger.debug('Memory reporting timer stopped');
    }
  }

  /**
   * Get the current reporting interval in milliseconds.
   * Useful for testing and diagnostics.
   */
  getReportIntervalMs(): number {
    return REPORT_INTERVAL_MS;
  }
}
