/**
 * ConfigService - Global configuration management for internal data storage
 * 
 * Provides a simple API for storing and updating a single global configuration
 * with format {"route": "string", "value": number}. Features:
 * - File-based persistence with atomic writes
 * - Backup and recovery mechanisms
 * - Input validation
 * - Structured logging
 * 
 * Requirements: 1.1, 1.2, 4.1, 4.2, 4.3, 4.6
 */

import { Logger } from '../logger';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = new Logger('ConfigService');

/**
 * GlobalConfig interface representing the single configuration object
 * Requirements: 1.1
 */
export interface GlobalConfig {
  route: string;    // String route/path, max 256 characters
  value: number;    // Numeric value (not NaN, not Infinity)
}

/**
 * Result of a config update operation
 * Requirements: 3.4, 3.5
 */
export interface ConfigUpdateResult {
  success: boolean;
  config?: GlobalConfig;
  error?: string;
}

/**
 * Validation result for config fields
 * Requirements: 4.1, 4.2, 4.3, 4.6
 */
interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * ConfigService class for managing global configuration
 * 
 * Handles:
 * - Loading config from disk on startup
 * - In-memory config access
 * - Validated config updates with atomic writes
 * - Backup creation and recovery
 * - Error handling and logging
 */
export class ConfigService {
  private config: GlobalConfig;
  private readonly configFilePath: string;
  private readonly backupFilePath: string;
  private readonly tempFilePath: string;
  private readonly logger: Logger;

  /**
   * Create a new ConfigService instance
   * @param configDir - Directory path where config files will be stored
   */
  constructor(configDir: string) {
    this.configFilePath = path.join(configDir, 'global_config.json');
    this.backupFilePath = path.join(configDir, 'global_config.json.bak');
    this.tempFilePath = path.join(configDir, 'global_config.json.tmp');
    this.logger = logger.child('Config');

    // Initialize with default config (will be overwritten by loadConfig)
    this.config = this.getDefaultConfig();
  }

  /**
   * Get default config values
   * Requirements: 1.4
   */
  private getDefaultConfig(): GlobalConfig {
    return {
      route: '',
      value: 0
    };
  }

  /**
   * Load configuration from file
   * 
   * Attempts to load from main config file, then backup if main fails,
   * finally falls back to default values.
   * 
   * Requirements: 1.3, 1.4, 1.5, 9.5
   */
  async loadConfig(): Promise<void> {
    try {
      // Try loading from main config file
      const data = await fs.readFile(this.configFilePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Validate loaded config structure
      const validation = this.validateConfig(parsed.route, parsed.value);
      if (!validation.isValid) {
        this.logger.warn('Loaded config failed validation, attempting backup restore', {
          error: validation.error
        });
        const restored = await this.restoreFromBackup();
        if (restored) {
          this.config = restored;
          this.logger.info('Config restored from backup successfully');
          return;
        }
        // Fall through to default if backup restore fails
      } else {
        this.config = { route: parsed.route, value: parsed.value };
        this.logger.info('Config loaded successfully', { config: this.config });
        return;
      }
    } catch (error: any) {
      // File doesn't exist or JSON parse error
      if (error.code === 'ENOENT') {
        this.logger.info('Config file not found, creating default config');
      } else {
        this.logger.error('Failed to load config file', error, {
          filePath: this.configFilePath
        });

        // Try restoring from backup
        const restored = await this.restoreFromBackup();
        if (restored) {
          this.config = restored;
          this.logger.info('Config restored from backup after load failure');
          return;
        }
      }
    }

    // Use default config and create the file
    this.config = this.getDefaultConfig();
    this.logger.info('Using default config', { config: this.config });

    try {
      await this.saveConfigAtomic(this.config);
      this.logger.info('Default config file created');
    } catch (error: any) {
      this.logger.error('Failed to create default config file', error);
    }
  }

  /**
   * Get current configuration
   * Returns a copy to prevent external modification
   * Requirements: 2.1, 2.2
   */
  getConfig(): GlobalConfig {
    return { ...this.config };
  }

  /**
   * Update configuration with validation and persistence
   * 
   * @param route - New route value
   * @param value - New numeric value
   * @param userId - User ID for audit logging
   * @returns ConfigUpdateResult with success status
   * 
   * Requirements: 3.4, 8.1
   */
  async updateConfig(
    route: string,
    value: number,
    userId: string
  ): Promise<ConfigUpdateResult> {
    // Validate input
    const validation = this.validateConfig(route, value);
    if (!validation.isValid) {
      this.logger.warn('Config validation failed', {
        userId,
        error: validation.error,
        route: typeof route === 'string' ? route.substring(0, 50) : String(route), // Truncate for logging
        value
      });
      return {
        success: false,
        error: validation.error
      };
    }

    // Store old config for logging
    const oldConfig = { ...this.config };
    const newConfig: GlobalConfig = { route, value };

    try {
      // Persist to disk atomically
      await this.saveConfigAtomic(newConfig);

      // Update in-memory config only after successful persistence
      this.config = newConfig;

      // Log successful update
      this.logger.info('Config updated successfully', {
        userId,
        timestamp: new Date().toISOString(),
        oldRoute: oldConfig.route,
        oldValue: oldConfig.value,
        newRoute: newConfig.route,
        newValue: newConfig.value
      });

      return {
        success: true,
        config: { ...newConfig }
      };
    } catch (error: any) {
      this.logger.error('Failed to update config', error, {
        userId,
        operation: 'update_config'
      });

      return {
        success: false,
        error: 'Failed to save configuration'
      };
    }
  }

  /**
   * Validate configuration fields
   * 
   * Checks:
   * - route is a string with max length 256
   * - value is a valid number (not NaN, not Infinity)
   * - both fields are present
   * 
   * Requirements: 4.1, 4.2, 4.3, 4.6
   */
  private validateConfig(route: string, value: number): ValidationResult {
    // Check if both fields are present
    if (route === undefined || route === null) {
      return {
        isValid: false,
        error: 'Missing required field: route'
      };
    }

    if (value === undefined || value === null) {
      return {
        isValid: false,
        error: 'Missing required field: value'
      };
    }

    // Validate route type and length
    if (typeof route !== 'string') {
      return {
        isValid: false,
        error: 'Route must be a string'
      };
    }

    if (route.length > 256) {
      return {
        isValid: false,
        error: 'Route exceeds maximum length of 256 characters'
      };
    }

    // Validate value type
    if (typeof value !== 'number') {
      return {
        isValid: false,
        error: 'Value must be a number'
      };
    }

    // Validate value is not NaN or Infinity
    if (isNaN(value)) {
      return {
        isValid: false,
        error: 'Value cannot be NaN'
      };
    }

    if (!isFinite(value)) {
      return {
        isValid: false,
        error: 'Value cannot be Infinity'
      };
    }

    return { isValid: true };
  }

  /**
   * Save config to disk using atomic write operation
   * 
   * Process:
   * 1. Create backup of current file (if exists)
   * 2. Write new config to temporary file
   * 3. Atomically rename temp file to main file
   * 
   * This ensures the config file is never left in a corrupted state
   * 
   * Requirements: 9.1, 9.2, 9.3, 9.4
   */
  private async saveConfigAtomic(config: GlobalConfig): Promise<void> {
    try {
      // Step 1: Create backup of existing config (if it exists)
      try {
        await fs.access(this.configFilePath);
        await fs.copyFile(this.configFilePath, this.backupFilePath);
        this.logger.debug('Backup created', { backupPath: this.backupFilePath });
      } catch (error: any) {
        // File doesn't exist yet, no backup needed
        if (error.code !== 'ENOENT') {
          this.logger.warn('Failed to create backup', error);
        }
      }

      // Step 2: Write to temporary file
      const jsonData = JSON.stringify(config, null, 2);
      await fs.writeFile(this.tempFilePath, jsonData, 'utf-8');
      this.logger.debug('Temp file written', { tempPath: this.tempFilePath });

      // Step 3: Atomically rename temp file to main file
      await fs.rename(this.tempFilePath, this.configFilePath);
      this.logger.debug('Config file updated atomically');
    } catch (error: any) {
      this.logger.error('Atomic save failed', error, {
        operation: 'atomic_write',
        filePath: this.configFilePath
      });

      // Clean up temp file if it exists
      try {
        await fs.unlink(this.tempFilePath);
      } catch {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  /**
   * Restore configuration from backup file
   * 
   * Attempts to load and validate the backup file
   * Returns the restored config or null if restoration fails
   * 
   * Requirements: 9.5
   */
  private async restoreFromBackup(): Promise<GlobalConfig | null> {
    try {
      const data = await fs.readFile(this.backupFilePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Validate backup config
      const validation = this.validateConfig(parsed.route, parsed.value);
      if (!validation.isValid) {
        this.logger.error('Backup config validation failed', undefined, {
          error: validation.error
        });
        return null;
      }

      const restoredConfig: GlobalConfig = {
        route: parsed.route,
        value: parsed.value
      };

      // Restore backup to main file
      await fs.copyFile(this.backupFilePath, this.configFilePath);
      this.logger.info('Backup restored successfully');

      return restoredConfig;
    } catch (error: any) {
      this.logger.error('Failed to restore from backup', error, {
        backupPath: this.backupFilePath
      });
      return null;
    }
  }
}
