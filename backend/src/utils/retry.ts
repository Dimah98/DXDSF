/**
 * Universal Retry Utility
 *
 * Provides robust, reusable retry logic across all modules (network, SQLite,
 * browser automation, external services) with:
 * - Exponential backoff or fixed delay
 * - Conditional retry filtering (shouldRetry)
 * - Custom retry hooks (onRetry)
 * - Full stack trace preservation
 * - Backward compatibility with legacy (fn, maxRetries, delayMs, context) signature
 */

import { Logger } from '../logger';
import { normalizeError } from '../errors';

const logger = new Logger('Retry');

export interface RetryOptions {
  /** Maximum number of retry attempts after the first failure (default: 2) */
  maxRetries?: number;
  /** Initial delay between retries in milliseconds (default: 1000) */
  delayMs?: number;
  /** Multiplier for exponential backoff (default: 1.5, set to 1 for fixed delay) */
  backoffMultiplier?: number;
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Context name for logging (default: 'operation') */
  context?: string;
  /** Optional filter to decide whether a specific error is retryable */
  shouldRetry?: (error: Error) => boolean;
  /** Optional callback triggered before each retry attempt */
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

/**
 * Executes an async function with retry logic.
 *
 * Supports two calling conventions:
 * 1. withRetry(fn, { maxRetries: 3, delayMs: 500, context: 'BrowserClick' })
 * 2. withRetry(fn, 2, 1000, 'LegacyCall')
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  optionsOrRetries?: RetryOptions | number,
  legacyDelayMs: number = 1000,
  legacyContext: string = 'operation'
): Promise<T> {
  let opts: RetryOptions;

  if (typeof optionsOrRetries === 'number') {
    opts = {
      maxRetries: optionsOrRetries,
      delayMs: legacyDelayMs,
      context: legacyContext,
      backoffMultiplier: 1, // preserve fixed delay behavior for legacy callers
    };
  } else {
    opts = optionsOrRetries || {};
  }

  const maxRetries = opts.maxRetries ?? 2;
  const initialDelay = opts.delayMs ?? 1000;
  const backoffMultiplier = opts.backoffMultiplier ?? 1.5;
  const maxDelay = opts.maxDelayMs ?? 30000;
  const context = opts.context ?? 'operation';

  let currentDelay = initialDelay;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (rawErr) {
      lastError = normalizeError(rawErr);

      // Check if we should retry this specific error
      if (opts.shouldRetry && !opts.shouldRetry(lastError)) {
        logger.warn(`${context} failed with non-retryable error`, { error: lastError.message });
        throw lastError;
      }

      if (attempt < maxRetries) {
        if (opts.onRetry) {
          try {
            opts.onRetry(attempt + 1, lastError, currentDelay);
          } catch (_) {}
        }

        logger.warn(`${context} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${currentDelay}ms`, {
          error: lastError.message,
          attempt: attempt + 1,
          nextDelayMs: currentDelay,
        });

        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay = Math.min(Math.round(currentDelay * backoffMultiplier), maxDelay);
      } else {
        logger.error(`${context} failed after ${maxRetries + 1} attempts`, lastError, {
          attempts: attempt + 1,
        });
      }
    }
  }

  throw lastError ?? new Error(`${context} failed with unknown error`);
}

/**
 * Creates a reusable retryable wrapper around an existing function
 */
export function createRetryable<Args extends any[], Ret>(
  fn: (...args: Args) => Promise<Ret>,
  options: RetryOptions
): (...args: Args) => Promise<Ret> {
  return (...args: Args) => withRetry(() => fn(...args), options);
}
