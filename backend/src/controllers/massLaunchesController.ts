import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';
import { PROJECTS_DIR } from '../constants';
import { MassLaunchStore } from '../scheduler/MassLaunchStore';
import { ConfigStore } from '../configs/ConfigStore';
import { evaluateConfig, loadConfigFiles, resolvePath } from '../configs/ConfigEvaluator';
import { enrichMassLaunches, parseTimeInfo } from '../runner/MassLaunchRunner';

const logger = new Logger('MassLaunchesController');

export async function getMassLaunches(_req: Request, res: Response): Promise<void> {
  try {
    const rawLaunches = MassLaunchStore.getAll();
    const launches = await enrichMassLaunches(rawLaunches);
    res.json(launches);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

export function createMassLaunch(req: Request, res: Response): void {
  try {
    const item = MassLaunchStore.create(req.body);
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

export function updateMassLaunch(req: Request, res: Response): void {
  try {
    const updated = MassLaunchStore.update(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ success: true, item: updated });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

export function deleteMassLaunch(req: Request, res: Response): void {
  try {
    const deleted = MassLaunchStore.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

export async function previewMassLaunchTime(req: Request, res: Response): Promise<void> {
  try {
    const configId = req.query.configId as string;
    let jsonPath = (req.query.jsonPath as string || '').trim();
    if (!jsonPath) {
      res.json({ success: true, projectTimes: [], summary: null });
      return;
    }
    if (!jsonPath.startsWith('$.')) {
      jsonPath = '$.' + jsonPath;
    }

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

    let targetProjects = projectNames;
    if (configId && configId !== 'all') {
      const config = ConfigStore.getById(configId);
      if (config) {
        targetProjects = [];
        for (const p of projectNames) {
          try {
            const fileCache = loadConfigFiles(config, p, () => {});
            const passed = evaluateConfig(config, p, fileCache, new Set(), {}, {}, () => {});
            if (passed) targetProjects.push(p);
          } catch (e) {}
        }
      }
    }

    const projectTimes: Array<{
      projectName: string;
      rawVal: unknown;
      timestamp: number | null;
      timeStr: string | null;
      dateStr: string | null;
      fullDateTime: string | null;
      relative: string | null;
      isPast: boolean;
      status: 'future' | 'due' | 'not_found' | 'invalid';
    }> = [];

    for (const p of targetProjects) {
      const savePath = path.join(PROJECTS_DIR, `${p}_save.json`);
      if (!fs.existsSync(savePath)) {
        projectTimes.push({
          projectName: p,
          rawVal: null,
          timestamp: null,
          timeStr: null,
          dateStr: null,
          fullDateTime: null,
          relative: null,
          isPast: false,
          status: 'not_found'
        });
        continue;
      }

      try {
        const fileContent = await fs.promises.readFile(savePath, 'utf-8');
        const saveData = JSON.parse(fileContent);
        const resolved = resolvePath(saveData, jsonPath);

        if (!resolved.exists || resolved.value === undefined || resolved.value === null || resolved.value === '') {
          projectTimes.push({
            projectName: p,
            rawVal: null,
            timestamp: null,
            timeStr: null,
            dateStr: null,
            fullDateTime: null,
            relative: null,
            isPast: false,
            status: 'not_found'
          });
          continue;
        }

        const info = parseTimeInfo(resolved.value);
        if (!info) {
          projectTimes.push({
            projectName: p,
            rawVal: resolved.value,
            timestamp: null,
            timeStr: String(resolved.value),
            dateStr: null,
            fullDateTime: String(resolved.value),
            relative: 'некоректний формат часу',
            isPast: false,
            status: 'invalid'
          });
          continue;
        }

        projectTimes.push({
          projectName: p,
          rawVal: resolved.value,
          timestamp: info.timestamp,
          timeStr: info.formatted.split(' ')[0],
          dateStr: null,
          fullDateTime: info.formatted,
          relative: info.formatted.includes('(') ? info.formatted.split('(')[1].replace(')', '') : null,
          isPast: info.timestamp < Date.now(),
          status: info.timestamp < Date.now() ? 'due' : 'future'
        });
      } catch (e) {
        projectTimes.push({
          projectName: p,
          rawVal: null,
          timestamp: null,
          timeStr: null,
          dateStr: null,
          fullDateTime: null,
          relative: 'помилка читання',
          isPast: false,
          status: 'not_found'
        });
      }
    }

    const validWithTs = projectTimes.filter(pt => pt.timestamp !== null);
    validWithTs.sort((a, b) => (a.timestamp! - b.timestamp!));

    let summary = null;
    if (validWithTs.length > 0) {
      const futureRuns = validWithTs.filter(pt => !pt.isPast);
      const nextRun = futureRuns.length > 0 ? futureRuns[0] : validWithTs[0];
      summary = {
        nextProject: nextRun.projectName,
        nextTime: nextRun.timeStr,
        nextDateTime: nextRun.fullDateTime,
        nextRelative: nextRun.relative,
        isPast: nextRun.isPast,
        totalWithTime: validWithTs.length,
        totalProjects: targetProjects.length
      };
    }

    res.json({
      success: true,
      jsonPath,
      projectTimes,
      summary
    });
  } catch (err) {
    logger.error('Failed to preview mass launch time', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to calculate time preview' });
  }
}
