import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';
import { PROJECTS_DIR } from '../constants';
import { inputValidator } from '../validation/InputValidator';
import { getProjectSaveData } from '../utils/saveStorage';
import { getDbProjectLayout, saveDbProjectLayout, deleteDbProjectLayout, getProjects as getDbProjects } from '../db/schema';
import { loadProjectVariables } from '../utils/variableStorage';
import { getImageUrl } from '../inventory-overview/InventoryReader';

const logger = new Logger('ProjectDataController');

export async function getProjectSave(req: Request, res: Response): Promise<void> {
  try {
    const { projectName } = req.params;
    const data = await getProjectSaveData(projectName);
    
    if (data) {
      res.json({ success: true, data });
      return;
    }

    res.status(404).json({ success: false, error: 'Файл збереження не знайдено' });
  } catch (err) {
    logger.error('Failed to get project save', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Помилка завантаження збереження' });
  }
}

export async function getProjectMap(req: Request, res: Response): Promise<void> {
  try {
    const { projectName } = req.params;
    const layoutPath = path.join(PROJECTS_DIR, `${projectName}_layout.json`);
    const globalTypesPath = path.join(PROJECTS_DIR, 'global_building_types.json');
    let globalBuildingTypes = {};
    if (fs.existsSync(globalTypesPath)) {
      try {
        globalBuildingTypes = JSON.parse(await fs.promises.readFile(globalTypesPath, 'utf-8'));
      } catch (e) {}
    }

    // 1. Спочатку перевіряємо SQLite
    let data = getDbProjectLayout(projectName);

    // 2. Fallback на диск, якщо в SQLite ще немає
    if (!data && fs.existsSync(layoutPath)) {
      try {
        const content = await fs.promises.readFile(layoutPath, 'utf-8');
        data = JSON.parse(content);
        if (data) {
          try { saveDbProjectLayout(projectName, data); } catch (_) {}
        }
      } catch (_) {}
    }

    if (!data) {
      res.json({
        success: true,
        data: { items: [], buildingTypes: globalBuildingTypes }
      });
      return;
    }
    
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (!data.buildingTypes || Object.keys(data.buildingTypes).length === 0) {
        data.buildingTypes = globalBuildingTypes;
      }
    }

    res.json({ success: true, data });
  } catch (err) {
    logger.error('Failed to get project map layout', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Помилка завантаження карти острова' });
  }
}

export async function saveProjectMap(req: Request, res: Response): Promise<void> {
  try {
    const { projectName } = req.params;
    
    // 1. Зберігаємо в SQLite
    try {
      saveDbProjectLayout(projectName, req.body);
    } catch (dbErr) {
      logger.warn(`Failed to save layout to SQLite for ${projectName}`, { error: String(dbErr) });
    }

    // 2. Зберігаємо на диск
    const layoutPath = path.join(PROJECTS_DIR, `${projectName}_layout.json`);
    await fs.promises.writeFile(layoutPath, JSON.stringify(req.body, null, 2), 'utf-8');
    logger.info(`Saved island layout for project ${projectName}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to save project map layout', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Помилка збереження карти острова' });
  }
}

export async function deleteProjectMap(req: Request, res: Response): Promise<void> {
  try {
    const { projectName } = req.params;
    
    // 1. Видаляємо з SQLite
    deleteDbProjectLayout(projectName);

    // 2. Видаляємо з диска
    const layoutPath = path.join(PROJECTS_DIR, `${projectName}_layout.json`);
    if (fs.existsSync(layoutPath)) {
      await fs.promises.unlink(layoutPath);
      logger.info(`Deleted island layout for project ${projectName}`);
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to delete project map layout', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Помилка видалення карти острова' });
  }
}

export async function getProjectDeliveries(req: Request, res: Response): Promise<void> {
  try {
    const { projectName } = req.params;
    const validation = inputValidator.validateProjectName(projectName);
    if (!validation.isValid) {
      res.status(400).json({ success: false, error: validation.error });
      return;
    }

    let orders: any[] = [];
    let timestamp: number = Date.now();

    const saveData = await getProjectSaveData(projectName);
    if (saveData) {
      const rawOrders =
        saveData.visitedFarmState?.delivery?.orders ||
        saveData.visitorFarmState?.delivery?.orders ||
        saveData.delivery?.orders ||
        [];

      if (Array.isArray(rawOrders)) {
        orders = rawOrders.map((order: any) => ({
          id: String(order.id || ''),
          from: String(order.from || ''),
          items: order.items || {},
          readyAt: typeof order.readyAt === 'number' ? order.readyAt : (typeof order.createdAt === 'number' ? order.createdAt : 0),
          createdAt: typeof order.createdAt === 'number' ? order.createdAt : 0,
          completedAt: typeof order.completedAt === 'number' ? order.completedAt : null,
          reward: {
            coins: order.reward?.coins ?? null,
            sfl: order.reward?.sfl ?? null,
            items: order.reward?.items ?? {}
          }
        }));
      }
    }

    res.json({
      data: orders,
      timestamp,
      projectName
    });
  } catch (err: any) {
    logger.error('Failed to get deliveries for project', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load deliveries' });
  }
}

export async function getAllProjectsDeliveries(_req: Request, res: Response): Promise<void> {
  try {
    const dbProjects = getDbProjects();
    const projectNames = (dbProjects && dbProjects.length > 0)
      ? dbProjects.map(p => p.name).filter(n =>
          !n.endsWith('_vars') && !n.endsWith('_save') && !n.endsWith('_layout') &&
          !n.endsWith('_stats') && !n.endsWith('_logs') && !n.endsWith('_inventory') &&
          !['categories', 'global_building_types', 'buildings_catalog_settings', 'schedule', 'notifications', 'configs', 'mass_launches'].includes(n)
        )
      : [];

    const allDeliveries: Record<string, any[]> = {};
    const allInventories: Record<string, any[]> = {};
    const allMarked: Record<string, string[]> = {};

    for (const projectName of projectNames) {
      try {
        const saveData = await getProjectSaveData(projectName);
        if (saveData) {
          const rawOrders =
            saveData.visitedFarmState?.delivery?.orders ||
            saveData.visitorFarmState?.delivery?.orders ||
            saveData.delivery?.orders ||
            [];

          if (Array.isArray(rawOrders) && rawOrders.length > 0) {
            allDeliveries[projectName] = rawOrders.map((order: any) => ({
              id: String(order.id || ''),
              from: String(order.from || ''),
              items: order.items || {},
              readyAt: typeof order.readyAt === 'number' ? order.readyAt : (typeof order.createdAt === 'number' ? order.createdAt : 0),
              createdAt: typeof order.createdAt === 'number' ? order.createdAt : 0,
              completedAt: typeof order.completedAt === 'number' ? order.completedAt : null,
              reward: {
                coins: order.reward?.coins ?? null,
                sfl: order.reward?.sfl ?? null,
                items: order.reward?.items ?? {}
              }
            }));
          }

          const rawInventory: Record<string, any> =
            (saveData.visitedFarmState && saveData.visitedFarmState.inventory) ||
            (saveData.visitorFarmState && saveData.visitorFarmState.inventory) ||
            saveData.inventory ||
            {};

          if (Object.keys(rawInventory).length > 0) {
            allInventories[projectName] = Object.entries(rawInventory)
              .map(([key, val]) => ({
                image: getImageUrl(key),
                number: typeof val === 'number' ? val : parseFloat(String(val)) || 0,
                selector: '',
                coords: { x: 0, y: 0 }
              }))
              .filter(item => item.number > 0);
          }
        }

        const variables = await loadProjectVariables(projectName);
        const markedSet = new Set<string>();
        const legacyRaw = variables['__markedDeliveries'];
        if (Array.isArray(legacyRaw)) {
          legacyRaw.forEach(k => { if (typeof k === 'string') markedSet.add(k); });
        }
        for (const [key, value] of Object.entries(variables)) {
          if (key === '__markedDeliveries' || key.startsWith('__markedItems_')) continue;
          const numVal = typeof value === 'number' ? value : (typeof value === 'boolean' ? (value ? 1 : 0) : parseInt(String(value), 10));
          if (numVal === 1) markedSet.add(key);
        }
        if (markedSet.size > 0) {
          allMarked[projectName] = Array.from(markedSet);
        }
      } catch (projErr) {
        logger.warn(`Failed to process deliveries for ${projectName}`, { error: String(projErr) });
      }
    }

    res.json({
      success: true,
      timestamp: Date.now(),
      deliveries: allDeliveries,
      inventories: allInventories,
      marked: allMarked
    });
  } catch (err: any) {
    logger.error('Failed to get all deliveries', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load all deliveries' });
  }
}

