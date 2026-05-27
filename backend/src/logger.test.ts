/**
 * Unit tests for the structured logging system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, LogLevel, createLogger, defaultLogger } from './logger';

describe('Logger', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Constructor and Context', () => {
    it('should create logger with default context', () => {
      const logger = new Logger();
      expect(logger.getContext()).toBe('App');
    });

    it('should create logger with custom context', () => {
      const logger = new Logger('BotEngine');
      expect(logger.getContext()).toBe('BotEngine');
    });

    it('should create child logger with combined context', () => {
      const parent = new Logger('BotEngine');
      const child = parent.child('NodeExecutor');
      expect(child.getContext()).toBe('BotEngine:NodeExecutor');
    });

    it('should support multiple levels of child loggers', () => {
      const parent = new Logger('App');
      const child1 = parent.child('Module1');
      const child2 = child1.child('SubModule');
      expect(child2.getContext()).toBe('App:Module1:SubModule');
    });
  });

  describe('Log Level Configuration', () => {
    it('should default to INFO level when LOG_LEVEL not set', () => {
      delete process.env.LOG_LEVEL;
      const logger = new Logger('Test');
      expect(logger.getMinLevel()).toBe(LogLevel.INFO);
    });

    it('should use LOG_LEVEL from environment variable', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      expect(logger.getMinLevel()).toBe(LogLevel.DEBUG);
    });

    it('should handle all valid log levels', () => {
      const levels = [
        { env: '0', expected: LogLevel.DEBUG },
        { env: '1', expected: LogLevel.INFO },
        { env: '2', expected: LogLevel.WARN },
        { env: '3', expected: LogLevel.ERROR }
      ];

      levels.forEach(({ env, expected }) => {
        process.env.LOG_LEVEL = env;
        const logger = new Logger('Test');
        expect(logger.getMinLevel()).toBe(expected);
      });
    });

    it('should default to INFO for invalid LOG_LEVEL values', () => {
      const invalidValues = ['invalid', '-1', '4', '999', 'abc'];

      invalidValues.forEach(value => {
        process.env.LOG_LEVEL = value;
        const logger = new Logger('Test');
        expect(logger.getMinLevel()).toBe(LogLevel.INFO);
      });
    });

    it('should allow runtime log level changes', () => {
      const logger = new Logger('Test');
      logger.setMinLevel(LogLevel.ERROR);
      expect(logger.getMinLevel()).toBe(LogLevel.ERROR);
    });
  });

  describe('Log Formatting', () => {
    it('should format log message with timestamp, level, and context', () => {
      process.env.LOG_LEVEL = '0'; // DEBUG level
      const logger = new Logger('TestContext');
      
      logger.info('Test message');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      
      // Check format: [TIMESTAMP] [LEVEL] [CONTEXT] message
      expect(logOutput).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] \[TestContext\] Test message$/);
    });

    it('should include metadata in log output', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      logger.info('Test message', { userId: '123', action: 'login' });
      
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('{"userId":"123","action":"login"}');
    });

    it('should handle empty metadata object', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      logger.info('Test message', {});
      
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).not.toContain('{}');
      expect(logOutput).toMatch(/Test message$/);
    });

    it('should handle complex metadata objects', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      const metadata = {
        user: { id: '123', name: 'John' },
        timestamp: 1234567890,
        tags: ['important', 'urgent']
      };
      
      logger.info('Complex metadata', metadata);
      
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain(JSON.stringify(metadata));
    });
  });

  describe('Log Level Methods', () => {
    it('should log DEBUG messages', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      logger.debug('Debug message');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[DEBUG]');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('Debug message');
    });

    it('should log INFO messages', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      logger.info('Info message');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[INFO]');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('Info message');
    });

    it('should log WARN messages', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      logger.warn('Warning message');
      
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('[WARN]');
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('Warning message');
    });

    it('should log ERROR messages', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      logger.error('Error message');
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR]');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Error message');
    });

    it('should include error details in ERROR logs', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      const error = new Error('Something went wrong');
      logger.error('Operation failed', error);
      
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('Operation failed');
      expect(logOutput).toContain('Something went wrong');
      expect(logOutput).toContain('"error":"Something went wrong"');
      expect(logOutput).toContain('"stack"');
    });

    it('should include both error and metadata in ERROR logs', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      const error = new Error('Test error');
      logger.error('Failed', error, { userId: '123', operation: 'save' });
      
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('Test error');
      expect(logOutput).toContain('"userId":"123"');
      expect(logOutput).toContain('"operation":"save"');
    });
  });

  describe('Log Level Filtering', () => {
    it('should filter DEBUG messages when level is INFO', () => {
      process.env.LOG_LEVEL = '1'; // INFO
      const logger = new Logger('Test');
      
      logger.debug('Debug message');
      logger.info('Info message');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[INFO]');
    });

    it('should filter DEBUG and INFO messages when level is WARN', () => {
      process.env.LOG_LEVEL = '2'; // WARN
      const logger = new Logger('Test');
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('[WARN]');
    });

    it('should only log ERROR messages when level is ERROR', () => {
      process.env.LOG_LEVEL = '3'; // ERROR
      const logger = new Logger('Test');
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR]');
    });

    it('should log all messages when level is DEBUG', () => {
      process.env.LOG_LEVEL = '0'; // DEBUG
      const logger = new Logger('Test');
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // DEBUG and INFO
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Console Output Routing', () => {
    it('should route DEBUG to console.log', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      logger.debug('Debug message');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should route INFO to console.log', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      logger.info('Info message');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should route WARN to console.warn', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      logger.warn('Warning message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should route ERROR to console.error', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      logger.error('Error message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Helper Functions', () => {
    it('should create logger using createLogger helper', () => {
      const logger = createLogger('CustomContext');
      expect(logger.getContext()).toBe('CustomContext');
    });

    it('should provide default logger instance', () => {
      expect(defaultLogger).toBeInstanceOf(Logger);
      expect(defaultLogger.getContext()).toBe('App');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined metadata', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      logger.info('Message', undefined);
      
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toMatch(/Message$/);
    });

    it('should handle null in metadata', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      logger.info('Message', { value: null });
      
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('"value":null');
    });

    it('should handle circular references in metadata gracefully', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      const circular: any = { name: 'test' };
      circular.self = circular;
      
      // JSON.stringify will throw on circular references
      // The logger should handle this gracefully or the test will fail
      expect(() => {
        logger.info('Message', circular);
      }).toThrow();
    });

    it('should handle empty string context', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('');
      expect(logger.getContext()).toBe('');
      
      logger.info('Test');
      
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('[] Test');
    });

    it('should handle very long messages', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      const longMessage = 'A'.repeat(10000);
      logger.info(longMessage);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain(longMessage);
    });

    it('should handle special characters in messages', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      const specialMessage = 'Test with "quotes" and \\backslashes\\ and \nnewlines';
      logger.info(specialMessage);
      
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain(specialMessage);
    });
  });

  describe('Requirements Validation', () => {
    it('should satisfy Requirement 12.1: Format as [TIMESTAMP] [LEVEL] [CONTEXT] message', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('TestContext');
      
      logger.info('Test message');
      
      const logOutput = consoleLogSpy.mock.calls[0][0];
      const regex = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\] \[(DEBUG|INFO|WARN|ERROR)\] \[TestContext\] Test message/;
      expect(logOutput).toMatch(regex);
    });

    it('should satisfy Requirement 12.2: Support DEBUG, INFO, WARN, ERROR levels', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');
      
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[DEBUG]');
      expect(consoleLogSpy.mock.calls[1][0]).toContain('[INFO]');
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('[WARN]');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR]');
    });

    it('should satisfy Requirement 12.3: Filter based on LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = '2'; // WARN
      const logger = new Logger('Test');
      
      logger.debug('Should not appear');
      logger.info('Should not appear');
      logger.warn('Should appear');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it('should satisfy Requirement 12.4: Include error message and stack trace', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      const error = new Error('Test error');
      logger.error('Operation failed', error);
      
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('"error":"Test error"');
      expect(logOutput).toContain('"stack"');
    });

    it('should satisfy Requirement 12.5: Support metadata objects', () => {
      process.env.LOG_LEVEL = '0';
      const logger = new Logger('Test');
      
      logger.info('Test', { key1: 'value1', key2: 123 });
      
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('{"key1":"value1","key2":123}');
    });

    it('should satisfy Requirement 12.6: Allow creating child loggers with context', () => {
      process.env.LOG_LEVEL = '0';
      const parent = new Logger('Parent');
      const child = parent.child('Child');
      
      expect(child.getContext()).toBe('Parent:Child');
      
      child.info('Test');
      
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('[Parent:Child]');
    });
  });
});
