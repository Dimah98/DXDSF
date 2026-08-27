import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';
import { PROJECTS_DIR } from '../constants';
import { getLogs, saveLogs, deleteLogs } from '../db/schema';
import { inputValidator } from '../validation/InputValidator';

const logger = new Logger('LogsController');

export async function getProjectLogs(req: Request, res: Response): Promise<void> {
  try {
    const { project } = req.params;
    const validation = inputValidator.validateProjectName(project);
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const dbLogs = getLogs(project);
    if (dbLogs && dbLogs.length > 0) {
      res.json({ logs: dbLogs });
      return;
    }

    const logPath = path.join(PROJECTS_DIR, `${project}_logs.json`);
    if (!fs.existsSync(logPath)) {
      res.json({ logs: [] });
      return;
    }
    const data = await fs.promises.readFile(logPath, 'utf-8');
    const parsed = JSON.parse(data);
    res.json({ logs: Array.isArray(parsed) ? parsed : [] });
  } catch (err: any) {
    logger.error(`Error loading logs for project ${req.params.project}`, err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Failed to load logs' });
  }
}

export async function saveProjectLogs(req: Request, res: Response): Promise<void> {
  try {
    const { project } = req.params;
    const validation = inputValidator.validateProjectName(project);
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { logs } = req.body;
    if (!Array.isArray(logs)) {
      res.status(400).json({ error: 'Logs must be an array' });
      return;
    }

    try {
      saveLogs(project, logs);
    } catch (dbErr) {
      logger.warn(`Failed to save logs to SQLite for ${project}`, { error: String(dbErr) });
    }

    const logPath = path.join(PROJECTS_DIR, `${project}_logs.json`);
    await fs.promises.writeFile(logPath, JSON.stringify(logs, null, 2));
    res.json({ success: true });
  } catch (err: any) {
    logger.error(`Error saving logs for project ${req.params.project}`, err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Failed to save logs' });
  }
}

export async function deleteProjectLogs(req: Request, res: Response): Promise<void> {
  try {
    const { project } = req.params;
    const validation = inputValidator.validateProjectName(project);
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    try {
      deleteLogs(project);
    } catch (dbErr) {
      logger.warn(`Failed to delete logs from SQLite for ${project}`, { error: String(dbErr) });
    }

    const logPath = path.join(PROJECTS_DIR, `${project}_logs.json`);
    if (fs.existsSync(logPath)) {
      await fs.promises.unlink(logPath);
    }
    res.json({ success: true });
  } catch (err: any) {
    logger.error(`Error deleting logs for project ${req.params.project}`, err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Failed to delete logs' });
  }
}
