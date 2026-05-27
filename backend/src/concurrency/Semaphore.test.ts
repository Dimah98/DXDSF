/**
 * Tests for Semaphore - Concurrency control for browser instances
 *
 * Validates Requirements: 19
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Semaphore, browserSemaphore } from './Semaphore';

describe('Semaphore', () => {
  describe('constructor', () => {
    it('should create a semaphore with the given limit', () => {
      const sem = new Semaphore(3);
      expect(sem.getAvailable()).toBe(3);
      expect(sem.getLimit()).toBe(3);
    });

    it('should default to MAX_PARALLEL_BROWSERS from config', () => {
      // The default semaphore uses config.get('MAX_PARALLEL_BROWSERS')
      // which defaults to 5 when no env var is set
      const sem = new Semaphore();
      expect(sem.getLimit()).toBeGreaterThan(0);
    });
  });

  describe('acquire / release', () => {
    it('should allow acquiring up to the limit without waiting', async () => {
      // Requirement 19.1: limits concurrent instances to configured value
      const sem = new Semaphore(3);

      await sem.acquire();
      expect(sem.getAvailable()).toBe(2);

      await sem.acquire();
      expect(sem.getAvailable()).toBe(1);

      await sem.acquire();
      expect(sem.getAvailable()).toBe(0);
    });

    it('should release a slot and increment available count', async () => {
      const sem = new Semaphore(2);

      await sem.acquire();
      await sem.acquire();
      expect(sem.getAvailable()).toBe(0);

      sem.release();
      expect(sem.getAvailable()).toBe(1);

      sem.release();
      expect(sem.getAvailable()).toBe(2);
    });

    it('should queue requests when limit is reached (Requirement 19.2)', async () => {
      const sem = new Semaphore(1);
      const order: number[] = [];

      // Acquire the only slot
      await sem.acquire();
      expect(sem.getAvailable()).toBe(0);
      expect(sem.getQueueLength()).toBe(0);

      // Queue two more requests
      const p1 = sem.acquire().then(() => order.push(1));
      const p2 = sem.acquire().then(() => order.push(2));

      // Give microtasks a chance to run
      await Promise.resolve();
      expect(sem.getQueueLength()).toBe(2);

      // Release the first slot — p1 should proceed
      sem.release();
      await p1;
      expect(order).toEqual([1]);
      expect(sem.getQueueLength()).toBe(1);

      // Release again — p2 should proceed
      sem.release();
      await p2;
      expect(order).toEqual([1, 2]);
      expect(sem.getQueueLength()).toBe(0);

      // Clean up
      sem.release();
    });

    it('should process queued requests in FIFO order (Requirement 19.3)', async () => {
      const sem = new Semaphore(1);
      const order: number[] = [];

      await sem.acquire(); // occupy the only slot

      // Queue 5 requests
      const promises = [1, 2, 3, 4, 5].map(n =>
        sem.acquire().then(() => {
          order.push(n);
          sem.release();
        })
      );

      // Release the initial slot to start the chain
      sem.release();

      await Promise.all(promises);
      expect(order).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('run', () => {
    it('should acquire, run the function, and release automatically (Requirement 19.4)', async () => {
      const sem = new Semaphore(2);
      const result = await sem.run(async () => 42);
      expect(result).toBe(42);
      // Slot should be released after run
      expect(sem.getAvailable()).toBe(2);
    });

    it('should release the slot even when the function throws (Requirement 19.4)', async () => {
      const sem = new Semaphore(2);

      await expect(
        sem.run(async () => {
          throw new Error('operation failed');
        })
      ).rejects.toThrow('operation failed');

      // Slot must be released despite the error
      expect(sem.getAvailable()).toBe(2);
    });

    it('should limit concurrent executions to the configured limit', async () => {
      const sem = new Semaphore(2);
      let concurrent = 0;
      let maxConcurrent = 0;

      const task = () =>
        sem.run(async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          // Simulate async work
          await new Promise(resolve => setTimeout(resolve, 10));
          concurrent--;
        });

      // Launch 5 tasks simultaneously
      await Promise.all([task(), task(), task(), task(), task()]);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
      expect(sem.getAvailable()).toBe(2);
    });

    it('should queue excess requests and process them after slots free up', async () => {
      const sem = new Semaphore(2);
      const completed: number[] = [];

      const task = (id: number) =>
        sem.run(async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
          completed.push(id);
        });

      await Promise.all([task(1), task(2), task(3), task(4)]);

      expect(completed).toHaveLength(4);
      expect(sem.getAvailable()).toBe(2);
    });
  });

  describe('getAvailable', () => {
    it('should return the number of available slots (Requirement 19.5)', async () => {
      const sem = new Semaphore(5);
      expect(sem.getAvailable()).toBe(5);

      await sem.acquire();
      expect(sem.getAvailable()).toBe(4);

      await sem.acquire();
      expect(sem.getAvailable()).toBe(3);

      sem.release();
      expect(sem.getAvailable()).toBe(4);

      sem.release();
      expect(sem.getAvailable()).toBe(5);
    });

    it('should never return a negative value', async () => {
      const sem = new Semaphore(1);
      await sem.acquire();
      expect(sem.getAvailable()).toBe(0);
      // Queue a waiter but don't release yet
      const p = sem.acquire();
      expect(sem.getAvailable()).toBe(0); // still 0, not negative
      sem.release();
      await p;
      sem.release();
    });
  });

  describe('getQueueLength', () => {
    it('should report the number of waiting requests', async () => {
      const sem = new Semaphore(1);
      await sem.acquire();

      const p1 = sem.acquire();
      const p2 = sem.acquire();
      await Promise.resolve(); // flush microtasks

      expect(sem.getQueueLength()).toBe(2);

      sem.release();
      await p1;
      expect(sem.getQueueLength()).toBe(1);

      sem.release();
      await p2;
      expect(sem.getQueueLength()).toBe(0);

      sem.release();
    });
  });

  describe('browserSemaphore singleton', () => {
    it('should be a Semaphore instance', () => {
      expect(browserSemaphore).toBeInstanceOf(Semaphore);
    });

    it('should have a positive limit configured from MAX_PARALLEL_BROWSERS', () => {
      expect(browserSemaphore.getLimit()).toBeGreaterThan(0);
    });
  });
});
