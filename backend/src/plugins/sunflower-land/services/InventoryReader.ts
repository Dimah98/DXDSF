import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import { InventoryFile, ResourceItem } from '../types';

// Logger interface compatible with any callable (including test mocks)
interface Logger {
  error: Function;
  warn: Function;
  debug: Function;
}

const defaultLogger: Logger = {
  error: (message: any, ...args: any[]) => console.error(message, ...args),
  warn: (message: any, ...args: any[]) => console.warn(message, ...args),
  debug: (message: any, ...args: any[]) => console.debug(message, ...args)
};

const IM_DIR = path.resolve(__dirname, '../../../../../im');
let imMapCache: Map<string, string> | null = null;
let imFilesList: string[] = [];

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function initImCache(): Map<string, string> {
  if (imMapCache !== null) return imMapCache;
  imMapCache = new Map<string, string>();
  try {
    imFilesList = fsSync.readdirSync(IM_DIR);
    for (const file of imFilesList) {
      const base = path.basename(file, path.extname(file)).toLowerCase().trim();
      imMapCache.set(base, file);
      imMapCache.set(base.replace(/ /g, '_'), file);
      imMapCache.set(base.replace(/_/g, ' '), file);
      imMapCache.set(normalizeKey(base), file);
    }
  } catch {
    imFilesList = [];
  }
  return imMapCache;
}

export function getImageUrl(itemName: string): string {
  const cache = initImCache();
  const cleanName = itemName.toLowerCase().trim();
  const norm = normalizeKey(cleanName);
  
  // O(1) прямий пошук за попередньо проіндексованим ключем
  let matchedFile = cache.get(cleanName) 
    || cache.get(cleanName.replace(/ /g, '_')) 
    || cache.get(cleanName.replace(/_/g, ' '))
    || cache.get(norm);

  if (!matchedFile && imFilesList.length > 0) {
    // Fallback: частковий збіг із мемоізацією
    matchedFile = imFilesList.find(file => {
      const fileClean = path.basename(file, path.extname(file)).toLowerCase().trim();
      return fileClean.includes(cleanName) || cleanName.includes(fileClean);
    });
    if (matchedFile) {
      cache.set(cleanName, matchedFile);
      cache.set(norm, matchedFile);
    }
  }

  return matchedFile ? `/api/im/${matchedFile}` : `/api/im/${itemName}.png`;
}

interface CacheEntry {
  mtime: number;
  data: InventoryFile | null;
}

const fileCache = new Map<string, CacheEntry>();

export class InventoryReader {
  private logger: Logger;
  constructor(logger: Logger = defaultLogger) { this.logger = logger; }

  async readAllInventories(projectsDir: string, source: 'inventory' | 'stock' = 'inventory'): Promise<Array<[string, InventoryFile]>> {
    const results: Array<[string, InventoryFile]> = [];
    const processedAccounts = new Set<string>();

    try {
      const files = await fs.readdir(projectsDir);
      const saveFiles = files.filter(file => file.endsWith('_save.json'));
      
      const saveResults = await Promise.all(
        saveFiles.map(async (filename) => {
          const accountId = filename.replace('_save.json', '');
          const filePath = path.join(projectsDir, filename);
          try {
            const inventoryData = await this.readSaveFile(filePath, accountId, source);
            if (inventoryData) return [accountId, inventoryData] as [string, InventoryFile];
          } catch {
            return null;
          }
          return null;
        })
      );

      for (const item of saveResults) {
        if (item) {
          results.push(item);
          processedAccounts.add(item[0]);
        }
      }

      const inventoryFiles = files.filter(file => file.endsWith('_inventory.json'));
      const legacyResults = await Promise.all(
        inventoryFiles.map(async (filename) => {
          const accountId = filename.replace('_inventory.json', '');
          if (processedAccounts.has(accountId)) return null;
          const filePath = path.join(projectsDir, filename);
          try {
            const inventoryData = await this.readInventoryFile(filePath, accountId);
            if (inventoryData) return [accountId, inventoryData] as [string, InventoryFile];
          } catch {
            return null;
          }
          return null;
        })
      );

      for (const item of legacyResults) {
        if (item && !processedAccounts.has(item[0])) {
          results.push(item);
          processedAccounts.add(item[0]);
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to read projects directory', error, { projectsDir });
      return results;
    }
  }

  private async readSaveFile(filePath: string, accountId: string, source: 'inventory' | 'stock' = 'inventory'): Promise<InventoryFile | null> {
    try {
      let mtimeMs: number | undefined;
      if (typeof fs.stat === 'function') {
        try {
          const stats = await fs.stat(filePath);
          mtimeMs = stats?.mtimeMs;
        } catch (e) {}
      }

      const cacheKey = `${filePath}:${source}`;
      if (mtimeMs !== undefined) {
        const cached = fileCache.get(cacheKey);
        if (cached && cached.mtime === mtimeMs) {
          return cached.data;
        }
      }

      const fileContent = await fs.readFile(filePath, 'utf-8');
      let data: any;
      try { data = JSON.parse(fileContent); }
      catch (parseError) { this.logger.error('Invalid JSON in save file', parseError, { accountId, filePath }); return null; }
      const rawInventory: Record<string, any> = (data.visitedFarmState && data.visitedFarmState[source]) || {};
      if (Object.keys(rawInventory).length === 0) {
        if (mtimeMs !== undefined) fileCache.set(cacheKey, { mtime: mtimeMs, data: null });
        return null;
      }
      const timestamp = mtimeMs || Date.now();
      const items: ResourceItem[] = Object.entries(rawInventory)
        .map(([key, val]) => ({
          image: getImageUrl(key),
          number: typeof val === 'number' ? val : parseFloat(String(val)) || 0,
          selector: '',
          coords: { x: 0, y: 0 }
        }))
        .filter(item => item.number > 0);
      const result: InventoryFile = {
        projectName: accountId,
        data: items,
        timestamp,
        version: '2.0',
        metadata: { selector: `visitedFarmState.${source}`, itemCount: items.length, scanDuration: 0 }
      };
      if (mtimeMs !== undefined) fileCache.set(cacheKey, { mtime: mtimeMs, data: result });
      return result;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') { this.logger.debug('Inventory file not found, skipping', { accountId, filePath }); return null; }
      this.logger.error('Failed to read save file', error, { accountId, filePath, errorCode: err.code });
      return null;
    }
  }

  private async readInventoryFile(filePath: string, accountId: string): Promise<InventoryFile | null> {
    try {
      let mtimeMs: number | undefined;
      if (typeof fs.stat === 'function') {
        try {
          const stats = await fs.stat(filePath);
          mtimeMs = stats?.mtimeMs;
        } catch (e) {}
      }

      const cacheKey = filePath;
      if (mtimeMs !== undefined) {
        const cached = fileCache.get(cacheKey);
        if (cached && cached.mtime === mtimeMs) {
          return cached.data;
        }
      }

      const fileContent = await fs.readFile(filePath, 'utf-8');
      let data: any;
      try { data = JSON.parse(fileContent); }
      catch (parseError) { this.logger.error('Invalid JSON in inventory file', parseError, { accountId, filePath }); return null; }

      if (!data || typeof data !== 'object' ||
          typeof data.projectName !== 'string' ||
          !Array.isArray(data.data) ||
          typeof data.timestamp !== 'number' ||
          typeof data.version !== 'string' ||
          !data.metadata || typeof data.metadata !== 'object' ||
          typeof data.metadata.selector !== 'string' ||
          typeof data.metadata.itemCount !== 'number' ||
          typeof data.metadata.scanDuration !== 'number') {
        this.logger.error('Invalid inventory file structure', undefined, { accountId, filePath });
        return null;
      }

      for (const item of data.data) {
        if (!item || typeof item !== 'object' ||
            typeof item.image !== 'string' || item.image.length === 0 ||
            typeof item.number !== 'number' ||
            typeof item.selector !== 'string' ||
            !item.coords || typeof item.coords !== 'object' ||
            typeof item.coords.x !== 'number' ||
            typeof item.coords.y !== 'number') {
          this.logger.error('Invalid inventory file structure', undefined, { accountId, filePath });
          return null;
        }
      }

      if (data.version !== '1.0') {
        this.logger.warn('Version mismatch in inventory file', { accountId, filePath, expectedVersion: '1.0', actualVersion: data.version });
      }

      if (data.projectName !== accountId) {
        this.logger.warn('ProjectName mismatch in inventory file', {
          accountId,
          filePath,
          filename: path.basename(filePath),
          projectName: data.projectName,
          expectedProjectName: accountId,
          actualProjectName: data.projectName
        });
      }

      const result: InventoryFile = {
        projectName: data.projectName,
        data: data.data,
        timestamp: data.timestamp,
        version: data.version,
        metadata: data.metadata
      };
      if (mtimeMs !== undefined) fileCache.set(cacheKey, { mtime: mtimeMs, data: result });
      return result;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') { this.logger.debug('Inventory file not found, skipping', { accountId, filePath }); return null; }
      this.logger.error('Failed to read inventory file', error, { accountId, filePath, errorCode: err.code });
      return null;
    }
  }
}
