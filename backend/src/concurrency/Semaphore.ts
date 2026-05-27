/**
 * Semaphore - Concurrency control for browser instances
 *
 * Limits the number of parallel browser operations to prevent resource exhaustion.
 * Uses a FIFO queue for requests that exceed the configured limit.
 *
 * Requirements: 19
 */

import { config } from '../config/ConfigManager';

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

  /**
   * @param limit Maximum number of concurrent operations allowed.
   *              Defaults to the MAX_PARALLEL_BROWSERS configuration value.
   */
  constructor(private readonly limit: number = config.get('MAX_PARALLEL_BROWSERS')) {}

  /**
   * Acquire a slot. If no slot is available the caller is queued and
   * awaits until a slot is released (FIFO order).
   *
   * Requirement 19.2 / 19.3
   */
  async acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running++;
      return;
    }

    // No slot available — enqueue and wait
    await new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
    // The resolve callback is called by release(), which also increments running
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
      next();
    } else {
      this.running--;
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
}

/**
 * Shared semaphore instance for browser concurrency control.
 * Configured from MAX_PARALLEL_BROWSERS environment variable (default: 5).
 */
export const browserSemaphore = new Semaphore();
