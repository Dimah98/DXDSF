import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { PROJECTS_DIR } from '../constants';
import { schedulerService } from '../services';
import { authMiddleware } from '../auth/AuthMiddleware';
import { csrfMiddleware } from '../auth/CSRFMiddleware';
import { projectQueueManager, getQueueConfig, getRunningProjectsCount } from '../runner/ProjectRunner';

import { writeJsonAtomic, readJsonSafe } from '../utils/fileUtils';

const router = Router();

// GET /api/queue — черга запуску проектів
router.get('/api/queue', authMiddleware, (_req: Request, res: Response) => {
  try {
    const { maxParallel, queueMode } = getQueueConfig();
    res.json({
      queue: projectQueueManager.getQueuedProjects(),
      maxParallel,
      activeRunning: getRunningProjectsCount(),
      queueMode
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get queue' });
  }
});

// GET /api/schedule — повний розклад всіх проектів
router.get('/api/schedule', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const schedule = await schedulerService.getFullSchedule(PROJECTS_DIR);
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get schedule' });
  }
});

// PUT /api/schedule/:projectName — оновити launchSettings проекту
router.put('/api/schedule/:projectName', authMiddleware, csrfMiddleware, async (req: Request, res: Response) => {
  const { projectName } = req.params;
  const { mode, intervalValue, intervalUnit, randomOffsetMinutes, scheduleTime, scheduleDays } = req.body;

  const projectPath = path.join(PROJECTS_DIR, `${projectName}.json`);
  if (!fs.existsSync(projectPath)) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  try {
    const projectData = await readJsonSafe<any>(projectPath, null);
    if (!projectData) {
      res.status(500).json({ error: 'Failed to read project file' });
      return;
    }
    projectData.launchSettings = {
      mode: mode || 'none',
      intervalValue: Number(intervalValue) || 0,
      intervalUnit: intervalUnit || 'hours',
      randomOffsetMinutes: Number(randomOffsetMinutes) || 0,
      scheduleTime: scheduleTime || '09:00',
      scheduleDays: scheduleDays || [],
    };
    await writeJsonAtomic(projectPath, projectData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// DELETE /api/schedule/:projectName/node — скасувати запланований запуск від ноди
router.delete('/api/schedule/:projectName/node', authMiddleware, csrfMiddleware, (req: Request, res: Response) => {
  const { projectName } = req.params;
  schedulerService.removeScheduledRun(projectName, 'node');
  res.json({ success: true });
});

// POST /api/schedule/:projectName/next-run — встановити або змінити час наступного запуску
router.post('/api/schedule/:projectName/next-run', authMiddleware, csrfMiddleware, (req: Request, res: Response) => {
  const { projectName } = req.params;
  const { runAt, delayMinutes } = req.body;

  let targetRunAt: number | null = null;
  if (typeof runAt === 'number') {
    targetRunAt = runAt;
  } else if (typeof delayMinutes === 'number') {
    targetRunAt = Date.now() + delayMinutes * 60 * 1000;
  }

  if (targetRunAt !== null) {
    schedulerService.addScheduledRun(projectName, targetRunAt, 'node');
    res.json({ success: true, nextRun: targetRunAt });
  } else {
    schedulerService.removeScheduledRun(projectName, 'node');
    res.json({ success: true, nextRun: null });
  }
});

export default router;
