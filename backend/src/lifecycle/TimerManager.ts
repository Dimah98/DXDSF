/**
 * Timer Manager
 *
 * Manages the lifecycle of all timers to prevent memory leaks
 * from abandoned timers.
 *
 * Features:
 * - Centralized Map for all registered timers
 * - Periodic cleanup of inactive timers (every 60 minutes)
 * - Removes timers for projects without active WebSocket connections
 * - Clears all timers during graceful shutdown
 *
 * Requirement 10: Timer Lifecycle Management
 */

import { Logger } from '../logger';
import { ProjectSession } from '../types';

/** Cleanup interval: 60 minutes in milliseconds */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const logger = new Logger('TimerManager');

/**
 * Callback type for session lookup by project name.
 * Returns the ProjectSession if found, or undefined.
 */
export type SessionLookup = (projectName: string) => ProjectSession | undefined;

/**
 * TimerManager manages the full lifecycle of all application timers.
 *
 * Usage:
 * ```typescript
 * const timerManager = new TimerManager(sessions.get.bind(sessions));
 *
 * // Register a timer
 * const timer = setTimeout(() => doWork(), 5000);
 * timerManager.registerTimer('myProject:autoSave', timer);
 *
 * // Clear a specific timer
 * timerManager.clearTimer('myProject:autoSave');
 *
 * // During shutdown:
 * timerManager.clearAllTimers();
 * timerManager.stopCleanupTimer();
 * ```
 */
export class TimerManager {
  /** Centralized map of all registered timers, keyed by unique string key */
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** Handle for the periodic cleanup interval */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * @param sessionLookup - Optional function to retrieve a ProjectSession by project name.
   *   When provided, timers whose project key prefix has no active WebSocket connection
   *   will be cleared during periodic cleanup.
   *   The key convention is `<projectName>:<timerType>` — the part before the first `:` is
   *   treated as the project name.
   */
  constructor(private readonly sessionLookup?: SessionLookup) {
    this.startCleanupTimer();
  }

  /**
   * Register a timer with the manager.
   *
   * If a timer with the same key already exists, it will be cleared first
   * before registering the new one.
   *
   * Requirement 10.1: Register the timer with a unique key
   *
   * @param key - Unique identifier for this timer (e.g. 'myProject:autoSave')
   * @param timer - The NodeJS.Timeout handle returned by setTimeout/setInterval
   */
  registerTimer(key: string, timer: ReturnType<typeof setTimeout>): void {
    // Clear any existing timer with the same key to avoid leaks
    if (this.timers.has(key)) {
      logger.warn('Replacing existing timer with same key', { key });
      this.clearTimer(key);
    }

    this.timers.set(key, timer);
    logger.debug('Timer registered', { key, totalTimers: this.timers.size });
  }

  /**
   * Clear a specific timer and remove it from the registry.
   *
   * Requirement 10.2: Clear the timer and remove it from the registry
   *
   * @param key - The unique key of the timer to clear
   */
  clearTimer(key: string): void {
    const timer = this.timers.get(key);

    if (timer === undefined) {
      logger.debug('clearTimer called for unknown key (no-op)', { key });
      return;
    }

    clearTimeout(timer);
    this.timers.delete(key);
    logger.debug('Timer cleared', { key, totalTimers: this.timers.size });
  }

  /**
   * Check all registered timers and clear those associated with projects
   * that have no active WebSocket connection.
   *
   * Timer keys are expected to follow the convention `<projectName>:<timerType>`.
   * If no sessionLookup was provided at construction time, this method is a no-op.
   *
   * Requirement 10.3: Check for inactive timers every 60 minutes
   * Requirement 10.4: Clear timers for sessions with no active WebSocket
   */
  // Очищаємо неактивні таймери для проектів, які не мають активного з'єднання
  cleanupInactiveTimers(): void {
    // Перевіряємо чи задано функцію пошуку сесії проекту
    if (!this.sessionLookup) {
      // Якщо ні, логуємо дебаг-повідомлення
      logger.debug('cleanupInactiveTimers: no sessionLookup provided, skipping');
      // Завершуємо виконання функції
      return;
    }

    // Зберігаємо кількість очищених таймерів для статистики
    let clearedCount = 0;

    // Проходимо по всіх зареєстрованих ключах таймерів у мапі
    for (const key of this.timers.keys()) {
      // Витягуємо назву проекту з поточного ключа таймера
      const projectName = this.extractProjectName(key);

      // Якщо префікс відсутній або це системний таймер
      if (!projectName || projectName === 'system') {
        // Пропускаємо очищення для цього таймера
        continue;
      }

      // Шукаємо активну сесію для знайденого проекту
      const session = this.sessionLookup(projectName);

      // Перевіряємо чи відсутня сесія або чи немає активного веб-сокету
      if (!session || session.activeWs === null) {
        // Логуємо інформацію про видалення неактивного таймера проекту
        logger.info('Clearing timer for project with no active WebSocket', {
          // Ключ таймера
          key,
          // Назва проекту
          projectName,
          // Прапорець чи взагалі існує сесія
          sessionExists: !!session,
        });
        // Очищаємо цей таймер з мапи та зупиняємо його
        this.clearTimer(key);
        // Збільшуємо лічильник очищених таймерів
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      logger.info('Inactive timer cleanup complete', { clearedCount });
    } else {
      logger.debug('Inactive timer cleanup: no inactive timers found', {
        totalTimers: this.timers.size,
      });
    }
  }

  /**
   * Clear all registered timers.
   * Should be called during graceful shutdown.
   *
   * Requirement 10.5: Clear all registered timers on shutdown
   */
  clearAllTimers(): void {
    const count = this.timers.size;

    if (count === 0) {
      logger.info('No timers to clear');
      return;
    }

    logger.info('Clearing all timers', { count });

    for (const [key, timer] of this.timers) {
      clearTimeout(timer);
      logger.debug('Timer cleared during shutdown', { key });
    }

    this.timers.clear();
    logger.info('All timers cleared', { clearedCount: count });
  }

  /**
   * Start the periodic cleanup timer that runs every 60 minutes.
   *
   * Requirement 10.3: Check for inactive timers every 60 minutes
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      logger.debug('Running periodic inactive timer cleanup');
      this.cleanupInactiveTimers();
    }, CLEANUP_INTERVAL_MS);

    // Allow Node.js to exit even if this timer is still running
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }

    logger.debug('Timer cleanup interval started', { intervalMs: CLEANUP_INTERVAL_MS });
  }

  /**
   * Stop the periodic cleanup timer.
   * Should be called during graceful shutdown.
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logger.debug('Timer cleanup interval stopped');
    }
  }

  /**
   * Get the number of currently registered timers.
   * Useful for health checks and monitoring.
   */
  getTimerCount(): number {
    return this.timers.size;
  }

  /**
   * Check whether a timer with the given key is currently registered.
   *
   * @param key - The timer key to check
   */
  hasTimer(key: string): boolean {
    return this.timers.has(key);
  }

  /**
   * Extract the project name from a timer key.
   *
   * Convention: `<projectName>:<timerType>`
   * Returns the part before the first `:`, or null if there is no `:`.
   *
   * @param key - The timer key
   */
  private extractProjectName(key: string): string | null {
    const colonIndex = key.indexOf(':');
    if (colonIndex === -1) {
      return null;
    }
    return key.substring(0, colonIndex);
  }
}
