import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';
import { PROJECTS_DIR } from '../constants';
import { inputValidator } from '../validation/InputValidator';

const logger = new Logger('ProjectDataController');

export async function getProjectSave(req: Request, res: Response): Promise<void> {
  try {
    const { projectName } = req.params;
    const savePath = path.join(PROJECTS_DIR, `${projectName}_save.json`);
    
    if (fs.existsSync(savePath)) {
      const content = await fs.promises.readFile(savePath, 'utf-8');
      const data = JSON.parse(content);
      res.json({ success: true, data });
      return;
    }

    const projectPath = path.join(PROJECTS_DIR, `${projectName}.json`);
    if (fs.existsSync(projectPath)) {
      const content = await fs.promises.readFile(projectPath, 'utf-8');
      const data = JSON.parse(content);
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

    if (!fs.existsSync(layoutPath)) {
      res.json({
        success: true,
        data: { items: [], buildingTypes: globalBuildingTypes }
      });
      return;
    }

    const content = await fs.promises.readFile(layoutPath, 'utf-8');
    const data = JSON.parse(content);
    
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

    const savePath = path.join(PROJECTS_DIR, `${projectName}_save.json`);
    let orders: any[] = [];
    let timestamp: number = Date.now();

    if (fs.existsSync(savePath)) {
      try {
        const fileContent = await fs.promises.readFile(savePath, 'utf-8');
        const saveData = JSON.parse(fileContent);
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

        const stat = await fs.promises.stat(savePath);
        timestamp = Math.round(stat.mtimeMs);
      } catch (err) {
        logger.warn(`Failed to parse delivery from save for ${projectName}`, { path: savePath, error: String(err) });
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
