/**
 * ConfigManager - Centralized configuration management system
 * 
 * Provides type-safe access to all configuration parameters with:
 * - Environment variable validation at startup
 * - Default values for optional parameters
 * - Type checking and range validation
 * 
 * Requirements: 16, 30, 35
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface AppConfig {
  // Server Configuration
  HTTP_PORT: number;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  ALLOWED_ORIGINS: string[];
  
  // Bot Engine Configuration
  BOT_SAFETY_LIMIT: number;
  SCREENSHOT_TIMEOUT: number;
  
  // Streaming Configuration
  STREAM_QUALITY: number;
  STREAM_DELAY: number;
  
  // Resource Management
  MAX_PARALLEL_BROWSERS: number;
  SESSION_CLEANUP_INTERVAL: number;
  
  // Logging
  LOG_LEVEL: LogLevel;
  
  // Request Configuration
  REQUEST_TIMEOUT: number;
  
  // IT Browser Configuration
  ITBROWSER_EXE: string;
  ITBROWSER_USER_DATA: string;
  ITBROWSER_PROFILE_DIR: string;
  
  // Telegram Configuration (optional)
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_OWNER_ID?: string;
}

export interface ValidationError {
  key: string;
  message: string;
  severity: 'error' | 'warning';
}

class ConfigManager {
  private config: AppConfig;
  private validationErrors: ValidationError[] = [];

  constructor() {
    this.config = this.loadConfig();
    this.validate();
  }

  /**
   * Load configuration from environment variables with defaults
   */
  private loadConfig(): AppConfig {
    return {
      // Server Configuration
      HTTP_PORT: this.getNumber('HTTP_PORT', 3001, 1, 65535),
      JWT_SECRET: this.getString('JWT_SECRET', ''),
      ENCRYPTION_KEY: this.getString('ENCRYPTION_KEY', ''),
      ALLOWED_ORIGINS: this.getStringArray('ALLOWED_ORIGINS', ['http://localhost:5173', 'http://localhost:3000']),
      
      // Bot Engine Configuration
      BOT_SAFETY_LIMIT: this.getNumber('BOT_SAFETY_LIMIT', 9999999, 1, 99999999),
      SCREENSHOT_TIMEOUT: this.getNumber('SCREENSHOT_TIMEOUT', 60000, 1000, 600000),
      
      // Streaming Configuration
      STREAM_QUALITY: this.getNumber('STREAM_QUALITY', 50, 1, 100),
      STREAM_DELAY: this.getNumber('STREAM_DELAY', 200, 100, 5000),
      
      // Resource Management
      MAX_PARALLEL_BROWSERS: this.getNumber('MAX_PARALLEL_BROWSERS', 11, 1, 99999999),
      SESSION_CLEANUP_INTERVAL: this.getNumber('SESSION_CLEANUP_INTERVAL', 86400000, 60000, 864000000),
      
      // Logging
      LOG_LEVEL: this.getLogLevel('LOG_LEVEL', LogLevel.INFO),
      
      // Request Configuration
      REQUEST_TIMEOUT: this.getNumber('REQUEST_TIMEOUT', 30000, 1000, 300000),
      
      // IT Browser Configuration
      ITBROWSER_EXE: this.getString('ITBROWSER_EXE', ''),
      ITBROWSER_USER_DATA: this.getString('ITBROWSER_USER_DATA', ''),
      ITBROWSER_PROFILE_DIR: this.getString('ITBROWSER_PROFILE_DIR', 'Default'),
      
      // Telegram Configuration (optional)
      TELEGRAM_BOT_TOKEN: this.getOptionalString('TELEGRAM_BOT_TOKEN'),
      TELEGRAM_OWNER_ID: this.getOptionalString('TELEGRAM_OWNER_ID'),
    };
  }

  /**
   * Validate required configuration at startup
   * Logs errors and exits if critical configuration is missing
   */
  private validate(): void {
    // Validate JWT_SECRET
    if (!this.config.JWT_SECRET) {
      this.validationErrors.push({
        key: 'JWT_SECRET',
        message: 'JWT_SECRET is required but not set',
        severity: 'error'
      });
    } else if (this.config.JWT_SECRET.length < 32) {
      this.validationErrors.push({
        key: 'JWT_SECRET',
        message: 'JWT_SECRET must be at least 32 characters long',
        severity: 'error'
      });
    }

    // Validate ENCRYPTION_KEY
    if (!this.config.ENCRYPTION_KEY) {
      this.validationErrors.push({
        key: 'ENCRYPTION_KEY',
        message: 'ENCRYPTION_KEY is required but not set',
        severity: 'error'
      });
    } else if (this.config.ENCRYPTION_KEY.length < 32) {
      this.validationErrors.push({
        key: 'ENCRYPTION_KEY',
        message: 'ENCRYPTION_KEY must be at least 32 characters long',
        severity: 'error'
      });
    }

    // Validate HTTP_PORT
    if (this.config.HTTP_PORT < 1 || this.config.HTTP_PORT > 65535) {
      this.validationErrors.push({
        key: 'HTTP_PORT',
        message: `HTTP_PORT must be between 1 and 65535, got ${this.config.HTTP_PORT}`,
        severity: 'error'
      });
    }

    // Validate MAX_PARALLEL_BROWSERS
    if (this.config.MAX_PARALLEL_BROWSERS < 1) {
      this.validationErrors.push({
        key: 'MAX_PARALLEL_BROWSERS',
        message: `MAX_PARALLEL_BROWSERS must be a positive integer, got ${this.config.MAX_PARALLEL_BROWSERS}`,
        severity: 'error'
      });
    }

    // Validate IT Browser configuration (warnings only, as they might be set later)
    if (!this.config.ITBROWSER_EXE) {
      this.validationErrors.push({
        key: 'ITBROWSER_EXE',
        message: 'ITBROWSER_EXE is not set - browser automation will not work',
        severity: 'warning'
      });
    }

    if (!this.config.ITBROWSER_USER_DATA) {
      this.validationErrors.push({
        key: 'ITBROWSER_USER_DATA',
        message: 'ITBROWSER_USER_DATA is not set - browser profiles will not work',
        severity: 'warning'
      });
    }

    // Log all validation errors
    const errors = this.validationErrors.filter(e => e.severity === 'error');
    const warnings = this.validationErrors.filter(e => e.severity === 'warning');

    if (warnings.length > 0) {
      console.warn('⚠️  Configuration warnings:');
      warnings.forEach(w => console.warn(`   - ${w.key}: ${w.message}`));
    }

    if (errors.length > 0) {
      console.error('❌ Configuration errors:');
      errors.forEach(e => console.error(`   - ${e.key}: ${e.message}`));
      console.error('\n💡 Please check your .env file and ensure all required variables are set.');
      console.error('   See .env.example for reference.\n');
      process.exit(1);
    }

    // Log successful validation
    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ Configuration validated successfully');
    }
  }

  /**
   * Get a string value from environment variables
   */
  private getString(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }

  /**
   * Get an optional string value from environment variables
   */
  private getOptionalString(key: string): string | undefined {
    return process.env[key];
  }

  /**
   * Get a number value from environment variables with range validation
   */
  private getNumber(key: string, defaultValue: number, min?: number, max?: number): number {
    const value = process.env[key];
    if (!value) return defaultValue;

    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      console.warn(`⚠️  Invalid number for ${key}: "${value}", using default: ${defaultValue}`);
      return defaultValue;
    }

    if (min !== undefined && parsed < min) {
      console.warn(`⚠️  ${key} value ${parsed} is below minimum ${min}, using minimum`);
      return min;
    }

    if (max !== undefined && parsed > max) {
      console.warn(`⚠️  ${key} value ${parsed} is above maximum ${max}, using maximum`);
      return max;
    }

    return parsed;
  }

  /**
   * Get a string array from comma-separated environment variable
   */
  private getStringArray(key: string, defaultValue: string[]): string[] {
    const value = process.env[key];
    if (!value) return defaultValue;

    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  /**
   * Get log level from environment variable
   */
  private getLogLevel(key: string, defaultValue: LogLevel): LogLevel {
    const value = process.env[key];
    if (!value) return defaultValue;

    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 3) {
      console.warn(`⚠️  Invalid log level for ${key}: "${value}", using default: ${defaultValue}`);
      return defaultValue;
    }

    return parsed as LogLevel;
  }

  /**
   * Get the full configuration object
   */
  public getConfig(): Readonly<AppConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Get a specific configuration value by key
   */
  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /**
   * Get validation errors (for testing/debugging)
   */
  public getValidationErrors(): ValidationError[] {
    return [...this.validationErrors];
  }

  /**
   * Reload configuration from environment variables
   * Useful for hot-reloading in development
   */
  public reload(): void {
    this.validationErrors = [];
    this.config = this.loadConfig();
    this.validate();
  }
}

// Export singleton instance
export const config = new ConfigManager();
