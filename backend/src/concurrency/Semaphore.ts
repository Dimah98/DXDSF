/**
 * Semaphore - Concurrency control for browser instances
 *
 * Limits the number of parallel browser operations to prevent resource exhaustion.
 * Uses a FIFO queue for requests that exceed the configured limit.
 *
 * Requirements: 19
 */

import { config } from '../config/ConfigManager';

// Simple logger for Semaphore
const semaphoreLogger = {
  debug: (msg: string, data?: any) => {
    if (config.get('LOG_LEVEL') === 0) {
      console.log(`[Semaphore] ${msg}`, data || '');
    }
  },
  info: (msg: string, data?: any) => {
    if (config.get('LOG_LEVEL') <= 1) {
      console.log(`[Semaphore] ${msg}`, data || '');
    }
  },
  warn: (msg: string, data?: any) => {
    if (config.get('LOG_LEVEL') <= 2) {
      console.warn(`[Semaphore] ${msg}`, data || '');
    }
  },
  error: (msg: string, data?: any) => {
    console.error(`[Semaphore] ${msg}`, data || '');
  }
};

/**
 * Semaphore implementation with FIFO queuing.
 *
 * Requirement 19.1: Limits concurrent browser instances to MAX_PARALLEL_BROWSERS
 * Requirement 19.2: Queues requests when the limit is reached
 * Requirement 19.3: Processes queued requests in FIFO order when a slot is released
 * Requirement 19.4: Automatically releases the slot on completion or error
 * Requirement 19.5: Exposes available slots via getAvailable()
 */
export class Semaphore {
  private running = 0;
  private readonly queue: Array<() => void> = [];
  private readonly acquireTimeoutMs: number = 5 * 60 * 1000; // 5 хвилин таймаут за замовчуванням

  /**
   * @param limit Maximum number of concurrent operations allowed.
   *              Defaults to the MAX_PARALLEL_BROWSERS configuration value.
   * @param acquireTimeoutMs Timeout in milliseconds for acquiring a slot. Default: 5 minutes.
   */
  constructor(private readonly limit: number = config.get('MAX_PARALLEL_BROWSERS'), acquireTimeoutMs?: number) {
    if (acquireTimeoutMs !== undefined) {
      this.acquireTimeoutMs = acquireTimeoutMs;
    }
  }

  /**
   * Acquire a slot. If no slot is available the caller is queued and
   * awaits until a slot is released (FIFO order).
   *
   * Requirement 19.2 / 19.3
   * @throws Error if timeout is exceeded while waiting for a slot
   */
  async acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running++;
      semaphoreLogger.debug(`Slot acquired immediately. Running: ${this.running}/${this.limit}, Queue: ${this.queue.length}`);
      return;
    }

    // No slot available — enqueue and wait with timeout
    semaphoreLogger.warn(`No slot available, queuing request. Running: ${this.running}/${this.limit}, Queue: ${this.queue.length + 1}`);
    
    let resolveFn: (() => void) | null = null;
    const queuePromise = new Promise<void>(resolve => {
      resolveFn = resolve;
      this.queue.push(resolve);
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Semaphore acquire timeout after ${this.acquireTimeoutMs}ms`));
      }, this.acquireTimeoutMs);
    });

    try {
      await Promise.race([queuePromise, timeoutPromise]);
      // The resolve callback is called by release(), which also increments running
      semaphoreLogger.debug(`Slot acquired from queue. Running: ${this.running}/${this.limit}, Queue: ${this.queue.length}`);
    } catch (err) {
      // Remove from queue if timeout occurred
      if (resolveFn) {
        const index = this.queue.findIndex(r => r === resolveFn);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
      }
      semaphoreLogger.error(`Failed to acquire slot: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  /**
   * Release a previously acquired slot.
   * If there are queued waiters, the next one is dequeued and given the slot.
   *
   * Requirement 19.3
   */
  release(): void {
    const next = this.queue.shift();
    if (next) {
      // Hand the slot directly to the next waiter — running count stays the same
      semaphoreLogger.debug(`Slot released and handed to next waiter. Running: ${this.running}/${this.limit}, Queue: ${this.queue.length}`);
      next();
    } else {
      this.running--;
      semaphoreLogger.debug(`Slot released. Running: ${this.running}/${this.limit}, Queue: ${this.queue.length}`);
    }
  }

  /**
   * Acquire a slot, run the provided async function, then release the slot
   * automatically — even if the function throws.
   *
   * Requirement 19.4
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Return the number of slots currently available (not occupied).
   *
   * Requirement 19.5
   */
  getAvailable(): number {
    return this.limit - this.running;
  }

  /**
   * Return the configured maximum concurrency limit.
   */
  getLimit(): number {
    return this.limit;
  }

  /**
   * Return the number of requests currently waiting in the queue.
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get detailed statistics about the semaphore state.
   * Useful for monitoring and diagnostics.
   */
  getStatistics(): { running: number; limit: number; queueLength: number; available: number } {
    return {
      running: this.running,
      limit: this.limit,
      queueLength: this.queue.length,
      available: this.getAvailable()
    };
  }
}

/**
 * Shared semaphore instance for browser concurrency control.
 * Configured from MAX_PARALLEL_BROWSERS environment variable (default: 5).
 */
export const browserSemaphore = new Semaphore();
