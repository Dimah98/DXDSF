import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';
import { PROJECTS_DIR, SAVE_PATH } from '../constants';
import { inputValidator } from '../validation/InputValidator';
import { RunLogger } from '../RunLogger';
import {
  sessions,
  getOrCreateSession,
  isSessionBrowserAlive
} from '../browserManager';
import {
  upsertProject,
  deleteProject
} from '../db/schema';
import {
  startProject,
  stopProject
} from '../runner/ProjectRunner';

import { schedulerService } from '../services';

const XP_TABLE_MAP: Record<number, number> = {
  1: 0, 2: 2, 3: 22, 4: 205, 5: 555, 6: 1155, 7: 2155, 8: 3405, 9: 5405, 10: 7905,
  11: 10905, 12: 14405, 13: 18405, 14: 22905, 15: 27905, 16: 33655, 17: 40155, 18: 47405, 19: 55405, 20: 64155,
  21: 73905, 22: 84655, 23: 96405, 24: 109155, 25: 122905, 26: 137405, 27: 152905, 28: 169405, 29: 186905, 30: 205405,
  31: 225405, 32: 246905, 33: 269905, 34: 294405, 35: 320405, 36: 348405, 37: 378405, 38: 410405, 39: 444405, 40: 480405,
  41: 518905, 42: 559905, 43: 603405, 44: 649405, 45: 697905, 46: 749405, 47: 803905, 48: 861405, 49: 921905, 50: 985405,
  51: 1053905, 52: 1127405, 53: 1205905, 54: 1289405, 55: 1377905, 56: 1476405, 57: 1584905, 58: 1703405, 59: 1831905, 60: 1970405,
  61: 2128905, 62: 2287405, 63: 2485905, 64: 2704405, 65: 2942905, 66: 3221405, 67: 3539905, 68: 3898405, 69: 4296905, 70: 4735405,
  71: 5233905, 72: 5743905, 73: 6263905, 74: 6793905, 75: 7333905, 76: 7883905, 77: 8443905, 78: 9013905, 79: 9593905, 80: 10183905,
  81: 10783905, 82: 11393905, 83: 12013905, 84: 12643905, 85: 13283905, 86: 13933905, 87: 14593905, 88: 15263905, 89: 15943905, 90: 16633905,
  91: 17333905, 92: 18043905, 93: 18763905, 94: 19493905, 95: 20233905, 96: 20983905, 97: 21743905, 98: 22513905, 99: 23293905, 100: 24083905
};

const logger = new Logger('ProjectsController');

export async function getProjects(_req: Request, res: Response): Promise<void> {
  try {
    const files = await fs.promises.readdir(PROJECTS_DIR);
    const projectFiles = files.filter(f => {
      if (!f.endsWith('.json')) return false;
      const name = f.replace('.json', '');
      if (name === 'categories' || name === 'global_building_types') return false;
      if (name.endsWith('_layout') || name.endsWith('_save')) return false;
      if (name.endsWith('_stats') || name.endsWith('_logs') || name.endsWith('_inventory')) return false;
      if (name.includes('schedule') || name.includes('notifications')) return false;
      return true;
    });
    const projectNames = projectFiles.map(f => f.replace('.json', ''));
    projectNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    res.json(projectNames);
  } catch (err: any) { 
    logger.error('Failed to read projects directory', err instanceof Error ? err : new Error(String(err)), { path: PROJECTS_DIR });
    res.status(500).json({ success: false, error: 'Failed to load project list. Please try again later.' }); 
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const name = req.params.name;
    if (name === 'status') {
      return next();
    }
    const validation = inputValidator.validateProjectName(name);
    if (!validation.isValid) {
      res.status(400).json({ success: false, error: validation.error });
      return;
    }

    const projectPath = path.join(PROJECTS_DIR, `${name}.json`);
    if (!fs.existsSync(projectPath)) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const fileContent = await fs.promises.readFile(projectPath, 'utf-8');
    const projectData = JSON.parse(fileContent);

    res.json({
      success: true,
      data: {
        nodes: Array.isArray(projectData.nodes) ? projectData.nodes : [],
        edges: Array.isArray(projectData.edges) ? projectData.edges : [],
        variables: projectData.variables || {}
      },
      error: null
    });
  } catch (err: any) {
    logger.error('Failed to get project by name', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load project' });
  }
}

export async function getProjectContainers(req: Request, res: Response): Promise<void> {
  try {
    const { projectName } = req.params;
    const projectPath = path.join(PROJECTS_DIR, `${projectName}.json`);
    if (!fs.existsSync(projectPath)) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }
    const content = await fs.promises.readFile(projectPath, 'utf-8');
    const projectData = JSON.parse(content);
    const nodes = Array.isArray(projectData.nodes) ? projectData.nodes : [];
    const containers: string[] = [];
    for (const node of nodes) {
      if (node.type === 'containerNode' || node.type === 'groupNode') {
        const name = node.data?.title || node.data?.label || node.id;
        if (name && !containers.includes(name)) {
          containers.push(name);
        }
      }
    }
    res.json({ success: true, containers });
  } catch (err) {
    logger.error('Failed to get containers', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load containers' });
  }
}

export function getProjectsStatus(_req: Request, res: Response): void {
  try {
    const statusMap: Record<string, { isRunning: boolean; activeNodeTitle: string | null; isBrowserOpen: boolean }> = {};
    sessions.forEach((session, projectName) => {
      statusMap[projectName] = {
        isRunning: session.isBotRunning,
        activeNodeTitle: session.lastActiveNodeTitle,
        isBrowserOpen: isSessionBrowserAlive(session)
      };
    });
    res.json(statusMap);
  } catch (err: any) {
    logger.error('Projects status endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to retrieve project status. Please try again later.' });
  }
}

export async function getProjectRuns(req: Request, res: Response): Promise<void> {
  try {
    const { name } = req.params;
    const validation = inputValidator.validateProjectName(name);
    if (!validation.isValid) {
      res.status(400).json({ success: false, error: validation.error });
      return;
    }
    const runs = RunLogger.getRuns(name);
    runs.sort((a, b) => b.startTime - a.startTime);
    res.json({ success: true, runs });
  } catch (err: any) {
    logger.error(`Failed to get runs for project ${req.params.name}`, err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to retrieve project runs' });
  }
}

export async function getProjectRunLogs(req: Request, res: Response): Promise<void> {
  try {
    const { name, runId } = req.params;
    const validation = inputValidator.validateProjectName(name);
    if (!validation.isValid) {
      res.status(400).send('Invalid project name');
      return;
    }
    if (!runId || typeof runId !== 'string') {
      res.status(400).send('Invalid runId');
      return;
    }
    const logs = RunLogger.getRunLogs(name, runId);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(logs);
  } catch (err: any) {
    logger.error(`Failed to get run logs for project ${req.params.name}, run ${req.params.runId}`, err instanceof Error ? err : new Error(String(err)));
    res.status(500).send('Error reading run logs');
  }
}

export async function loadProject(req: Request, res: Response): Promise<void> {
  try {
    const name = req.query.name as string || 'default';
    const validation = inputValidator.validateProjectName(name);
    if (!validation.isValid) {
      logger.warn('Load project failed: invalid project name', { name });
      res.status(400).json({ success: false, error: validation.error });
      return;
    }
    
    const session = getOrCreateSession(name);
    const projectPath = path.join(PROJECTS_DIR, `${name}.json`);
    
    let pathToRead: string | null = null;
    try {
      if (fs.existsSync(projectPath)) {
        pathToRead = projectPath;
      } else if (fs.existsSync(SAVE_PATH)) {
        pathToRead = SAVE_PATH;
      }
    } catch (err) {
      logger.error('Failed to check file existence', err instanceof Error ? err : new Error(String(err)), { projectPath, savePath: SAVE_PATH });
    }
    
    if (!pathToRead) {
      logger.info('No project file found, returning empty structure', { projectName: name });
      res.json({ nodes: [], edges: [], variables: {} });
      return;
    }
    
    let projectData: any;
    try {
      const fileContent = await fs.promises.readFile(pathToRead, 'utf-8');
      projectData = JSON.parse(fileContent);
    } catch (parseErr) {
      logger.error(`Failed to read or parse project file`, parseErr instanceof Error ? parseErr : new Error(String(parseErr)), { path: pathToRead });
      res.status(500).json({ success: false, error: 'Failed to load project. The project file may be corrupted.' });
      return;
    }
    
    const rawVars = projectData.variables;
    if (rawVars && typeof rawVars === 'object') {
      if ('lastProject' in rawVars && 'variables' in rawVars) {
        session.globalVariables = rawVars.variables || {};
      } else {
        session.globalVariables = rawVars;
      }
      const msg = JSON.stringify({ type: 'GLOBAL_VARIABLES_UPDATE', variables: session.globalVariables });
      if (session.activeWs && session.activeWs.readyState === 1) {
        session.activeWs.send(msg);
      }
    }
    
    res.json(projectData);
  } catch (err: any) { 
    logger.error('Load project error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load project. Please try again later.' }); 
  }
}

export async function saveProject(req: Request, res: Response): Promise<void> {
  try {
    const { name, data } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }
    
    const validation = inputValidator.validateProjectName(name);
    if (!validation.isValid) {
      logger.warn('Save project failed: invalid project name', { name });
      res.status(400).json({ success: false, error: validation.error });
      return;
    }
    
    const session = getOrCreateSession(name);
    
    if (!data || typeof data !== 'object') {
      res.status(400).json({ success: false, error: 'Invalid project data structure' });
      return;
    }
    
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      res.status(400).json({ success: false, error: 'Project must contain nodes and edges arrays' });
      return;
    }
    
    const vars = (data.variables && typeof data.variables === 'object' && Object.keys(data.variables).length > 0)
      ? data.variables 
      : session.globalVariables;
    
    if (data.variables && typeof data.variables === 'object') {
      session.globalVariables = { ...session.globalVariables, ...data.variables };
    }
    
    const filePath = path.join(PROJECTS_DIR, `${name}.json`);

    let existingSettings: any = {};
    try {
      if (fs.existsSync(filePath)) {
        const existingContent = await fs.promises.readFile(filePath, 'utf-8');
        existingSettings = JSON.parse(existingContent);
      }
    } catch (e) {
      logger.warn(`Failed to read existing project file`, { projectName: name, error: String(e) });
    }

    const launchSettings = data.launchSettings || existingSettings.launchSettings || {};
    const browserSettings = data.browserSettings || existingSettings.browserSettings || {};

    const projectData = {
      nodes: data.nodes || [],
      edges: data.edges || [],
      variables: vars,
      launchSettings,
      browserSettings,
      updatedAt: Date.now()
    };
    
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(projectData, null, 2), 'utf-8');
      logger.info(`Project saved successfully`, { projectName: name, variableCount: Object.keys(vars).length });
    } catch (writeErr) {
      logger.error('Failed to write project file', writeErr instanceof Error ? writeErr : new Error(String(writeErr)), { path: filePath });
      res.status(500).json({ success: false, error: 'Failed to save project. Please try again.' });
      return;
    }

    try {
      upsertProject(name, filePath, undefined, projectData.updatedAt);
    } catch (dbErr) {
      logger.warn('Failed to upsert project in SQLite', { projectName: name, error: String(dbErr) });
    }
    
    if (name === 'default') {
      try {
        await fs.promises.writeFile(SAVE_PATH, JSON.stringify(projectData, null, 2), 'utf-8');
      } catch (backupErr) {
        logger.warn('Failed to write backup file', { path: SAVE_PATH, error: String(backupErr) });
      }
    }
    
    res.json({ success: true });
  } catch (err: any) { 
    logger.error('Save project error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to save project. Please try again later.' }); 
  }
}

export async function deleteProjectHandler(req: Request, res: Response): Promise<void> {
  try {
    const name = req.params.name;
    
    const validation = inputValidator.validateProjectName(name);
    if (!validation.isValid) {
      logger.warn('Delete project failed: invalid project name', { name });
      res.status(400).json({ success: false, error: validation.error });
      return;
    }
    
    const filePath = path.join(PROJECTS_DIR, `${name}.json`);
    
    let fileExists = false;
    try {
      fileExists = fs.existsSync(filePath);
    } catch (err) {
      logger.error('Failed to check project file existence', err instanceof Error ? err : new Error(String(err)), { path: filePath });
      res.status(500).json({ success: false, error: 'Failed to check project existence. Please try again.' });
      return;
    }
    
    if (!fileExists) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }
    
    try {
      await fs.promises.unlink(filePath);
      logger.info('Project file deleted', { projectName: name });
    } catch (deleteErr) {
      logger.error('Failed to delete project file', deleteErr instanceof Error ? deleteErr : new Error(String(deleteErr)), { path: filePath });
      res.status(500).json({ success: false, error: 'Failed to delete project. Please try again.' });
      return;
    }
    
    try {
      deleteProject(name);
    } catch (dbErr) {
      logger.warn('Failed to delete project from SQLite', { projectName: name, error: String(dbErr) });
    }

    const statsPath = path.join(PROJECTS_DIR, `${name}_stats.json`);
    try {
      if (fs.existsSync(statsPath)) {
        await fs.promises.unlink(statsPath);
        logger.info('Project stats file deleted', { projectName: name });
      }
    } catch (statsErr) {
      logger.warn('Failed to delete stats file', { path: statsPath, error: String(statsErr) });
    }
    
    sessions.delete(name);

    logger.info('Project deleted successfully', { projectName: name });
    res.json({ success: true });
  } catch (err: any) { 
    logger.error('Delete project error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to delete project. Please try again later.' }); 
  }
}

export async function runMultipleProjects(req: Request, res: Response): Promise<void> {
  try {
    const { projectNames, projectSettings } = req.body;
    
    if (!projectNames || !Array.isArray(projectNames)) {
      res.status(400).json({ success: false, error: 'projectNames must be an array of strings' });
      return;
    }

    for (const name of projectNames) {
      const validation = inputValidator.validateProjectName(name);
      if (!validation.isValid) {
        logger.warn('Run-multiple failed: invalid project name', { name });
        res.status(400).json({ success: false, error: `Invalid project name: ${name}` });
        return;
      }
    }

    const results: Record<string, boolean> = {};
    
    const launchPromises = projectNames.map(async (name) => {
      try {
        const overrideSettings = projectSettings && projectSettings[name] ? projectSettings[name] : undefined;
        
        const result = await startProject(name, undefined, undefined, overrideSettings);
        
        results[name] = result.started || result.queued;
        return { name, success: result.started || result.queued, queued: result.queued };
      } catch (err) {
        logger.error(`Failed to launch project ${name} in parallel run`, err instanceof Error ? err : new Error(String(err)));
        results[name] = false;
        return { name, success: false, error: String(err) };
      }
    });
    
    await Promise.all(launchPromises);
    res.json({ success: true, results });
  } catch (err: any) {
    logger.error('Run-multiple endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to run multiple projects. Please try again later.' });
  }
}

export async function stopMultipleProjects(req: Request, res: Response): Promise<void> {
  try {
    const { projectNames } = req.body;
    
    if (!projectNames || !Array.isArray(projectNames)) {
      res.status(400).json({ success: false, error: 'projectNames must be an array of strings' });
      return;
    }

    for (const name of projectNames) {
      const validation = inputValidator.validateProjectName(name);
      if (!validation.isValid) {
        logger.warn('Stop-multiple failed: invalid project name', { name });
        res.status(400).json({ success: false, error: `Invalid project name: ${name}` });
        return;
      }
    }

    const results: Record<string, boolean> = {};
    for (const name of projectNames) {
      results[name] = await stopProject(name);
    }

    res.json({ success: true, results });
  } catch (err: any) {
    logger.error('Stop-multiple endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to stop multiple projects. Please try again later.' });
  }
}

export async function copyNodes(req: Request, res: Response): Promise<void> {
  try {
    const { sourceProject, targetProjects } = req.body;
    if (!sourceProject || typeof sourceProject !== 'string') {
      res.status(400).json({ success: false, error: 'Потрібно вказати джерельний проект (sourceProject)' });
      return;
    }
    if (!targetProjects || !Array.isArray(targetProjects) || targetProjects.length === 0) {
      res.status(400).json({ success: false, error: 'Потрібно вказати масив цільових проектів (targetProjects)' });
      return;
    }

    const sourcePath = path.join(PROJECTS_DIR, `${sourceProject}.json`);
    if (!fs.existsSync(sourcePath)) {
      res.status(404).json({ success: false, error: `Джерельний проект «${sourceProject}» не знайдено` });
      return;
    }

    const sourceContent = await fs.promises.readFile(sourcePath, 'utf-8');
    const sourceData = JSON.parse(sourceContent);
    const nodes = sourceData.nodes || [];
    const edges = sourceData.edges || [];

    let updated = 0;
    const errors: string[] = [];

    for (const target of targetProjects) {
      if (target === sourceProject) continue;
      try {
        const targetPath = path.join(PROJECTS_DIR, `${target}.json`);
        let targetData: any = {};
        if (fs.existsSync(targetPath)) {
          const targetContent = await fs.promises.readFile(targetPath, 'utf-8');
          targetData = JSON.parse(targetContent);
        }

        targetData.nodes = nodes;
        targetData.edges = edges;
        targetData.updatedAt = new Date().toISOString();

        await fs.promises.writeFile(targetPath, JSON.stringify(targetData, null, 2), 'utf-8');
        updated++;
        logger.info(`Successfully copied nodes from ${sourceProject} to ${target}`);
      } catch (err: any) {
        logger.error(`Failed to copy nodes to project ${target}`, err);
        errors.push(target);
      }
    }

    res.json({
      success: true,
      updated,
      errors
    });
  } catch (err: any) {
    logger.error('Copy-nodes endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Не вдалося скопіювати ноди. Спробуйте пізніше.' });
  }
}

export async function runSequentialProjects(req: Request, res: Response): Promise<void> {
  try {
    const { projectNames, projectSettings } = req.body;
    if (!projectNames || !Array.isArray(projectNames) || projectNames.length === 0) {
      res.status(400).json({ success: false, error: 'Потрібно вказати масив projectNames' });
      return;
    }

    (async () => {
      for (const name of projectNames) {
        try {
          const overrideSettings = projectSettings && projectSettings[name] ? projectSettings[name] : undefined;
          logger.info(`Sequential queue: starting project ${name}`);
          const result = await startProject(name, undefined, undefined, overrideSettings);
          if (!result.started && !result.queued) {
            logger.warn(`Sequential queue: failed to start project ${name}, skipping to next`);
            continue;
          }

          const session = getOrCreateSession(name);
          while (session.isBotRunning) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          logger.info(`Sequential queue: project ${name} finished`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err) {
          logger.error(`Sequential queue error for project ${name}`, err instanceof Error ? err : new Error(String(err)));
        }
      }
    })().catch(e => logger.error('Sequential runner background error', e));

    res.json({ success: true, message: 'Послідовний запуск розпочато' });
  } catch (err: any) {
    logger.error('Run-sequential endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Не вдалося запустити проекти послідовно' });
  }
}

export async function getProjectsOverview(_req: Request, res: Response): Promise<void> {
  try {
    const files = await fs.promises.readdir(PROJECTS_DIR);
    const projectFiles = files.filter(f => {
      if (!f.endsWith('.json')) return false;
      const name = f.replace('.json', '');
      if (name === 'categories' || name === 'global_building_types') return false;
      if (name.endsWith('_layout') || name.endsWith('_save')) return false;
      if (name.endsWith('_stats') || name.endsWith('_logs') || name.endsWith('_inventory')) return false;
      if (name.includes('schedule') || name.includes('notifications')) return false;
      return true;
    });
    const projectNames = projectFiles.map(f => f.replace('.json', ''));
    projectNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    let schedulesMap: Record<string, any> = {};
    try {
      const schedules = schedulerService.getFullSchedule(PROJECTS_DIR);
      if (Array.isArray(schedules)) {
        schedules.forEach((s: any) => {
          if (s && s.projectName) {
            schedulesMap[s.projectName] = s;
          }
        });
      }
    } catch (_) {}

    const isToday = (ts: any): boolean => {
      const millis = typeof ts === 'number' ? ts : Number(ts);
      if (!millis || isNaN(millis) || millis <= 0) return false;
      const now = new Date();
      const currentHour = now.getHours();
      const gameDay = new Date(now);
      if (currentHour < 3) {
        gameDay.setDate(gameDay.getDate() - 1);
      }
      gameDay.setHours(3, 0, 0, 0);
      const gameDayStart = gameDay.getTime();
      return millis >= gameDayStart;
    };

    const extractVFarm = (data: any): any => {
      if (!data || typeof data !== 'object') return null;
      if (data.visitedFarmState) return data.visitedFarmState;
      if (Array.isArray(data.nodes)) {
        for (const node of data.nodes) {
          if (node.data?.visitedFarmState) return node.data.visitedFarmState;
          if (Array.isArray(node.data?.subNodes)) {
            for (const sub of node.data.subNodes) {
              if (sub.data?.visitedFarmState) return sub.data.visitedFarmState;
            }
          }
        }
      }
      return null;
    };

    const overviewList = await Promise.all(
      projectNames.map(async (name) => {
        const session = sessions.get(name);
        const isRunning = session ? session.isBotRunning : false;
        const activeNodeTitle = session ? session.lastActiveNodeTitle || null : null;
        const isBrowserOpen = session ? isSessionBrowserAlive(session) : false;

        const sched = schedulesMap[name];
        const nextRun = sched && sched.nextRun ? sched.nextRun : null;
        const plannedNodeRun = sched && sched.plannedRuns && sched.plannedRuns[0] ? sched.plannedRuns[0].runAt : null;

        let saveData: any = null;
        let projData: any = null;
        const savePath = path.join(PROJECTS_DIR, `${name}_save.json`);
        const projPath = path.join(PROJECTS_DIR, `${name}.json`);

        try {
          if (fs.existsSync(savePath)) {
            const raw = await fs.promises.readFile(savePath, 'utf-8');
            saveData = JSON.parse(raw);
          }
        } catch (_) {}

        try {
          if (fs.existsSync(projPath)) {
            const raw = await fs.promises.readFile(projPath, 'utf-8');
            projData = JSON.parse(raw);
            if (!saveData) saveData = projData;
          }
        } catch (_) {}

        let vFarm = extractVFarm(saveData) || saveData?.visitedFarmState || saveData || {};
        if (projData) {
          const projVFarm = extractVFarm(projData) || projData.visitedFarmState || projData;
          if (projVFarm && typeof projVFarm === 'object') {
            vFarm = { ...projVFarm, ...vFarm };
            if (!vFarm.dailyRewards && projVFarm.dailyRewards) vFarm.dailyRewards = projVFarm.dailyRewards;
            if (!vFarm.shipments && projVFarm.shipments) vFarm.shipments = projVFarm.shipments;
            if (!vFarm.floatingIsland && projVFarm.floatingIsland) vFarm.floatingIsland = projVFarm.floatingIsland;
            if (!vFarm.delivery && projVFarm.delivery) vFarm.delivery = projVFarm.delivery;
            if (!vFarm.minigames && projVFarm.minigames) vFarm.minigames = projVFarm.minigames;
            if (!vFarm.bumpkin && projVFarm.bumpkin) vFarm.bumpkin = projVFarm.bumpkin;
            if (!vFarm.calendar && projVFarm.calendar) vFarm.calendar = projVFarm.calendar;
            if (!vFarm.season && projVFarm.season) vFarm.season = projVFarm.season;
          }
        }
        const inventory = vFarm.inventory || {};

        let level: number | null = null;
        const experience = vFarm.bumpkin?.experience;
        if (experience !== undefined && experience !== null) {
          const exp = Number(experience) || 0;
          level = 1;
          for (let l = 1; l <= 150; l++) {
            const req = XP_TABLE_MAP[l];
            if (req !== undefined && exp >= req) {
              level = l;
            } else {
              break;
            }
          }
        }

        let gold: number | null = null;
        if (vFarm.coins !== undefined) {
          gold = Number(vFarm.coins) || 0;
        } else if (inventory.Gold !== undefined) {
          gold = Number(inventory.Gold) || 0;
        }

        let balance: number | null = null;
        if (inventory.Flower !== undefined) {
          balance = Number(inventory.Flower) || 0;
        } else if (inventory.FLOWER !== undefined) {
          balance = Number(inventory.FLOWER) || 0;
        } else if (vFarm.balance !== undefined) {
          balance = Number(vFarm.balance) || 0;
        }

        let gem: number | null = null;
        if (inventory.Gem !== undefined) {
          gem = Number(inventory.Gem) || 0;
        }

        let season: string | null = null;
        if (vFarm.season?.season) {
          season = String(vFarm.season.season).toLowerCase();
        } else if (saveData?.season?.season) {
          season = String(saveData.season.season).toLowerCase();
        } else if (vFarm.island?.type) {
          season = String(vFarm.island.type).toLowerCase();
        }

        const isFullMoon = !!(vFarm.calendar?.fullMoon && vFarm.calendar.fullMoon !== 'false');

        const chestCollectedAt = vFarm.dailyRewards?.chest?.collectedAt;
        const shipmentRestockedAt = vFarm.shipments?.restockedAt;
        const petalSolvedAt = vFarm.floatingIsland?.petalPuzzleSolvedAt;

        const hasChestCollectedToday = isToday(chestCollectedAt);
        const hasShipmentRestockedToday = isToday(shipmentRestockedAt);
        const hasPetalPuzzleSolvedToday = isToday(petalSolvedAt);

        const miniImages: [string, number | null][] = [];
        if (hasPetalPuzzleSolvedToday) {
          miniImages.push(['llow.png', null]);
        }
        if (hasShipmentRestockedToday) {
          miniImages.push(['ppopow.png', null]);
        }
        const orders = vFarm.delivery?.orders;
        if (Array.isArray(orders)) {
          let count = 0;
          for (const order of orders) {
            if (order && isToday(order.completedAt)) count++;
          }
          if (count > 0) miniImages.push(['mmisi.png', count]);
        }
        const minigames = vFarm.minigames?.games;
        if (minigames) {
          const moleHist = minigames['mine-whack']?.history;
          if (moleHist && typeof moleHist === 'object') {
            const keys = Object.keys(moleHist).sort();
            const lastKey = keys[keys.length - 1];
            if (lastKey && isToday(moleHist[lastKey]?.prizeClaimedAt)) {
              miniImages.push(['mmine.png', null]);
            }
          }
          const memHist = minigames.memory?.history;
          if (memHist && typeof memHist === 'object') {
            const keys = Object.keys(memHist).sort();
            const lastKey = keys[keys.length - 1];
            if (lastKey && isToday(memHist[lastKey]?.prizeClaimedAt)) {
              miniImages.push(['mmemori.png', null]);
            }
          }
          const templeHist = minigames['chaacs-temple']?.history;
          if (templeHist && typeof templeHist === 'object') {
            const keys = Object.keys(templeHist).sort();
            const lastKey = keys[keys.length - 1];
            if (lastKey && isToday(templeHist[lastKey]?.prizeClaimedAt)) {
              miniImages.push(['cchaacs.png', null]);
            }
          }
        }

        return {
          name,
          isRunning,
          isBrowserOpen,
          activeNodeTitle,
          nextRun,
          plannedNodeRun,
          level,
          gold,
          balance,
          gem,
          season,
          isFullMoon,
          hasChestCollectedToday,
          hasShipmentRestockedToday,
          hasPetalPuzzleSolvedToday,
          miniImages
        };
      })
    );

    res.json(overviewList);
  } catch (err: any) {
    logger.error('Failed to get projects overview', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load projects overview' });
  }
}
