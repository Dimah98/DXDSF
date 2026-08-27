import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';
import { PROJECTS_DIR } from '../constants';
import { getProjectStats, getAllGlobalStats } from '../db/schema';
import { inputValidator } from '../validation/InputValidator';

const logger = new Logger('StatsController');

export async function getGlobalStats(_req: Request, res: Response): Promise<void> {
  try {
    const dbStats = getAllGlobalStats();
    if (dbStats && dbStats.length > 0) {
      res.json(dbStats);
      return;
    }

    let files: string[];
    try {
      files = await fs.promises.readdir(PROJECTS_DIR);
    } catch (readErr) {
      logger.error('Failed to read projects directory for global stats', readErr instanceof Error ? readErr : new Error(String(readErr)), { path: PROJECTS_DIR });
      res.status(500).json({ success: false, error: 'Failed to read projects directory.' });
      return;
    }
    
    const globalStats: { projectName: string; stats: any[] }[] = [];
    
    for (const file of files) {
      if (file.endsWith('_stats.json')) {
        const projectName = file.replace('_stats.json', '');
        if (
          projectName === 'categories' ||
          projectName === 'global_building_types' ||
          projectName.endsWith('_layout') ||
          projectName.endsWith('_save')
        ) {
          continue;
        }
        const statPath = path.join(PROJECTS_DIR, file);
        try {
          const fileContent = await fs.promises.readFile(statPath, 'utf-8');
          const raw = JSON.parse(fileContent);
          const stats = Array.isArray(raw) ? raw : [];
          globalStats.push({ projectName, stats });
        } catch (readErr) {
          logger.warn(`Failed to read or parse stats file for ${projectName}`, { path: statPath, error: String(readErr) });
        }
      }
    }
    res.json(globalStats);
  } catch (err: any) {
    logger.error('Global stats endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load global statistics. Please try again later.' });
  }
}

export async function getProjectStatsHandler(req: Request, res: Response): Promise<void> {
  try {
    const name = req.params.name;
    const validation = inputValidator.validateProjectName(name);
    if (!validation.isValid) {
      logger.warn('Stats endpoint failed: invalid project name', { name });
      res.status(400).json({ success: false, error: validation.error });
      return;
    }

    const dbStats = getProjectStats(name);
    if (dbStats && dbStats.length > 0) {
      res.json(dbStats);
      return;
    }
    
    const statPath = path.join(PROJECTS_DIR, `${name}_stats.json`);
    let fileExists = false;
    try {
      await fs.promises.access(statPath);
      fileExists = true;
    } catch {
      fileExists = false;
    }
    
    if (fileExists) {
      try {
        const fileContent = await fs.promises.readFile(statPath, 'utf-8');
        const raw = JSON.parse(fileContent);
        const stats = Array.isArray(raw) ? raw : [];
        res.json(stats);
      } catch (readErr) {
        logger.error(`Failed to read or parse stats file for ${name}`, readErr instanceof Error ? readErr : new Error(String(readErr)), { path: statPath });
        res.status(500).json({ success: false, error: 'Failed to load project statistics.' });
      }
    } else {
      res.json([]);
    }
  } catch (err: any) { 
    logger.error('Stats endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to process statistics request.' }); 
  }
}
