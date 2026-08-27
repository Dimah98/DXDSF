import { Request, Response } from 'express';
import fs from 'fs';
import { Logger } from '../logger';
import { PROJECTS_DIR } from '../constants';
import { internalConfig } from '../internalConfig';
import { ConfigStore } from '../configs/ConfigStore';
import { evaluateConfig, loadConfigFiles } from '../configs/ConfigEvaluator';
import { projectQueueManager } from '../runner/ProjectRunner';

const logger = new Logger('ConfigsController');

export function getGlobalConfig(_req: Request, res: Response): void {
  try {
    res.status(200).json(internalConfig.getAll());
  } catch (error: any) {
    logger.error('Failed to get config', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Internal server error' });
  }
}

export function updateGlobalConfig(req: Request, res: Response): void {
  try {
    const changes = req.body;
    for (const [key, value] of Object.entries(changes)) {
      if (typeof value === 'number') {
        internalConfig.set(key, value);
      } else if (typeof value === 'boolean') {
        internalConfig.set(key, value ? 1 : 0);
      } else if (typeof value === 'string' && !isNaN(Number(value))) {
        internalConfig.set(key, Number(value));
      }
    }
    projectQueueManager.processNext();
    res.status(200).json({ success: true, config: internalConfig.getAll() });
  } catch (error: any) {
    logger.error('Failed to update config', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Internal server error' });
  }
}

export function getAllConfigs(_req: Request, res: Response): void {
  try {
    const configs = ConfigStore.getAll();
    res.json({ success: true, configs });
  } catch (error) {
    logger.error('Failed to get configs', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ success: false, error: 'Failed to load configs' });
  }
}

export function getConfigById(req: Request, res: Response): void {
  try {
    const config = ConfigStore.getById(req.params.id);
    if (!config) {
      res.status(404).json({ success: false, error: 'Config not found' });
      return;
    }
    res.json({ success: true, config });
  } catch (error) {
    logger.error('Failed to get config by id', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ success: false, error: 'Failed to load config' });
  }
}

export function createConfig(req: Request, res: Response): void {
  try {
    const newConfig = ConfigStore.create(req.body);
    res.json({ success: true, config: newConfig });
  } catch (error: any) {
    logger.error('Failed to create config', error instanceof Error ? error : new Error(String(error)));
    res.status(400).json({ success: false, error: error.message || 'Failed to create config' });
  }
}

export function updateConfig(req: Request, res: Response): void {
  try {
    const updated = ConfigStore.update(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Config not found' });
      return;
    }
    res.json({ success: true, config: updated });
  } catch (error: any) {
    logger.error('Failed to update config', error instanceof Error ? error : new Error(String(error)));
    res.status(400).json({ success: false, error: error.message || 'Failed to update config' });
  }
}

export function deleteConfig(req: Request, res: Response): void {
  try {
    const deleted = ConfigStore.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Config not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete config', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ success: false, error: 'Failed to delete config' });
  }
}

export async function getMatchingProjects(req: Request, res: Response): Promise<void> {
  try {
    const configId = req.params.id;
    const files = await fs.promises.readdir(PROJECTS_DIR);
    const projectNames = files.filter(f => {
      if (!f.endsWith('.json')) return false;
      const name = f.replace('.json', '');
      if (name === 'categories' || name === 'global_building_types') return false;
      if (name.endsWith('_layout') || name.endsWith('_save')) return false;
      if (name.endsWith('_stats') || name.endsWith('_logs') || name.endsWith('_inventory')) return false;
      if (name.includes('schedule') || name.includes('notifications')) return false;
      return true;
    }).map(f => f.replace('.json', ''));

    if (configId === 'all') {
      res.json({ success: true, projects: projectNames });
      return;
    }

    const config = ConfigStore.getById(configId);
    if (!config) {
      res.json({ success: true, projects: projectNames });
      return;
    }

    const matching: string[] = [];
    for (const p of projectNames) {
      try {
        const fileCache = loadConfigFiles(config, p, () => {});
        const passed = evaluateConfig(config, p, fileCache, new Set(), {}, {}, () => {});
        if (passed) {
          matching.push(p);
        }
      } catch (e) {}
    }
    res.json({ success: true, projects: matching });
  } catch (err) {
    logger.error('Failed to get matching projects', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to find matching projects' });
  }
}
