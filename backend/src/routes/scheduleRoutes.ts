import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { PROJECTS_DIR } from '../constants';
import { schedulerService } from '../services';
import { authMiddleware } from '../auth/AuthMiddleware';
import { csrfMiddleware } from '../auth/CSRFMiddleware';

const router = Router();

// GET /api/schedule — повний розклад всіх проектів
router.get('/api/schedule', authMiddleware, (_req: Request, res: Response) => {
  try {
    const schedule = schedulerService.getFullSchedule(PROJECTS_DIR);
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get schedule' });
  }
});

// PUT /api/schedule/:projectName — оновити launchSettings проекту
router.put('/api/schedule/:projectName', authMiddleware, csrfMiddleware, (req: Request, res: Response) => {
  const { projectName } = req.params;
  const { mode, intervalValue, intervalUnit, randomOffsetMinutes, scheduleTime, scheduleDays } = req.body;

  const projectPath = path.join(PROJECTS_DIR, `${projectName}.json`);
  if (!fs.existsSync(projectPath)) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  try {
    const projectData = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
    projectData.launchSettings = {
      mode: mode || 'none',
      intervalValue: Number(intervalValue) || 0,
      intervalUnit: intervalUnit || 'hours',
      randomOffsetMinutes: Number(randomOffsetMinutes) || 0,
      scheduleTime: scheduleTime || '09:00',
      scheduleDays: scheduleDays || [],
    };
    fs.writeFileSync(projectPath, JSON.stringify(projectData, null, 2), 'utf-8');
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

export default router;
