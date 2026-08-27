import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';
import { PROJECTS_DIR } from '../constants';
import { MassLaunchStore } from '../scheduler/MassLaunchStore';
import { ConfigStore } from '../configs/ConfigStore';
import { evaluateConfig, loadConfigFiles, resolvePath } from '../configs/ConfigEvaluator';
import { startProject } from './ProjectRunner';
import { getOrCreateSession } from '../browserManager';
import { schedulerService } from '../services';

const logger = new Logger('MassLaunchRunner');

let massLaunchInterval: NodeJS.Timeout | null = null;

const jsonFileCache = new Map<string, { mtimeMs: number; data: any }>();

export async function getCachedJson(filePath: string): Promise<any> {
  try {
    const stats = await fs.promises.stat(filePath);
    const cached = jsonFileCache.get(filePath);
    if (cached && cached.mtimeMs === stats.mtimeMs) {
      return cached.data;
    }
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    jsonFileCache.set(filePath, { mtimeMs: stats.mtimeMs, data });
    return data;
  } catch {
    return null;
  }
}

// Функція для розбору формату часу/дати
export function parseTimeInfo(val: any): { timestamp: number; formatted: string } | null {
  if (val === undefined || val === null || val === '') return null;
  
  if (typeof val === 'number') {
    let ts = val;
    if (ts < 10000000000) {
      ts = ts * 1000;
    }
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      const now = Date.now();
      const diffSec = Math.round((ts - now) / 1000);
      const isPast = diffSec < 0;
      const absDiff = Math.abs(diffSec);
      const m = Math.floor(absDiff / 60);
      const s = absDiff % 60;
      const h = Math.floor(m / 60);
      const remM = m % 60;
      
      let relativeStr = '';
      if (h > 0) {
        relativeStr = isPast ? `${h} год ${remM} хв тому` : `через ${h} год ${remM} хв`;
      } else if (m > 0) {
        relativeStr = isPast ? `${m} хв тому` : `через ${m} хв ${s} с`;
      } else {
        relativeStr = isPast ? `${s} с тому` : `через ${s} с`;
      }
      
      const timeStr = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return { timestamp: ts, formatted: `${timeStr} (${relativeStr})` };
    }
  }
  
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      
      const now = new Date();
      const target = new Date();
      target.setHours(hours, minutes, seconds, 0);
      
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      
      const diffSec = Math.round((target.getTime() - now.getTime()) / 1000);
      const m = Math.floor(diffSec / 60);
      const s = diffSec % 60;
      const h = Math.floor(m / 60);
      const remM = m % 60;
      
      let relativeStr = '';
      if (h > 0) {
        relativeStr = `через ${h} год ${remM} хв`;
      } else if (m > 0) {
        relativeStr = `через ${m} хв ${s} с`;
      } else {
        relativeStr = `через ${s} с`;
      }
      
      return { timestamp: target.getTime(), formatted: `${trimmed} (${relativeStr})` };
    }
    
    const parsedDate = new Date(trimmed);
    if (!isNaN(parsedDate.getTime())) {
      const ts = parsedDate.getTime();
      const now = Date.now();
      const diffSec = Math.round((ts - now) / 1000);
      const isPast = diffSec < 0;
      const absDiff = Math.abs(diffSec);
      const m = Math.floor(absDiff / 60);
      const s = absDiff % 60;
      const h = Math.floor(m / 60);
      const remM = m % 60;
      
      let relativeStr = '';
      if (h > 0) {
        relativeStr = isPast ? `${h} год ${remM} хв тому` : `через ${h} год ${remM} хв`;
      } else if (m > 0) {
        relativeStr = isPast ? `${m} хв тому` : `через ${m} хв ${s} с`;
      } else {
        relativeStr = isPast ? `${s} с тому` : `через ${s} с`;
      }
      
      const timeStr = parsedDate.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return { timestamp: ts, formatted: `${timeStr} (${relativeStr})` };
    }
  }
  
  return null;
}

// Функція для запуску проекту за іменем (використовується планувальником нод)
function runScheduledProject(projectName: string): void {
  const session = getOrCreateSession(projectName);
  if (!session.isBotRunning) {
    startProject(projectName).catch(err => {
      logger.error(`[NodeScheduler] Помилка запуску ${projectName}`, err instanceof Error ? err : new Error(String(err)));
    });
  }
}

// Допоміжна функція для збагачення масових запусків додатковою інформацією
export async function enrichMassLaunches(launches: any[]) {
  const files = await fs.promises.readdir(PROJECTS_DIR);
  const allProjectNames = files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
    .filter(name =>
      name !== 'categories' &&
      name !== 'global_building_types' &&
      name !== 'schedule' &&
      name !== 'notifications' &&
      !name.endsWith('_layout') &&
      !name.endsWith('_save') &&
      !name.endsWith('_stats') &&
      !name.endsWith('_logs') &&
      !name.endsWith('_inventory')
    );

  return Promise.all(launches.map(async launch => {
    let matchingProjects = allProjectNames;
    let configName: string | undefined = undefined;

    if (launch.configId) {
      const config = ConfigStore.getById(launch.configId);
      if (config) {
        configName = config.name;
        if (config.enabled !== false) {
          const matching: string[] = [];
          for (const p of allProjectNames) {
            try {
              const fileCache = loadConfigFiles(config, p, () => {});
              const passed = evaluateConfig(config, p, fileCache, new Set(), {}, {}, () => {});
              if (passed) matching.push(p);
            } catch (e) {}
          }
          matchingProjects = matching;
        }
      }
    }

    const projectsWithTime: any[] = [];
    if (launch.mode === 'json_time' && launch.jsonPath) {
      for (const p of matchingProjects) {
        const savePath = path.join(PROJECTS_DIR, `${p}_save.json`);
        let timeFormatted: string | null = null;
        let timestamp: number | null = null;

        try {
          const data = await getCachedJson(savePath);
          if (data) {
            const resolved = resolvePath(data, launch.jsonPath);
            if (resolved.exists && resolved.value !== undefined && resolved.value !== null && resolved.value !== '') {
              const parsed = parseTimeInfo(resolved.value);
              if (parsed) {
                timeFormatted = parsed.formatted;
                timestamp = parsed.timestamp;
              }
            }
          }
        } catch (e) {}

        projectsWithTime.push({
          projectName: p,
          time: timeFormatted,
          timestamp: timestamp
        });
      }
    }

    return {
      ...launch,
      configName,
      matchingProjectsCount: matchingProjects.length,
      matchingProjects: matchingProjects,
      projectsWithTime: projectsWithTime.length > 0 ? projectsWithTime : undefined
    };
  }));
}

// Функція періодичної перевірки та запуску задач за розкладом масових запусків
export async function checkAndRunMassLaunches() {
  try {
    // === Перевірка планових запусків від ноди setNextRunNode ===
    const nodeScheduledProjects = schedulerService.checkAndGetProjectsToRun(PROJECTS_DIR);
    for (const projectName of nodeScheduledProjects) {
      logger.info(`[NodeScheduler] Запуск проекту ${projectName} за розкладом від ноди`);
      runScheduledProject(projectName);
    }

    const rawLaunches = MassLaunchStore.getAll();
    const activeLaunches = rawLaunches.filter(l => l.enabled !== false);
    if (activeLaunches.length === 0) return;

    const files = await fs.promises.readdir(PROJECTS_DIR);
    const allProjectNames = files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .filter(name =>
        name !== 'categories' &&
        name !== 'global_building_types' &&
        name !== 'schedule' &&
        name !== 'notifications' &&
        !name.endsWith('_layout') &&
        !name.endsWith('_save') &&
        !name.endsWith('_stats') &&
        !name.endsWith('_logs') &&
        !name.endsWith('_inventory')
      );

    const now = new Date();
    const nowMs = now.getTime();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    for (const launch of activeLaunches) {
      let matchingProjects = allProjectNames;
      if (launch.configId) {
        const config = ConfigStore.getById(launch.configId);
        if (config && config.enabled !== false) {
          const matching: string[] = [];
          for (const p of allProjectNames) {
            try {
              const fileCache = loadConfigFiles(config, p, () => {});
              const passed = evaluateConfig(config, p, fileCache, new Set(), {}, {}, () => {});
              if (passed) matching.push(p);
            } catch (e) {}
          }
          matchingProjects = matching;
        }
      }

      if (matchingProjects.length === 0) continue;

      if (launch.mode === 'manual_time') {
        if (!launch.time) continue;
        const [targetHours, targetMinutes] = launch.time.split(':').map(Number);
        if (isNaN(targetHours) || isNaN(targetMinutes)) continue;

        if (currentHours === targetHours && currentMinutes === targetMinutes) {
          if (launch.lastRunTime && (nowMs - launch.lastRunTime) < 70000) {
            continue;
          }

          logger.info(`[MassScheduler] Запуск масової задачі «${launch.name}» (${launch.time}) для ${matchingProjects.length} проектів`);
          MassLaunchStore.update(launch.id, { lastRunTime: nowMs });

          for (const projectName of matchingProjects) {
            const session = getOrCreateSession(projectName);
            if (session.isBotRunning) {
              logger.info(`[MassScheduler] Проект ${projectName} вже працює — пропускаємо`);
              continue;
            }
            logger.info(`[MassScheduler] Старт проекту ${projectName} за масовим розкладом «${launch.name}» (контейнери: ${launch.containers && launch.containers.length > 0 ? launch.containers.join(', ') : 'всі'})`);
            startProject(projectName, undefined, launch.containers).catch(err => {
              logger.error(`[MassScheduler] Помилка старту проекту ${projectName}`, err instanceof Error ? err : new Error(String(err)));
            });
          }
        }
      } else if (launch.mode === 'json_time') {
        if (!launch.jsonPath) continue;

        const projectLastRuns = { ...(launch.projectLastRuns || {}) };
        let updatedProjectRuns = false;

        for (const projectName of matchingProjects) {
          const savePath = path.join(PROJECTS_DIR, `${projectName}_save.json`);

          try {
            const data = await getCachedJson(savePath);
            if (!data) continue;

            const resolved = resolvePath(data, launch.jsonPath);
            if (!resolved.exists || resolved.value === undefined || resolved.value === null || resolved.value === '') {
              continue;
            }

            const info = parseTimeInfo(resolved.value);
            if (!info || !info.timestamp) continue;

            const timeDiff = info.timestamp - nowMs;
            if (timeDiff <= 0 && timeDiff >= -120000) {
              const lastRun = projectLastRuns[projectName];
              if (lastRun && (nowMs - lastRun) < 120000) {
                continue;
              }

              const session = getOrCreateSession(projectName);
              if (session.isBotRunning) {
                continue;
              }

              logger.info(`[MassScheduler JSON] Старт проекту ${projectName} за даними JSON «${launch.name}» (час: ${info.formatted})`);
              projectLastRuns[projectName] = nowMs;
              updatedProjectRuns = true;

              startProject(projectName, undefined, launch.containers).catch(err => {
                logger.error(`[MassScheduler JSON] Помилка старту проекту ${projectName}`, err instanceof Error ? err : new Error(String(err)));
              });
            }
          } catch (e) {
            logger.debug(`[MassScheduler] Помилка обробки JSON для ${projectName}`, { error: String(e) });
          }
        }

        if (updatedProjectRuns) {
          MassLaunchStore.update(launch.id, { projectLastRuns, lastRunTime: nowMs });
        }
      }
    }
  } catch (err) {
    logger.error('Error in checkAndRunMassLaunches', err instanceof Error ? err : new Error(String(err)));
  }
}

// Запуск та зупинка фонового планувальника
export function startMassLaunchScheduler(intervalMs: number = 10000): void {
  if (massLaunchInterval) return;
  massLaunchInterval = setInterval(checkAndRunMassLaunches, intervalMs);
  logger.info(`Mass launch scheduler started (interval: ${intervalMs}ms)`);
}

export function stopMassLaunchScheduler(): void {
  if (massLaunchInterval) {
    clearInterval(massLaunchInterval);
    massLaunchInterval = null;
    logger.info('Mass launch scheduler stopped');
  }
}
