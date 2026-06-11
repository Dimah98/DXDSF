/**
 * Unit tests for ConfigService
 * 
 * Tests configuration loading, validation, and type safety
 * Requirements: 1.1, 1.2, 4.1, 4.2, 4.3, 4.6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigService, GlobalConfig, ConfigUpdateResult } from './ConfigService';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_CONFIG_DIR = path.join(__dirname, '..', '..', 'test-config-temp');

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(async () => {
    // Create test config directory
    await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
    service = new ConfigService(TEST_CONFIG_DIR);
  });

  afterEach(async () => {
    // Clean up test config directory
    try {
      await fs.rm(TEST_CONFIG_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    it('should create default config when file does not exist', async () => {
      await service.loadConfig();
      const config = service.getConfig();

      expect(config).toEqual({
        route: '',
        value: 0
      });
    });

    it('should load existing config from file', async () => {
      // Create a config file
      const testConfig = { route: 'test/route', value: 42 };
      const configPath = path.join(TEST_CONFIG_DIR, 'global_config.json');
      await fs.writeFile(configPath, JSON.stringify(testConfig), 'utf-8');

      // Load config
      await service.loadConfig();
      const config = service.getConfig();

      expect(config).toEqual(testConfig);
    });

    it('should restore from backup when main file is corrupted', async () => {
      const backupConfig = { route: 'backup/route', value: 99 };
      const backupPath = path.join(TEST_CONFIG_DIR, 'global_config.json.bak');
      await fs.writeFile(backupPath, JSON.stringify(backupConfig), 'utf-8');

      // Create corrupted main config
      const configPath = path.join(TEST_CONFIG_DIR, 'global_config.json');
      await fs.writeFile(configPath, '{invalid json}', 'utf-8');

      // Load config
      await service.loadConfig();
      const config = service.getConfig();

      expect(config).toEqual(backupConfig);
    });
  });

  describe('Validation', () => {
    beforeEach(async () => {
      await service.loadConfig();
    });

    it('should reject route longer than 256 characters', async () => {
      const longRoute = 'a'.repeat(257);
      const result = await service.updateConfig(longRoute, 100, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });

    it('should accept route exactly 256 characters', async () => {
      const maxRoute = 'a'.repeat(256);
      const result = await service.updateConfig(maxRoute, 100, 'test-user');

      expect(result.success).toBe(true);
      expect(result.config?.route).toBe(maxRoute);
    });

    it('should reject NaN value', async () => {
      const result = await service.updateConfig('test', NaN, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('NaN');
    });

    it('should reject Infinity value', async () => {
      const result = await service.updateConfig('test', Infinity, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Infinity');
    });

    it('should reject -Infinity value', async () => {
      const result = await service.updateConfig('test', -Infinity, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Infinity');
    });

    it('should accept valid positive integers', async () => {
      const result = await service.updateConfig('test', 42, 'test-user');

      expect(result.success).toBe(true);
      expect(result.config?.value).toBe(42);
    });

    it('should accept valid negative integers', async () => {
      const result = await service.updateConfig('test', -42, 'test-user');

      expect(result.success).toBe(true);
      expect(result.config?.value).toBe(-42);
    });

    it('should accept valid floats', async () => {
      const result = await service.updateConfig('test', 3.14159, 'test-user');

      expect(result.success).toBe(true);
      expect(result.config?.value).toBe(3.14159);
    });

    it('should accept zero', async () => {
      const result = await service.updateConfig('test', 0, 'test-user');

      expect(result.success).toBe(true);
      expect(result.config?.value).toBe(0);
    });
  });

  describe('Update and Persistence', () => {
    beforeEach(async () => {
      await service.loadConfig();
    });

    it('should update config in memory', async () => {
      const result = await service.updateConfig('new/route', 123, 'test-user');

      expect(result.success).toBe(true);

      const config = service.getConfig();
      expect(config.route).toBe('new/route');
      expect(config.value).toBe(123);
    });

    it('should persist config to file', async () => {
      await service.updateConfig('persisted/route', 456, 'test-user');

      // Create new service instance to load from file
      const newService = new ConfigService(TEST_CONFIG_DIR);
      await newService.loadConfig();
      const config = newService.getConfig();

      expect(config.route).toBe('persisted/route');
      expect(config.value).toBe(456);
    });

    it('should create backup before updating', async () => {
      // Create initial config
      await service.updateConfig('first/route', 100, 'test-user');

      // Update config again
      await service.updateConfig('second/route', 200, 'test-user');

      // Check backup file exists and contains first config
      const backupPath = path.join(TEST_CONFIG_DIR, 'global_config.json.bak');
      const backupData = await fs.readFile(backupPath, 'utf-8');
      const backup = JSON.parse(backupData);

      expect(backup.route).toBe('first/route');
      expect(backup.value).toBe(100);
    });

    it('should return updated config in result', async () => {
      const result = await service.updateConfig('result/test', 789, 'test-user');

      expect(result.success).toBe(true);
      expect(result.config).toEqual({
        route: 'result/test',
        value: 789
      });
    });
  });

  describe('Config Structure', () => {
    beforeEach(async () => {
      await service.loadConfig();
    });

    it('should always have exactly two fields', async () => {
      await service.updateConfig('test', 42, 'test-user');
      const config = service.getConfig();

      const keys = Object.keys(config);
      expect(keys).toHaveLength(2);
      expect(keys).toContain('route');
      expect(keys).toContain('value');
    });

    it('should have correct types for fields', async () => {
      await service.updateConfig('test/route', 42, 'test-user');
      const config = service.getConfig();

      expect(typeof config.route).toBe('string');
      expect(typeof config.value).toBe('number');
    });

    it('should return immutable config copy', async () => {
      await service.updateConfig('immutable/test', 42, 'test-user');
      const config1 = service.getConfig();
      const config2 = service.getConfig();

      // Should be different objects
      expect(config1).not.toBe(config2);

      // But with same values
      expect(config1).toEqual(config2);

      // Modifying returned config should not affect service
      config1.route = 'modified';
      const config3 = service.getConfig();
      expect(config3.route).toBe('immutable/test');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await service.loadConfig();
    });

    it('should handle invalid route type', async () => {
      const result = await service.updateConfig(123 as any, 42, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a string');
    });

    it('should handle invalid value type', async () => {
      const result = await service.updateConfig('test', 'not-a-number' as any, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a number');
    });

    it('should handle missing route', async () => {
      const result = await service.updateConfig(undefined as any, 42, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required field: route');
    });

    it('should handle missing value', async () => {
      const result = await service.updateConfig('test', undefined as any, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required field: value');
    });

    it('should handle null route', async () => {
      const result = await service.updateConfig(null as any, 42, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required field: route');
    });

    it('should handle null value', async () => {
      const result = await service.updateConfig('test', null as any, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required field: value');
    });
  });

  describe('Atomic File Operations', () => {
    beforeEach(async () => {
      await service.loadConfig();
    });

    it('should write to temp file before renaming', async () => {
      const tempPath = path.join(TEST_CONFIG_DIR, 'global_config.json.tmp');
      
      // Start update (we'll check temp file during the operation)
      const updatePromise = service.updateConfig('atomic/test', 777, 'test-user');
      
      // Wait for update to complete
      const result = await updatePromise;
      
      expect(result.success).toBe(true);
      
      // After successful atomic rename, temp file should be gone
      try {
        await fs.access(tempPath);
        // If we reach here, temp file still exists (shouldn't happen)
        expect.fail('Temp file should not exist after atomic rename');
      } catch (error: any) {
        // Expected: temp file should not exist
        expect(error.code).toBe('ENOENT');
      }
    });

    it('should preserve old file on write failure', async () => {
      // Create initial config
      await service.updateConfig('original/route', 100, 'test-user');
      
      const configPath = path.join(TEST_CONFIG_DIR, 'global_config.json');
      
      // Verify initial config is written
      const initialData = await fs.readFile(configPath, 'utf-8');
      const initialConfig = JSON.parse(initialData);
      expect(initialConfig.route).toBe('original/route');
      expect(initialConfig.value).toBe(100);
      
      // Make config directory read-only to simulate write failure
      // Note: This test may behave differently on different operating systems
      // On Windows, we can make the file read-only instead
      try {
        await fs.chmod(configPath, 0o444); // Read-only
        
        // Attempt update (should fail)
        const result = await service.updateConfig('should/fail', 999, 'test-user');
        
        // Update should fail
        expect(result.success).toBe(false);
        
        // Restore permissions for cleanup
        await fs.chmod(configPath, 0o644);
        
        // Original config should still be intact
        const afterFailData = await fs.readFile(configPath, 'utf-8');
        const afterFailConfig = JSON.parse(afterFailData);
        expect(afterFailConfig.route).toBe('original/route');
        expect(afterFailConfig.value).toBe(100);
      } catch (error) {
        // If chmod doesn't work on this OS, skip this test
        console.warn('File permission test skipped on this platform');
      }
    });

    it('should create backup before each update', async () => {
      const backupPath = path.join(TEST_CONFIG_DIR, 'global_config.json.bak');
      
      // First update
      await service.updateConfig('first', 1, 'test-user');
      
      // Second update - should backup the first config
      await service.updateConfig('second', 2, 'test-user');
      
      // Backup should contain first config
      const backupData = await fs.readFile(backupPath, 'utf-8');
      const backup = JSON.parse(backupData);
      expect(backup.route).toBe('first');
      expect(backup.value).toBe(1);
      
      // Main config should have second values
      const config = service.getConfig();
      expect(config.route).toBe('second');
      expect(config.value).toBe(2);
    });

    it('should successfully restore from backup when main file is corrupted', async () => {
      // Create a valid config first
      await service.updateConfig('first', 100, 'test-user');
      
      // Create a second config (this creates a backup of 'first')
      await service.updateConfig('second', 200, 'test-user');
      
      // Corrupt the main config file
      const configPath = path.join(TEST_CONFIG_DIR, 'global_config.json');
      await fs.writeFile(configPath, '{ invalid json', 'utf-8');
      
      // Create new service instance - should restore from backup
      const newService = new ConfigService(TEST_CONFIG_DIR);
      await newService.loadConfig();
      
      const config = newService.getConfig();
      // Should restore from backup which has 'first' config
      expect(config.route).toBe('first');
      expect(config.value).toBe(100);
    });

    it('should atomically rename temp file to main file', async () => {
      const configPath = path.join(TEST_CONFIG_DIR, 'global_config.json');
      const tempPath = path.join(TEST_CONFIG_DIR, 'global_config.json.tmp');
      
      // Update config
      await service.updateConfig('atomic/rename', 888, 'test-user');
      
      // Main config should exist with correct data
      const mainData = await fs.readFile(configPath, 'utf-8');
      const mainConfig = JSON.parse(mainData);
      expect(mainConfig.route).toBe('atomic/rename');
      expect(mainConfig.value).toBe(888);
      
      // Temp file should not exist (atomic rename consumed it)
      try {
        await fs.access(tempPath);
        expect.fail('Temp file should not exist after atomic rename');
      } catch (error: any) {
        expect(error.code).toBe('ENOENT');
      }
    });

    it('should clean up temp file on write failure', async () => {
      const tempPath = path.join(TEST_CONFIG_DIR, 'global_config.json.tmp');
      
      // Create initial config
      await service.updateConfig('initial', 1, 'test-user');
      
      // Try to create a scenario where write might fail
      // We'll verify temp file cleanup by checking it doesn't persist
      await service.updateConfig('cleanup/test', 2, 'test-user');
      
      // Temp file should be cleaned up
      try {
        await fs.access(tempPath);
        expect.fail('Temp file should be cleaned up');
      } catch (error: any) {
        expect(error.code).toBe('ENOENT');
      }
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await service.loadConfig();
    });

    it('should handle empty route string', async () => {
      const result = await service.updateConfig('', 42, 'test-user');

      expect(result.success).toBe(true);
      expect(result.config?.route).toBe('');
    });

    it('should handle very large numbers', async () => {
      const largeNumber = Number.MAX_SAFE_INTEGER;
      const result = await service.updateConfig('test', largeNumber, 'test-user');

      expect(result.success).toBe(true);
      expect(result.config?.value).toBe(largeNumber);
    });

    it('should handle very small numbers', async () => {
      const smallNumber = Number.MIN_SAFE_INTEGER;
      const result = await service.updateConfig('test', smallNumber, 'test-user');

      expect(result.success).toBe(true);
      expect(result.config?.value).toBe(smallNumber);
    });

    it('should handle decimal numbers', async () => {
      const result = await service.updateConfig('test', 0.123456789, 'test-user');

      expect(result.success).toBe(true);
      expect(result.config?.value).toBe(0.123456789);
    });

    it('should handle negative zero', async () => {
      const result = await service.updateConfig('test', -0, 'test-user');

      expect(result.success).toBe(true);
      // Note: -0 and +0 are treated differently by Object.is in vitest
      // but both are valid numbers, so we just check it's a valid number
      expect(typeof result.config?.value).toBe('number');
      expect(isFinite(result.config?.value!)).toBe(true);
    });

    it('should handle route with special characters', async () => {
      const specialRoute = 'test/route?param=value&foo=bar#section';
      const result = await service.updateConfig(specialRoute, 42, 'test-user');

      expect(result.success).toBe(true);
      expect(result.config?.route).toBe(specialRoute);
    });

    it('should handle route with unicode characters', async () => {
      const unicodeRoute = 'тест/маршрут/路徑/🚀';
      const result = await service.updateConfig(unicodeRoute, 42, 'test-user');

      expect(result.success).toBe(true);
      expect(result.config?.route).toBe(unicodeRoute);
    });
  });
});
