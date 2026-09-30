/**
 * Error Metrics and System Diagnostics Service
 *
 * Provides real-time counting, classification, and diagnostics of errors across
 * all backend subsystems:
 * - Total error & warning counters
 * - Subsystem ranking (which parts of the system are most problematic)
 * - Error classification (by type / error code)
 * - Ring buffer of recent errors with timestamps and stack traces
 * - Uptime and error-rate analytics
 */

import { isAppError, normalizeError } from '../errors';

export interface RecentErrorEntry {
  id: string;
  timestamp: string;
  context: string;
  message: string;
  code?: string;
  statusCode?: number;
  stack?: string;
}

export interface ProblematicContextReport {
  context: string;
  count: number;
  percentage: number;
}

export interface ErrorTypeReport {
  type: string;
  count: number;
  percentage: number;
}

export interface ErrorMetricsSummary {
  uptimeSeconds: number;
  totalErrors: number;
  totalWarnings: number;
  errorRatePerHour: number;
  mostProblematicContexts: ProblematicContextReport[];
  mostFrequentErrorTypes: ErrorTypeReport[];
  recentErrors: RecentErrorEntry[];
}

export class ErrorMetricsTracker {
  private totalErrors: number = 0;
  private totalWarnings: number = 0;
  private startedAt: number = Date.now();
  private errorsByContext: Map<string, number> = new Map();
  private errorsByType: Map<string, number> = new Map();
  private recentErrors: RecentErrorEntry[] = [];
  private readonly maxRecentErrors: number = 100;

  /**
   * Record an error occurrence from any subsystem or logger
   */
  recordError(context: string, error: unknown, meta?: Record<string, any>): void {
    this.totalErrors++;

    const normalized = normalizeError(error);
    const ctx = context || 'App';

    // 1. Update subsystem counters
    const currentContextCount = this.errorsByContext.get(ctx) || 0;
    this.errorsByContext.set(ctx, currentContextCount + 1);

    // 2. Classify error type
    let errorType = normalized.name || 'Error';
    let code: string | undefined;
    let statusCode: number | undefined;

    if (isAppError(normalized)) {
      errorType = normalized.constructor.name;
      code = normalized.code;
      statusCode = normalized.statusCode;
    } else if (meta?.code) {
      code = String(meta.code);
    }

    const currentTypeCount = this.errorsByType.get(errorType) || 0;
    this.errorsByType.set(errorType, currentTypeCount + 1);

    // 3. Append to ring buffer
    const entry: RecentErrorEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      context: ctx,
      message: normalized.message,
      code,
      statusCode,
      stack: normalized.stack,
    };

    this.recentErrors.unshift(entry);
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors.pop();
    }
  }

  /**
   * Record a warning occurrence
   */
  recordWarning(_context: string, _message?: string): void {
    this.totalWarnings++;
  }

  /**
   * Generate comprehensive metrics summary
   */
  getSummary(): ErrorMetricsSummary {
    const uptimeSeconds = Math.max(1, Math.round((Date.now() - this.startedAt) / 1000));
    const uptimeHours = uptimeSeconds / 3600;
    const errorRatePerHour = Math.round((this.totalErrors / (uptimeHours || 1)) * 10) / 10;

    // Rank most problematic subsystems
    const contextList = Array.from(this.errorsByContext.entries()).map(([context, count]) => ({
      context,
      count,
      percentage: this.totalErrors > 0 ? Math.round((count / this.totalErrors) * 1000) / 10 : 0,
    }));
    contextList.sort((a, b) => b.count - a.count);

    // Rank most frequent error types
    const typeList = Array.from(this.errorsByType.entries()).map(([type, count]) => ({
      type,
      count,
      percentage: this.totalErrors > 0 ? Math.round((count / this.totalErrors) * 1000) / 10 : 0,
    }));
    typeList.sort((a, b) => b.count - a.count);

    return {
      uptimeSeconds,
      totalErrors: this.totalErrors,
      totalWarnings: this.totalWarnings,
      errorRatePerHour,
      mostProblematicContexts: contextList.slice(0, 10),
      mostFrequentErrorTypes: typeList.slice(0, 10),
      recentErrors: this.recentErrors.slice(0, 50),
    };
  }

  /**
   * Reset metrics counters (useful for tests or periodic clearing)
   */
  reset(): void {
    this.totalErrors = 0;
    this.totalWarnings = 0;
    this.startedAt = Date.now();
    this.errorsByContext.clear();
    this.errorsByType.clear();
    this.recentErrors = [];
  }
}

export const errorMetrics = new ErrorMetricsTracker();
