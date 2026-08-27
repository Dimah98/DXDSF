import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';
import { PROJECTS_DIR } from '../constants';
import { InventoryReader, getImageUrl } from '../inventory-overview/InventoryReader';
import { ResourceAggregator } from '../inventory-overview/ResourceAggregator';
import { getInventory } from '../db/schema';
import { inputValidator } from '../validation/InputValidator';

const logger = new Logger('InventoryController');

export async function getInventoryOverview(_req: Request, res: Response): Promise<void> {
  try {
    const reader = new InventoryReader();
    const aggregator = new ResourceAggregator();
    
    const inventories = await reader.readAllInventories(PROJECTS_DIR);
    const result = aggregator.aggregate(inventories);
    
    res.json(result);
  } catch (err: any) {
    logger.error('Failed to get inventory overview', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load inventory overview' });
  }
}

export async function getInventoryCategories(_req: Request, res: Response): Promise<void> {
  try {
    const categoriesPath = path.join(PROJECTS_DIR, 'categories.json');
    if (!fs.existsSync(categoriesPath)) {
      res.json({ categories: [], itemToCategories: {} });
      return;
    }
    const content = await fs.promises.readFile(categoriesPath, 'utf-8');
    const data = JSON.parse(content);
    res.json({
      categories: Array.isArray(data.categories) ? data.categories : [],
      itemToCategories: (data.itemToCategories && typeof data.itemToCategories === 'object') ? data.itemToCategories : {}
    });
  } catch (err) {
    logger.error('Failed to read categories.json', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load categories' });
  }
}

export async function saveInventoryCategories(req: Request, res: Response): Promise<void> {
  try {
    const { categories, itemToCategories } = req.body;
    if (!Array.isArray(categories) || typeof itemToCategories !== 'object') {
      res.status(400).json({ success: false, error: 'Invalid categories data format' });
      return;
    }
    const categoriesPath = path.join(PROJECTS_DIR, 'categories.json');
    await fs.promises.writeFile(
      categoriesPath,
      JSON.stringify({ categories, itemToCategories }, null, 2),
      'utf-8'
    );
    logger.info('Saved categories configuration to categories.json');
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to save categories.json', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to save categories' });
  }
}

export async function getProjectInventory(req: Request, res: Response): Promise<void> {
  try {
    const projectName = req.params.projectName;

    const validation = inputValidator.validateProjectName(projectName);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        error: 'Invalid project name. Only alphanumeric characters, hyphens, and underscores are allowed.'
      });
      return;
    }

    const source = (req.query.source as string) === 'stock' ? 'stock' : 'inventory';

    // 1. Спробуємо прочитати {projectName}_save.json
    const savePath = path.join(PROJECTS_DIR, `${projectName}_save.json`);
    let items: Array<{ image: string; number: number; selector: string; coords: { x: number; y: number } }> = [];
    let timestamp: number | null = null;
    let loadedFromSave = false;

    if (fs.existsSync(savePath)) {
      try {
        const fileContent = await fs.promises.readFile(savePath, 'utf-8');
        const saveData = JSON.parse(fileContent);
        const rawInventory: Record<string, any> = 
          (saveData.visitedFarmState && saveData.visitedFarmState[source]) ||
          (saveData.visitorFarmState && saveData.visitorFarmState[source]) ||
          (saveData.visitedFarmState && saveData.visitedFarmState.inventory) ||
          saveData.inventory || 
          {};

        if (Object.keys(rawInventory).length > 0) {
          items = Object.entries(rawInventory)
            .map(([key, val]) => ({
              image: getImageUrl(key),
              number: typeof val === 'number' ? val : parseFloat(String(val)) || 0,
              selector: '',
              coords: { x: 0, y: 0 }
            }))
            .filter(item => item.number > 0);

          try {
            const stat = await fs.promises.stat(savePath);
            timestamp = Math.round(stat.mtimeMs);
          } catch (e) {
            timestamp = Date.now();
          }
          loadedFromSave = true;
        }
      } catch (err) {
        logger.warn(`Failed to parse save file for ${projectName}`, { path: savePath, error: String(err) });
      }
    }

    // 2. Якщо _save.json немає або він порожній — перевіряємо SQLite
    if (!loadedFromSave) {
      try {
        const dbItems = getInventory(projectName);
        if (dbItems && dbItems.length > 0) {
          items = dbItems.map(item => ({
            image: item.image_url || getImageUrl(item.item_name),
            number: item.quantity,
            selector: '',
            coords: { x: 0, y: 0 }
          }));
          timestamp = dbItems[0]?.scanned_at || null;
          loadedFromSave = true;
        }
      } catch (dbErr) {
        logger.warn(`Failed to read inventory from SQLite for ${projectName}`, { error: String(dbErr) });
      }
    }

    // 3. Fallback на legacy {projectName}_inventory.json
    if (!loadedFromSave) {
      const inventoryPath = path.join(PROJECTS_DIR, `${projectName}_inventory.json`);
      if (fs.existsSync(inventoryPath)) {
        try {
          const fileContent = await fs.promises.readFile(inventoryPath, 'utf-8');
          const inventoryData = JSON.parse(fileContent);
          if (Array.isArray(inventoryData.data)) {
            items = inventoryData.data;
            timestamp = inventoryData.timestamp || null;
          }
        } catch (err) {
          logger.warn(`Failed to parse legacy inventory file for ${projectName}`, { path: inventoryPath, error: String(err) });
        }
      }
    }

    let variables = {};
    try {
      const projectPath = path.join(PROJECTS_DIR, `${projectName}.json`);
      if (fs.existsSync(projectPath)) {
        const projectContent = await fs.promises.readFile(projectPath, 'utf-8');
        const projectData = JSON.parse(projectContent);
        variables = projectData.variables || projectData;
      }
    } catch (e) {}

    res.json({
      data: items,
      timestamp: timestamp,
      projectName: projectName,
      variables: variables
    });
  } catch (err) {
    logger.error('Inventory endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({
      success: false,
      error: 'Failed to process inventory request. Please try again later.'
    });
  }
}
