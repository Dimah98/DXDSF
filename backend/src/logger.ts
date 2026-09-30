/**
 * Structured Logging System
 *
 * Provides centralized logging with:
 * - Multiple log levels (DEBUG, INFO, WARN, ERROR)
 * - Structured log formatting
 * - Context-based child loggers
 * - Metadata support
 * - Environment-based log level filtering
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogMetadata {
  [key: string]: any;
}

/**
 * JSON.stringify replacement that handles circular references gracefully.
 * Circular nodes are replaced with the string "[Circular]" so that logging
 * never throws even when metadata contains browser/Playwright/Express objects.
 *
 * Fix for issue #4: "Циклічні посилання ламають логування"
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
        return { message: val.message, stack: val.stack };
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
   * Internal log method that formats and outputs log messages
   */
  private log(level: LogLevel, message: string, meta?: LogMetadata): void {
    if (level < this.minLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];

    // Format: [TIMESTAMP] [LEVEL] [CONTEXT] message
    let logMessage = `[${timestamp}] [${levelStr}] [${this.context}] ${message}`;

    // Append metadata if provided — uses safeStringify to avoid circular-reference crashes
    if (meta && Object.keys(meta).length > 0) {
      logMessage += ` ${safeStringify(meta)}`;
    }

    // Output to appropriate stream
    if (level >= LogLevel.ERROR) {
      console.error(logMessage);
    } else if (level >= LogLevel.WARN) {
      console.warn(logMessage);
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
   * Log a WARN level message
   */
  warn(message: string, meta?: LogMetadata): void {
    this.log(LogLevel.WARN, message, meta);
  }

  /**
   * Log an ERROR level message
   * @param message - The log message
   * @param error - Optional Error object (will extract message and stack trace)
   * @param meta - Optional metadata object
   */
  error(message: string, error?: Error, meta?: LogMetadata): void {
    const errorMeta: LogMetadata = { ...meta };

    if (error) {
      errorMeta.error = error.message;
      errorMeta.stack = error.stack;
    }

    this.log(LogLevel.ERROR, message, errorMeta);
  }

  /**
   * Create a child logger with additional context
   * @param childContext - Additional context to append to current context
   * @returns A new Logger instance with combined context
   *
   * Example:
   * ```typescript
   * const parentLogger = new Logger('BotEngine');
   * const childLogger = parentLogger.child('NodeExecutor');
   * // childLogger context will be 'BotEngine:NodeExecutor'
   * ```
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
