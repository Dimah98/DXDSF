/**
 * Unit tests for ConfigManager
 * 
 * Tests configuration loading, validation, and type safety
 * 
 * Note: These tests assume JWT_SECRET and ENCRYPTION_KEY are set in .env
 * If running tests fails, ensure these are set:
 * - JWT_SECRET (min 32 characters)
 * - ENCRYPTION_KEY (min 32 characters)
 */

import { describe, it, expect } from 'vitest';
import { config, LogLevel } from './ConfigManager';

describe('ConfigManager', () => {
  describe('Configuration Loading', () => {
    it('should load configuration with valid values', () => {
      const cfg = config.getConfig();

      // Check that config is loaded
      expect(cfg).toBeDefined();
      expect(cfg.HTTP_PORT).toBeDefined();
      expect(cfg.JWT_SECRET).toBeDefined();
      expect(cfg.ENCRYPTION_KEY).toBeDefined();
    });

    it('should have default values for optional parameters', () => {
      const cfg = config.getConfig();

      // These should have defaults even if not in .env
      expect(cfg.BOT_SAFETY_LIMIT).toBe(1000);
      expect(cfg.STREAM_QUALITY).toBe(50);
      expect(cfg.STREAM_DELAY).toBe(200);
      expect(cfg.MAX_PARALLEL_BROWSERS).toBe(5);
      expect(cfg.SESSION_CLEANUP_INTERVAL).toBe(3600000);
      expect(cfg.REQUEST_TIMEOUT).toBe(30000);
    });

    it('should provide type-safe get method', () => {
      const port: number = config.get('HTTP_PORT');
      const secret: string = config.get('JWT_SECRET');
      const limit: number = config.get('BOT_SAFETY_LIMIT');

      expect(typeof port).toBe('number');
      expect(typeof secret).toBe('string');
      expect(typeof limit).toBe('number');
    });

    it('should return frozen config object', () => {
      const cfg = config.getConfig();

      expect(() => {
        (cfg as any).HTTP_PORT = 9999;
      }).toThrow();
    });

    it('should have ALLOWED_ORIGINS as array', () => {
      const origins = config.get('ALLOWED_ORIGINS');
      expect(Array.isArray(origins)).toBe(true);
      expect(origins.length).toBeGreaterThan(0);
    });
  });

  describe('Validation', () => {
    it('should have valid JWT_SECRET', () => {
      const secret = config.get('JWT_SECRET');
      expect(secret).toBeDefined();
      expect(secret.length).toBeGreaterThanOrEqual(32);
    });

    it('should have valid ENCRYPTION_KEY', () => {
      const key = config.get('ENCRYPTION_KEY');
      expect(key).toBeDefined();
      expect(key.length).toBeGreaterThanOrEqual(32);
    });

    it('should have valid HTTP_PORT', () => {
      const port = config.get('HTTP_PORT');
      expect(port).toBeGreaterThanOrEqual(1);
      expect(port).toBeLessThanOrEqual(65535);
    });

    it('should have valid MAX_PARALLEL_BROWSERS', () => {
      const max = config.get('MAX_PARALLEL_BROWSERS');
      expect(max).toBeGreaterThanOrEqual(1);
    });

    it('should have valid STREAM_QUALITY', () => {
      const quality = config.get('STREAM_QUALITY');
      expect(quality).toBeGreaterThanOrEqual(1);
      expect(quality).toBeLessThanOrEqual(100);
    });

    it('should have valid STREAM_DELAY', () => {
      const delay = config.get('STREAM_DELAY');
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it('should have valid BOT_SAFETY_LIMIT', () => {
      const limit = config.get('BOT_SAFETY_LIMIT');
      expect(limit).toBeGreaterThanOrEqual(1);
      expect(limit).toBeLessThanOrEqual(100000);
    });

    it('should have valid SCREENSHOT_TIMEOUT', () => {
      const timeout = config.get('SCREENSHOT_TIMEOUT');
      expect(timeout).toBeGreaterThanOrEqual(1000);
      expect(timeout).toBeLessThanOrEqual(60000);
    });

    it('should have valid LOG_LEVEL', () => {
      const level = config.get('LOG_LEVEL');
      expect(level).toBeGreaterThanOrEqual(LogLevel.DEBUG);
      expect(level).toBeLessThanOrEqual(LogLevel.ERROR);
    });
  });

  describe('Type Safety', () => {
    it('should provide correct types for all config values', () => {
      const cfg = config.getConfig();

      // Server Configuration
      expect(typeof cfg.HTTP_PORT).toBe('number');
      expect(typeof cfg.JWT_SECRET).toBe('string');
      expect(typeof cfg.ENCRYPTION_KEY).toBe('string');
      expect(Array.isArray(cfg.ALLOWED_ORIGINS)).toBe(true);

      // Bot Engine Configuration
      expect(typeof cfg.BOT_SAFETY_LIMIT).toBe('number');
      expect(typeof cfg.SCREENSHOT_TIMEOUT).toBe('number');

      // Streaming Configuration
      expect(typeof cfg.STREAM_QUALITY).toBe('number');
      expect(typeof cfg.STREAM_DELAY).toBe('number');

      // Resource Management
      expect(typeof cfg.MAX_PARALLEL_BROWSERS).toBe('number');
      expect(typeof cfg.SESSION_CLEANUP_INTERVAL).toBe('number');

      // Logging
      expect(typeof cfg.LOG_LEVEL).toBe('number');

      // Request Configuration
      expect(typeof cfg.REQUEST_TIMEOUT).toBe('number');

      // IT Browser Configuration
      expect(typeof cfg.ITBROWSER_EXE).toBe('string');
      expect(typeof cfg.ITBROWSER_USER_DATA).toBe('string');
      expect(typeof cfg.ITBROWSER_PROFILE_DIR).toBe('string');
    });

    it('should allow accessing config values by key', () => {
      const port = config.get('HTTP_PORT');
      const secret = config.get('JWT_SECRET');
      const limit = config.get('BOT_SAFETY_LIMIT');

      expect(port).toBeDefined();
      expect(secret).toBeDefined();
      expect(limit).toBeDefined();
    });
  });

  describe('Configuration Immutability', () => {
    it('should not allow modification of config object', () => {
      const cfg = config.getConfig();

      expect(() => {
        (cfg as any).HTTP_PORT = 9999;
      }).toThrow();

      expect(() => {
        (cfg as any).NEW_PROPERTY = 'test';
      }).toThrow();
    });

    it('should return a new frozen object on each call', () => {
      const cfg1 = config.getConfig();
      const cfg2 = config.getConfig();

      // Should be different objects
      expect(cfg1).not.toBe(cfg2);

      // But with same values
      expect(cfg1.HTTP_PORT).toBe(cfg2.HTTP_PORT);
      expect(cfg1.JWT_SECRET).toBe(cfg2.JWT_SECRET);
    });
  });
});
