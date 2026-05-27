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
    // Filter based on minimum log level
    if (level < this.minLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];
    
    // Format: [TIMESTAMP] [LEVEL] [CONTEXT] message
    let logMessage = `[${timestamp}] [${levelStr}] [${this.context}] ${message}`;

    // Append metadata if provided
    if (meta && Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
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
   * @param message - The log message
   * @param meta - Optional metadata object
   */
  debug(message: string, meta?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  /**
   * Log an INFO level message
   * @param message - The log message
   * @param meta - Optional metadata object
   */
  info(message: string, meta?: LogMetadata): void {
    this.log(LogLevel.INFO, message, meta);
  }

  /**
   * Log a WARN level message
   * @param message - The log message
   * @param meta - Optional metadata object
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

  /**
   * Get the current context string
   */
  getContext(): string {
    return this.context;
  }

  /**
   * Get the current minimum log level
   */
  getMinLevel(): LogLevel {
    return this.minLevel;
  }

  /**
   * Set a new minimum log level (useful for testing or runtime changes)
   * @param level - The new minimum log level
   */
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
 * @param context - The context string for the logger
 * @returns A new Logger instance
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}
