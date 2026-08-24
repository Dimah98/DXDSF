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
let imFilesCache: string[] | null = null;

function getImFiles(): string[] {
  if (imFilesCache === null) {
    try { 
      imFilesCache = fsSync.readdirSync(IM_DIR); 
    } catch (e) { 
      imFilesCache = []; 
    }
  }
  return imFilesCache;
}

export function getImageUrl(itemName: string): string {
  const imFiles = getImFiles();
  const cleanName = itemName.toLowerCase().trim();
  let matchedFile = imFiles.find(file => {
    const fileClean = path.basename(file, path.extname(file)).toLowerCase().trim();
    return fileClean === cleanName ||
           fileClean.replace(/ /g, '_') === cleanName ||
           fileClean.replace(/_/g, ' ') === cleanName;
  });
  if (!matchedFile) {
    matchedFile = imFiles.find(file => {
      const fileClean = path.basename(file, path.extname(file)).toLowerCase().trim();
      return fileClean.includes(cleanName) || cleanName.includes(fileClean);
    });
  }
  return matchedFile ? `/api/im/${matchedFile}` : `/api/im/${itemName}.png`;
}

export class InventoryReader {
  private logger: Logger;
  constructor(logger: Logger = defaultLogger) { this.logger = logger; }

  async readAllInventories(projectsDir: string, source: 'inventory' | 'stock' = 'inventory'): Promise<Array<[string, InventoryFile]>> {
    const results: Array<[string, InventoryFile]> = [];
    const processedAccounts = new Set<string>();

    try {
      const files = await fs.readdir(projectsDir);
      const saveFiles = files.filter(file => file.endsWith('_save.json'));
      for (const filename of saveFiles) {
        const accountId = filename.replace('_save.json', '');
        const filePath = path.join(projectsDir, filename);
        try {
          const inventoryData = await this.readSaveFile(filePath, accountId, source);
          if (inventoryData) { results.push([accountId, inventoryData]); processedAccounts.add(accountId); }
        } catch (error) { continue; }
      }
      const inventoryFiles = files.filter(file => file.endsWith('_inventory.json'));
      for (const filename of inventoryFiles) {
        const accountId = filename.replace('_inventory.json', '');
        if (processedAccounts.has(accountId)) continue;
        const filePath = path.join(projectsDir, filename);
        try {
          const inventoryData = await this.readInventoryFile(filePath, accountId);
          if (inventoryData) results.push([accountId, inventoryData]);
        } catch (error) { continue; }
      }
      return results;
    } catch (error) {
      this.logger.error('Failed to read projects directory', error, { projectsDir });
      return results;
    }
  }

  private async readSaveFile(filePath: string, accountId: string, source: 'inventory' | 'stock' = 'inventory'): Promise<InventoryFile | null> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      let data: any;
      try { data = JSON.parse(fileContent); }
      catch (parseError) { this.logger.error('Invalid JSON in save file', parseError, { accountId, filePath }); return null; }
      const rawInventory: Record<string, any> = (data.visitedFarmState && data.visitedFarmState[source]) || {};
      if (Object.keys(rawInventory).length === 0) return null;
      let timestamp = Date.now();
      try { const stats = await fs.stat(filePath); timestamp = stats.mtimeMs; } catch (e) {}
      const items: ResourceItem[] = Object.entries(rawInventory)
        .map(([key, val]) => ({
          image: getImageUrl(key),
          number: typeof val === 'number' ? val : parseFloat(String(val)) || 0,
          selector: '',
          coords: { x: 0, y: 0 }
        }))
        .filter(item => item.number > 0);
      return {
        projectName: accountId,
        data: items,
        timestamp,
        version: '2.0',
        metadata: { selector: `visitedFarmState.${source}`, itemCount: items.length, scanDuration: 0 }
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') { this.logger.debug('Save file not found', { accountId, filePath }); return null; }
      this.logger.error('Failed to read save file', error, { accountId, filePath, errorCode: err.code });
      return null;
    }
  }

  private async readInventoryFile(filePath: string, accountId: string): Promise<InventoryFile | null> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      let data: any;
      try { data = JSON.parse(fileContent); }
      catch (parseError) { this.logger.error('Invalid JSON in inventory file', parseError, { accountId, filePath }); return null; }
      if (!data || typeof data !== 'object' || !Array.isArray(data.data)) return null;
      const validItems: ResourceItem[] = data.data
        .filter((item: any) => item && typeof item === 'object' && typeof item.image === 'string' && item.image.length > 0 && (typeof item.number === 'number' || !isNaN(parseFloat(item.number))))
        .map((item: any) => ({
          image: item.image,
          number: typeof item.number === 'number' ? item.number : parseFloat(item.number) || 0,
          selector: item.selector || '',
          coords: item.coords || { x: 0, y: 0 }
        }));
      let timestamp = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
      try { const stats = await fs.stat(filePath); timestamp = stats.mtimeMs; } catch (e) {}
      return {
        projectName: typeof data.projectName === 'string' ? data.projectName : accountId,
        data: validItems,
        timestamp,
        version: typeof data.version === 'string' ? data.version : '1.0',
        metadata: data.metadata || { selector: '', itemCount: validItems.length, scanDuration: 0 }
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') { this.logger.debug('Inventory file not found', { accountId, filePath }); return null; }
      this.logger.error('Failed to read inventory file', error, { accountId, filePath, errorCode: err.code });
      return null;
    }
  }
}
