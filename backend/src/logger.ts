/**
 * Structured Logging System
 *
 * Provides centralized logging with:
 * - Multiple log levels (DEBUG, INFO, WARN, ERROR)
 * - Structured log formatting
 * - Context-based child loggers
 * - Metadata support
 * - Environment-based log level filtering
 * - Full stack trace preservation (fixes stack trace loss)
 * - Circular reference protection
 */

import { normalizeError, isAppError } from './errors';
import { errorMetrics } from './services/ErrorMetrics';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogMetadata {
  [key: string]: any;
}

/**
 * JSON.stringify replacement that handles circular references gracefully.
 * Circular nodes are replaced with the string "[Circular]" so that logging
 * never throws even when metadata contains browser/Playwright/Express objects.
 */
export function safeStringify(value: unknown, indent?: number): string {
  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      if (val instanceof Error) {
        return { message: val.message, stack: val.stack, name: val.name };
      }
      if (typeof val === 'function') return '[Function]';
      return val;
    }, indent);
  } catch {
    return '"[UnserializableObject]"';
  }
}

/**
 * Logger class for structured logging
 *
 * Format: [TIMESTAMP] [LEVEL] [CONTEXT] message
 *
 * Example usage:
 * ```typescript
 * const logger = new Logger('BotEngine');
 * logger.info('Bot started', { projectName: 'test' });
 * logger.error('Bot failed', new Error('Connection lost'), { nodeId: '123' });
 *
 * const childLogger = logger.child('NodeExecutor');
 * childLogger.debug('Executing node', { nodeId: '456' });
 * ```
 */
export class Logger {
  private context: string;
  private minLevel: LogLevel;

  /**
   * Creates a new Logger instance
   * @param context - The context string for this logger (e.g., 'BotEngine', 'WebSocket')
   */
  constructor(context: string = 'App') {
    this.context = context;
    this.minLevel = this.getMinLevelFromEnv();
  }

  /**
   * Get minimum log level from LOG_LEVEL environment variable
   * Defaults to INFO (1) if not set or invalid
   */
  private getMinLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL;

    if (envLevel === undefined || envLevel === '') {
      return LogLevel.INFO;
    }

    const level = parseInt(envLevel, 10);

    if (isNaN(level) || level < 0 || level > 3) {
      console.warn(`Invalid LOG_LEVEL value: ${envLevel}. Using INFO (1) as default.`);
      return LogLevel.INFO;
    }

    return level as LogLevel;
  }

  /**
   * Internal log method that formats and outputs log messages.
   * Prints stack traces directly on separate lines when present to preserve visibility.
   */
  private log(level: LogLevel, message: string, meta?: LogMetadata): void {
    if (level < this.minLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];

    // Format: [TIMESTAMP] [LEVEL] [CONTEXT] message
    let logMessage = `[${timestamp}] [${levelStr}] [${this.context}] ${message}`;

    // Extract stack if present to display as multi-line trace
    const stack = meta?.stack;
    const cleanMeta = meta ? { ...meta } : undefined;
    if (cleanMeta && 'stack' in cleanMeta) {
      delete cleanMeta.stack;
    }

    // Append metadata if provided — uses safeStringify to avoid circular-reference crashes
    if (cleanMeta && Object.keys(cleanMeta).length > 0) {
      logMessage += ` ${safeStringify(cleanMeta)}`;
    }

    // Output to appropriate stream with full preserved stack trace
    if (level >= LogLevel.ERROR) {
      if (stack) {
        console.error(`${logMessage}\n${stack}`);
      } else {
        console.error(logMessage);
      }
    } else if (level >= LogLevel.WARN) {
      if (stack) {
        console.warn(`${logMessage}\n${stack}`);
      } else {
        console.warn(logMessage);
      }
    } else {
      console.log(logMessage);
    }
  }

  /**
   * Log a DEBUG level message
   */
  debug(message: string, meta?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  /**
   * Log an INFO level message
   */
  info(message: string, meta?: LogMetadata): void {
    this.log(LogLevel.INFO, message, meta);
  }

  /**
   * Log a WARN level message.
   * If errorOrMeta is an Error or object containing an error, preserves full stack trace.
   */
  warn(message: string, errorOrMeta?: unknown, meta?: LogMetadata): void {
    let finalMeta: LogMetadata | undefined;

    if (errorOrMeta !== undefined && errorOrMeta !== null) {
      if (errorOrMeta instanceof Error || (typeof errorOrMeta === 'object' && ('message' in errorOrMeta || 'stack' in errorOrMeta))) {
        const normalized = normalizeError(errorOrMeta);
        finalMeta = { ...meta, error: normalized.message, stack: normalized.stack };
      } else if (typeof errorOrMeta === 'object') {
        finalMeta = { ...(errorOrMeta as LogMetadata) };
        if (finalMeta.error && finalMeta.error instanceof Error) {
          finalMeta.stack = finalMeta.error.stack;
          finalMeta.error = finalMeta.error.message;
        }
      } else {
        finalMeta = { ...meta, error: String(errorOrMeta) };
      }
    } else if (meta) {
      finalMeta = { ...meta };
    }

    this.log(LogLevel.WARN, message, finalMeta);
    try {
      errorMetrics.recordWarning(this.context, message);
    } catch (_) {}
  }

  /**
   * Log an ERROR level message.
   * Accepts unknown error and normalizes it to preserve stack trace completely.
   *
   * @param message - The log message
   * @param error - Optional Error object or unknown caught value
   * @param meta - Optional metadata object
   */
  error(message: string, error?: unknown, meta?: LogMetadata): void {
    const errorMeta: LogMetadata = { ...meta };

    if (error !== undefined && error !== null) {
      const normalized = normalizeError(error);
      errorMeta.error = normalized.message;
      errorMeta.stack = normalized.stack;

      if (isAppError(normalized)) {
        errorMeta.code = normalized.code;
        errorMeta.statusCode = normalized.statusCode;
        if (normalized.context) {
          errorMeta.errorContext = normalized.context;
        }
      }
    }

    this.log(LogLevel.ERROR, message, errorMeta);

    try {
      errorMetrics.recordError(this.context, error || message, errorMeta);
    } catch (_) {}
  }

  /**
   * Create a child logger with additional context
   * @param childContext - Additional context to append to current context
   * @returns A new Logger instance with combined context
   */
  child(childContext: string): Logger {
    const combinedContext = `${this.context}:${childContext}`;
    return new Logger(combinedContext);
  }

  getContext(): string {
    return this.context;
  }

  getMinLevel(): LogLevel {
    return this.minLevel;
  }

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

/**
 * Create a default logger instance for general use
 */
export const defaultLogger = new Logger('App');

/**
 * Helper function to create a logger with a specific context
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}
