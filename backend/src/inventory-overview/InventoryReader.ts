/**
 * InventoryReader - Responsible for scanning and reading inventory files
 * 
 * This module implements file system operations to:
 * - Scan the projects directory for *_inventory.json files
 * - Read and parse JSON inventory files
 * - Validate inventory file structure
 * - Handle errors gracefully (missing files, invalid JSON, etc.)
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { InventoryFile } from './types';

/**
 * Logger interface for error and warning messages
 */
interface Logger {
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

/**
 * Default console logger implementation
 */
const defaultLogger: Logger = {
  error: (message, error, context) => {
    console.error(message, error, context);
  },
  warn: (message, context) => {
    console.warn(message, context);
  },
  debug: (message, context) => {
    console.debug(message, context);
  }
};

export class InventoryReader {
  private logger: Logger;

  constructor(logger: Logger = defaultLogger) {
    this.logger = logger;
  }

  /**
   * Scans the projects directory for files matching pattern *_inventory.json
   * and reads their contents.
   * 
   * @param projectsDir - Absolute path to the projects directory
   * @returns Array of tuples [accountId, inventoryData] for successfully read files
   * 
   * Error Handling:
   * - Missing files: Skipped without error (logged at debug level)
   * - Invalid JSON: Logged at error level, processing continues
   * - File access errors: Logged at error level, processing continues
   * - Version mismatch: Logged at warn level, file still processed
   * - ProjectName mismatch: Logged at warn level
   */
  async readAllInventories(projectsDir: string): Promise<Array<[string, InventoryFile]>> {
    const results: Array<[string, InventoryFile]> = [];

    try {
      // Read all files in the directory
      const files = await fs.readdir(projectsDir);

      // Filter files matching the pattern *_inventory.json
      const inventoryFiles = files.filter(file => file.endsWith('_inventory.json'));

      this.logger.debug('Found inventory files', {
        directory: projectsDir,
        count: inventoryFiles.length,
        files: inventoryFiles
      });

      // Process each inventory file
      for (const filename of inventoryFiles) {
        const accountId = filename.replace('_inventory.json', '');
        const filePath = path.join(projectsDir, filename);

        try {
          const inventoryData = await this.readInventoryFile(filePath, accountId);
          if (inventoryData) {
            results.push([accountId, inventoryData]);
          }
        } catch (error) {
          // Error already logged in readInventoryFile, continue processing
          continue;
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to read projects directory', error as Error, {
        projectsDir
      });
      // Return partial results if directory reading fails
      return results;
    }
  }

  /**
   * Reads and validates a single inventory file
   * 
   * @param filePath - Path to the inventory file
   * @param accountId - Expected account ID (from filename)
   * @returns Parsed and validated InventoryFile, or null if invalid
   */
  private async readInventoryFile(filePath: string, accountId: string): Promise<InventoryFile | null> {
    try {
      // Read file contents
      const fileContent = await fs.readFile(filePath, 'utf-8');

      // Parse JSON
      let data: unknown;
      try {
        data = JSON.parse(fileContent);
      } catch (parseError) {
        this.logger.error('Invalid JSON in inventory file', parseError as Error, {
          accountId,
          filePath
        });
        return null;
      }

      // Validate structure
      if (!this.isValidInventoryFile(data)) {
        this.logger.error('Invalid inventory file structure', undefined, {
          accountId,
          filePath
        });
        return null;
      }

      const inventoryFile = data as InventoryFile;

      // Validate version
      if (inventoryFile.version !== '1.0') {
        this.logger.warn('Version mismatch in inventory file', {
          accountId,
          expectedVersion: '1.0',
          actualVersion: inventoryFile.version
        });
      }

      // Validate projectName matches filename
      if (inventoryFile.projectName !== accountId) {
        this.logger.warn('ProjectName mismatch in inventory file', {
          accountId,
          projectName: inventoryFile.projectName,
          filename: `${accountId}_inventory.json`
        });
      }

      return inventoryFile;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      
      // File not found - skip silently (debug level)
      if (err.code === 'ENOENT') {
        this.logger.debug('Inventory file not found, skipping', {
          accountId,
          filePath
        });
        return null;
      }

      // Access denied or other file errors
      this.logger.error('Failed to read inventory file', error as Error, {
        accountId,
        filePath,
        errorCode: err.code
      });
      return null;
    }
  }

  /**
   * Validates that the parsed data has the expected InventoryFile structure
   * 
   * @param data - Parsed JSON data
   * @returns True if data matches InventoryFile interface
   */
  private isValidInventoryFile(data: unknown): data is InventoryFile {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    // Check required fields
    if (typeof obj.projectName !== 'string') return false;
    if (!Array.isArray(obj.data)) return false;
    if (typeof obj.timestamp !== 'number') return false;
    if (typeof obj.version !== 'string') return false;
    if (typeof obj.metadata !== 'object' || obj.metadata === null) return false;

    // Validate metadata structure
    const metadata = obj.metadata as Record<string, unknown>;
    if (typeof metadata.selector !== 'string') return false;
    if (typeof metadata.itemCount !== 'number') return false;
    if (typeof metadata.scanDuration !== 'number') return false;

    // Validate each resource item in data array
    for (const item of obj.data) {
      if (typeof item !== 'object' || item === null) return false;
      
      const resourceItem = item as Record<string, unknown>;
      if (typeof resourceItem.image !== 'string') return false;
      if (typeof resourceItem.number !== 'number') return false;
      if (typeof resourceItem.selector !== 'string') return false;
      
      // Validate coords
      if (typeof resourceItem.coords !== 'object' || resourceItem.coords === null) return false;
      const coords = resourceItem.coords as Record<string, unknown>;
      if (typeof coords.x !== 'number') return false;
      if (typeof coords.y !== 'number') return false;
    }

    return true;
  }
}
