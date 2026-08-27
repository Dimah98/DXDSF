import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';
import { RunLogger } from '../RunLogger';
import { BotEngine } from '../engine/BotEngine';
import { nodeHandlers } from '../nodes';
import {
  browserLifecycle,
  timerManager,
  memoryMonitor
} from '../services';
import { PROJECTS_DIR, DEFAULT_SAFETY_TIMEOUT_MS } from '../constants';
import { internalConfig } from '../internalConfig';
import {
  sessions,
  getOrCreateSession,
  takeDebugSnapshot,
  connectToBrowser
} from '../browserManager';
import { ProjectSession, ExtendedWebSocket } from '../types';

const logger = new Logger('ProjectRunner');

// Отримує кількість реально запущених зараз ботів у системі
export function getRunningProjectsCount(): number {
  let count = 0;
  for (const session of sessions.values()) {
    if (session.isBotRunning) {
      count++;
    }
  }
  return count;
}

// Отримує статус режиму черги та ліміт паралельних запусків з конфігурації
export function getQueueConfig(): { queueMode: boolean; maxParallel: number } {
  const queueMode = internalConfig.get('queueMode') === 1;
  const maxParallel = Math.max(1, internalConfig.get('maxParallelProjects') || 1);
  return { queueMode, maxParallel };
}

// Допоміжна функція для retry логіки з обмеженням кількості спроб
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 1000,
  context: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (attempt < maxRetries) {
        logger.warn(`${context} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs}ms`, { error: lastError.message });
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        logger.error(`${context} failed after ${maxRetries + 1} attempts`, lastError, { attempts: attempt + 1 });
      }
    }
  }
  
  throw lastError;
}

// Допоміжна функція для надсилання повідомлень логування у веб-сокет клієнта сесії
export const logToClient = (session: ProjectSession, message: string, type: 'info' | 'error' | 'success' | 'debug' = 'info', data?: any) => {
  if (session.currentRunId) {
    RunLogger.logToRun(session.projectName, session.currentRunId, message, type);
  }
  if (session.activeWs && session.activeWs.readyState === 1) {
    session.activeWs.send(JSON.stringify({ type: 'CONSOLE_LOG', message, logType: type, data }));
  }
};

// Допоміжна функція для надсилання стану виконання ноди клієнту сесії
export const broadcastNodeExecuting = (session: ProjectSession, nodeId: string, nodeTitle?: string) => {
  session.lastActiveNodeId = nodeId;
  session.lastActiveNodeTitle = nodeTitle || null;
  const msg = JSON.stringify({ type: 'NODE_EXECUTING', nodeId, nodeTitle });
  if (session.activeWs && session.activeWs.readyState === 1) {
    session.activeWs.send(msg);
  }
};

// Черга запису для серіалізації операцій запису файлів проектів
const writeQueues = new Map<string, Promise<void>>();

export const enqueueWrite = (projectName: string, fn: () => Promise<void>): void => {
  const current = writeQueues.get(projectName) || Promise.resolve();
  const next = current.then(fn).catch(err => {
    logger.error(`Write queue error for project ${projectName}`, err instanceof Error ? err : new Error(String(err)));
  });
  writeQueues.set(projectName, next);
};

// Функція для завантаження налаштувань браузера з файлу проекту
export async function ensureBrowserSettings(projectName: string, session: ProjectSession) {
  try {
    const projectPath = path.join(PROJECTS_DIR, `${projectName}.json`);
    const rawData = await fs.promises.readFile(projectPath, 'utf-8');
    const projectData = JSON.parse(rawData);
    const bs = projectData.browserSettings || projectData.settings || {};
    session.botSettings = { ...session.botSettings, ...bs };
  } catch (err) {
    logger.warn(`Could not read project file for ${projectName} to ensure browser settings`, { error: String(err) });
  }
}

// Функція для збереження змінних проекту та надсилання оновлень клієнту
export const broadcastVariables = (session: ProjectSession) => {
  const msg = JSON.stringify({ type: 'GLOBAL_VARIABLES_UPDATE', variables: session.globalVariables });
  if (session.activeWs && session.activeWs.readyState === 1) {
    session.activeWs.send(msg);
  }

  if (session.nodeRuntimeState) {
    memoryMonitor.limitNodeRuntimeState(session.nodeRuntimeState);
  }

  const timerKey = `${session.projectName}:autoSave`;
  timerManager.clearTimer(timerKey);

  const timer = setTimeout(() => {
    enqueueWrite(session.projectName, async () => {
      const projectPath = path.join(PROJECTS_DIR, `${session.projectName}.json`);
      let fileExists = false;
      try {
        fileExists = fs.existsSync(projectPath);
      } catch (checkErr) {
        logger.error(`Failed to check project file existence for variable save: ${session.projectName}`, checkErr instanceof Error ? checkErr : new Error(String(checkErr)), { path: projectPath });
        return;
      }
      
      if (fileExists) {
        try {
          const raw = await fs.promises.readFile(projectPath, 'utf-8');
          let projectData: any;
          try {
            projectData = JSON.parse(raw);
          } catch (parseErr) {
            logger.error(`Failed to parse project file for variable save: ${session.projectName}`, parseErr instanceof Error ? parseErr : new Error(String(parseErr)));
            return;
          }
          projectData.variables = session.globalVariables;
          await fs.promises.writeFile(projectPath, JSON.stringify(projectData, null, 2));
        } catch (fileErr) {
          logger.error(`Failed to save variables for project ${session.projectName}`, fileErr instanceof Error ? fileErr : new Error(String(fileErr)));
        }
      }
    });
  }, 500);

  timerManager.registerTimer(timerKey, timer);
};

// Функція плавного очікування, яка перевіряє чи бот сесії досі запущений
// Розумна пауза з перевіркою прапорця зупинки
export async function smartSleep(ms: number, ws?: any): Promise<void> {
  const step = 100;
  let remaining = ms;
  while (remaining > 0) {
    if (ws) {
      const isRunning = ws.isSingleNodeRun ? ws.isBotRunning : ws.isBotRunning;
      if (isRunning === false) break;
    }
    const sleepTime = Math.min(step, remaining);
    await new Promise(r => setTimeout(r, sleepTime));
    remaining -= sleepTime;
  }
}

// --- Менеджер Черги Проектів (ProjectQueueManager) ---
export class ProjectQueueManager {
  private queue: Array<{
    projectName: string;
    targetContainers?: string[];
    onStart?: () => void;
    overrideSettings?: Record<string, any>;
  }> = [];
  private isProcessing = false;

  public enqueue(projectName: string, targetContainers?: string[], onStart?: () => void, overrideSettings?: Record<string, any>): void {
    const existingIndex = this.queue.findIndex(item => item.projectName === projectName);
    if (existingIndex !== -1) {
      this.queue[existingIndex] = { projectName, targetContainers, onStart, overrideSettings };
      logger.info(`Updated queue position for project ${projectName}`);
      return;
    }

    this.queue.push({ projectName, targetContainers, onStart, overrideSettings });
    logger.info(`Enqueued project ${projectName}. Queue size: ${this.queue.length}`);
    
    this.processNext();
  }

  public async processNext(): Promise<void> {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;

    const { queueMode, maxParallel } = getQueueConfig();
    const runningCount = getRunningProjectsCount();

    if (queueMode && runningCount >= maxParallel) {
      logger.debug(`[Queue] All slots occupied (${runningCount}/${maxParallel}). Waiting for project to complete.`);
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.isProcessing = true;
    logger.info(`[Queue] Starting queued project ${item.projectName}. Remaining in queue: ${this.queue.length}`);

    try {
      if (item.onStart) item.onStart();
      await executeProjectInternal(item.projectName, item.targetContainers, item.overrideSettings);
    } catch (err: any) {
      logger.error(`[Queue] Failed to start queued project ${item.projectName}`, err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.isProcessing = false;
      const nextRunning = getRunningProjectsCount();
      if (this.queue.length > 0 && (!queueMode || nextRunning < maxParallel)) {
        setImmediate(() => this.processNext());
      }
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getQueuePosition(projectName: string): number {
    const idx = this.queue.findIndex(item => item.projectName === projectName);
    return idx !== -1 ? idx + 1 : 0;
  }

  public getQueuedProjects(): string[] {
    return this.queue.map(item => item.projectName);
  }

  public removeFromQueue(projectName: string): boolean {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(item => item.projectName !== projectName);
    const removed = this.queue.length < initialLength;
    if (removed) {
      logger.info(`Removed project ${projectName} from queue`);
    }
    return removed;
  }
}

export const projectQueueManager = new ProjectQueueManager();

// Функція верхнього рівня для запуску проекту (з повною підтримкою режиму черги)
export async function startProject(
  projectName: string, 
  ws?: ExtendedWebSocket, 
  targetContainers?: string[],
  overrideSettings?: Record<string, any>
): Promise<{ started: boolean; queued: boolean }> {
  const session = getOrCreateSession(projectName);

  if (session.isBotRunning) {
    logger.warn(`Project ${projectName} is already running`);
    logToClient(session, `⚠️ Проект ${projectName} вже працює!`, 'info');
    return { started: false, queued: false };
  }

  if (ws) {
    session.activeWs = ws;
  }

  const { queueMode, maxParallel } = getQueueConfig();
  const runningCount = getRunningProjectsCount();

  if (queueMode && runningCount >= maxParallel) {
    const queuePos = projectQueueManager.getQueueLength() + 1;
    logger.info(`[Queue] Max concurrent projects reached (${runningCount}/${maxParallel}). Enqueuing project ${projectName} (position #${queuePos})`);
    logToClient(session, `⏳ Режим черги: Досягнуто ліміт (${runningCount}/${maxParallel} працюючих). Проект додано в чергу (позиція #${queuePos})...`, 'info');
    
    projectQueueManager.enqueue(projectName, targetContainers, () => {
      logToClient(session, `▶️ Черга дійшла: запуск проекту ${projectName}...`, 'info');
    }, overrideSettings);

    if (session.activeWs && session.activeWs.readyState === 1) {
      session.activeWs.send(JSON.stringify({ 
        type: 'BOT_QUEUED', 
        projectName, 
        queuePosition: queuePos, 
        maxParallel 
      }));
    }

    return { started: false, queued: true };
  }

  const success = await executeProjectInternal(projectName, targetContainers, overrideSettings);
  return { started: success, queued: false };
}

// Внутрішня функція безпосереднього виконання проекту
export async function executeProjectInternal(
  projectName: string, 
  targetContainers?: string[],
  overrideSettings?: Record<string, any>
): Promise<boolean> {
  const session = getOrCreateSession(projectName);

  try {
    const filePath = path.join(PROJECTS_DIR, `${projectName}.json`);
    
    let fileExists = false;
    try {
      fileExists = fs.existsSync(filePath);
    } catch (checkErr) {
      logger.error(`Failed to check project file: ${projectName}`, checkErr instanceof Error ? checkErr : new Error(String(checkErr)));
      return false;
    }

    if (!fileExists) {
      logger.warn(`Project file not found: ${filePath}`);
      return false;
    }

    let fileContent: string;
    try {
      fileContent = await fs.promises.readFile(filePath, 'utf-8');
    } catch (readErr) {
      logger.error(`Failed to read project file: ${projectName}`, readErr instanceof Error ? readErr : new Error(String(readErr)));
      return false;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(fileContent);
    } catch (parseErr) {
      logger.error(`Failed to parse JSON for project: ${projectName}`, parseErr instanceof Error ? parseErr : new Error(String(parseErr)));
      return false;
    }

    const { nodes = [], edges = [], variables = {}, browserSettings = {}, settings = {} } = parsed;

    session.globalVariables = variables || {};
    const bs = browserSettings || settings || {};
    session.botSettings = { ...session.botSettings, ...bs, ...(overrideSettings || {}) };

    let matchingContainers: any[] = [];
    if (targetContainers && targetContainers.length > 0) {
      const containerNodes = nodes.filter((n: any) => n.type === 'containerNode' || n.type === 'groupNode');
      matchingContainers = containerNodes.filter((c: any) => {
        const title = (c.data?.title || c.data?.label || '').trim().toLowerCase();
        const id = (c.id || '').trim().toLowerCase();
        return targetContainers.some((t: string) => {
          const target = t.trim().toLowerCase();
          return title === target || id === target || title.includes(target);
        });
      });

      if (matchingContainers.length === 0) {
        logToClient(session, `⚠️ Жодного контейнера не знайдено за списком: ${targetContainers.join(', ')}`, 'error');
        return false;
      }
      
      const containerNames = matchingContainers.map((c: any) => c.data?.title || c.data?.label || c.id).join('», «');
      logToClient(session, `🎯 Знайдено контейнери для запуску: «${containerNames}»`, 'info');
    }

    session.isBotRunning = true;
    session.isPaused = false;
    session.nodeRuntimeState = new Map();

    const runId = RunLogger.createRun(projectName);
    session.currentRunId = runId;

    if (session.activeWs && session.activeWs.readyState === 1) {
      session.activeWs.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: true, runId }));
    }

    const page = await withRetry(
      () => connectToBrowser(
        session,
        session.botSettings?.width || session.botSettings?.browserWidth,
        session.botSettings?.height || session.botSettings?.browserHeight,
        session.botSettings?.profile,
        session.botSettings?.profileDir,
        session.botSettings?.proxy
      ),
      2,
      2000,
      `Browser connection for ${projectName}`
    );

    browserLifecycle.setupSafetyTimeout(session, DEFAULT_SAFETY_TIMEOUT_MS);

    nodes.forEach((n: any) => {
      if (n.type === 'gateNode' && n.data) {
        n.data.currentCount = 0;
      }
    });

    const wsSender = session.activeWs || ({ send: () => {}, projectName } as any);

    if (matchingContainers.length > 0) {
      (async () => {
        let containerRunStatus: 'success' | 'error' | 'stopped' = 'success';
        let containerErrorMessage: string | undefined = undefined;
        try {
          for (const containerNode of matchingContainers) {
            if (!session.isBotRunning) {
              containerRunStatus = 'stopped';
              containerErrorMessage = 'Зупинено користувачем';
              break;
            }
            const containerLabel = containerNode.data?.title || containerNode.data?.label || containerNode.id;
            logToClient(session, `▶️ [Контейнер] Запуск: «${containerLabel}»`, 'info');

            const groupHandler = (nodeHandlers as any).groupNode || (nodeHandlers as any).containerNode;
            if (groupHandler) {
              const res = await groupHandler({
                currentNode: containerNode,
                activePage: page,
                ws: wsSender,
                context: {},
                globalVariables: session.globalVariables,
                projectName,
                broadcastVariables: () => broadcastVariables(session),
                logToClient: (msg: string, type?: any) => logToClient(session, msg, type),
                takeDebugSnapshot: (nodeId: string, nodeTitle: string, highlight?: any) => takeDebugSnapshot(session, nodeId, nodeTitle, highlight),
                smartSleep,
                nodeRuntimeState: session.nodeRuntimeState,
                nodeHandlers
              });
              if (res?.nextHandle === 'error' || (res?.data && res.data.error)) {
                containerRunStatus = 'error';
                containerErrorMessage = String(res.data?.error || 'Помилка у контейнері');
              }
            }
          }
          if (containerRunStatus === 'success') {
            logToClient(session, `✅ Виконання вибраних контейнерів завершено`, 'success');
          } else if (containerRunStatus === 'stopped') {
            logToClient(session, `🛑 Виконання контейнерів зупинено`, 'info');
          }
        } catch (err: any) {
          containerRunStatus = 'error';
          containerErrorMessage = err.message || String(err);
          logger.error(`Container execution error for ${projectName}`, err instanceof Error ? err : new Error(String(err)));
          logToClient(session, `❌ Помилка виконання контейнера: ${err.message || err}`, 'error');
        } finally {
          if (session.currentRunId) {
            RunLogger.finishRun(projectName, session.currentRunId, containerRunStatus, containerErrorMessage, session.globalVariables);
            session.currentRunId = undefined;
          }
          session.isBotRunning = false;
          session.lastActiveNodeId = null;
          session.lastActiveNodeTitle = null;

          try {
            const statPath = path.join(PROJECTS_DIR, `${projectName}_stats.json`);
            fs.promises.readFile(statPath, 'utf-8')
              .then(raw => {
                try { return JSON.parse(raw); } catch { return []; }
              })
              .catch(() => [])
              .then(stats => {
                stats.push({ 
                  timestamp: Date.now(), 
                  status: containerRunStatus,
                  error: containerErrorMessage,
                  snapshot: JSON.parse(JSON.stringify(session.globalVariables)) 
                });
                return fs.promises.writeFile(statPath, JSON.stringify(stats, null, 2));
              })
              .catch(() => {});
          } catch (err) {}

          await browserLifecycle.closeBrowser(session).catch(closeErr => {
            logger.error(`Failed to close browser after container run for ${projectName}`, closeErr instanceof Error ? closeErr : new Error(String(closeErr)));
          });

          if (session.activeWs && session.activeWs.readyState === 1) {
            session.activeWs.send(JSON.stringify({ type: 'BOT_FINISHED', status: containerRunStatus, error: containerErrorMessage }));
            session.activeWs.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: false }));
          }

          projectQueueManager.processNext();
        }
      })().catch(err => {
        logger.error(`Error in container execution runner for ${projectName}`, err instanceof Error ? err : new Error(String(err)));
        if (session.currentRunId) {
          RunLogger.finishRun(projectName, session.currentRunId, 'error', err.message || String(err));
          session.currentRunId = undefined;
        }
        projectQueueManager.processNext();
      });

      return true;
    }

    const engine = new BotEngine({
      nodes, 
      edges, 
      activePage: page, 
      ws: wsSender, 
      globalVariables: session.globalVariables,
      projectName,
      broadcastVariables: () => broadcastVariables(session),
      logToClient: (msg, type) => logToClient(session, msg, type),
      takeDebugSnapshot: (nodeId, nodeTitle, highlight) => takeDebugSnapshot(session, nodeId, nodeTitle, highlight),
      smartSleep, 
      nodeRuntimeState: session.nodeRuntimeState,
      checkRunning: () => session.isBotRunning,
      nodeHandlers,
      onNodeDisplayUpdate: (nodeId, data) => {
        if (session.activeWs && session.activeWs.readyState === 1) {
          session.activeWs.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId, data }));
        }
      },
      onNodeExecuting: (nodeId, nodeTitle) => {
        session.lastActiveNodeId = nodeId;
        session.lastActiveNodeTitle = nodeTitle || null;
        if (session.activeWs && session.activeWs.readyState === 1) {
          session.activeWs.send(JSON.stringify({ type: 'NODE_EXECUTING', nodeId, nodeTitle }));
        }
      },
      onFinished: (status, errorMessage) => {
        const finalStatus = status || 'success';
        if (session.currentRunId) {
          RunLogger.finishRun(projectName, session.currentRunId, finalStatus, errorMessage, session.globalVariables);
          session.currentRunId = undefined;
        }

        if (finalStatus === 'success') {
          logToClient(session, '✅ Сценарій успішно завершено', 'success');
        } else if (finalStatus === 'stopped') {
          logToClient(session, '🛑 Сценарій зупинено', 'info');
        } else {
          logToClient(session, `❌ Сценарій завершено з помилкою: ${errorMessage || 'невідома помилка'}`, 'error');
        }

        session.isBotRunning = false;
        session.lastActiveNodeId = null;
        session.lastActiveNodeTitle = null;

        try {
          const statPath = path.join(PROJECTS_DIR, `${projectName}_stats.json`);
          fs.promises.readFile(statPath, 'utf-8')
            .then(raw => {
              try { return JSON.parse(raw); } catch { return []; }
            })
            .catch(() => [])
            .then(stats => {
              stats.push({ 
                timestamp: Date.now(), 
                status: finalStatus,
                error: errorMessage,
                snapshot: JSON.parse(JSON.stringify(session.globalVariables)) 
              });
              return fs.promises.writeFile(statPath, JSON.stringify(stats, null, 2));
            })
            .catch(() => {});
        } catch (err) {}

        browserLifecycle.closeBrowser(session).catch(closeErr => {
          logger.error(`Failed to close browser for ${projectName}`, closeErr instanceof Error ? closeErr : new Error(String(closeErr)));
        });

        if (session.activeWs && session.activeWs.readyState === 1) {
          session.activeWs.send(JSON.stringify({ type: 'BOT_FINISHED', status: finalStatus, error: errorMessage }));
          session.activeWs.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: false }));
        }

        projectQueueManager.processNext();
      }
    });

    session.engine = engine;
    logToClient(session, '🚀 Старт виконання сценарію...', 'info');

    engine.run().catch(err => {
      logger.error(`Error in bot run for ${projectName}`, err instanceof Error ? err : new Error(String(err)));
      if (session.currentRunId) {
        RunLogger.finishRun(projectName, session.currentRunId, 'error', err.message || String(err));
        session.currentRunId = undefined;
      }
      projectQueueManager.processNext();
    });

    return true;
  } catch (err: any) {
    logger.error(`Failed to start project ${projectName}`, err instanceof Error ? err : new Error(String(err)));
    session.isBotRunning = false;
    session.lastActiveNodeId = null;
    session.lastActiveNodeTitle = null;
    
    if (session.currentRunId) {
      RunLogger.finishRun(projectName, session.currentRunId, 'error', err.message || String(err));
      session.currentRunId = undefined;
    }

    try {
      await browserLifecycle.closeBrowser(session);
    } catch (closeErr) {
      logger.error(`Failed to close browser after start error for ${projectName}`, closeErr instanceof Error ? closeErr : new Error(String(closeErr)));
    }
    
    logToClient(session, `❌ Помилка старту проекту: ${err.message || err}`, 'error');
    if (session.activeWs && session.activeWs.readyState === 1) {
      session.activeWs.send(JSON.stringify({ type: 'BOT_FINISHED', status: 'error', error: err.message || String(err) }));
      session.activeWs.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: false }));
    }

    projectQueueManager.processNext();
    return false;
  }
}

// Універсальна функція для зупинки бот-сценарію проекту
export async function stopProject(projectName: string): Promise<boolean> {
  const session = getOrCreateSession(projectName);
  
  if (session.currentRunId) {
    RunLogger.finishRun(projectName, session.currentRunId, 'stopped', 'Зупинено вручну користувачем');
    session.currentRunId = undefined;
  }

  session.isBotRunning = false;
  session.lastActiveNodeId = null;
  session.lastActiveNodeTitle = null;
  
  if (session.activeWs && session.activeWs.readyState === 1) {
    session.activeWs.send(JSON.stringify({ type: 'BOT_FINISHED' }));
    session.activeWs.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: false }));
  }
  
  try {
    await browserLifecycle.closeBrowser(session);
    logToClient(session, '🛑 Бот сценарій успішно зупинено користувачем', 'info');
    projectQueueManager.processNext();
    return true;
  } catch (err: any) {
    logger.error(`Error stopping project ${projectName}`, err instanceof Error ? err : new Error(String(err)));
    projectQueueManager.processNext();
    return false;
  }
}

// Функція для запуску логіки виконання окремої ноди
export async function executeNodeLogic(
  currentNode: any, 
  activePage: any, 
  ws: any, 
  context: any, 
  nodes: any, 
  edges: any, 
  targetHandle?: string
): Promise<any> {
  const projectName = (ws as any).projectName || 'default';
  const session = getOrCreateSession(projectName);
  
  const engine = new BotEngine({
    nodes, edges, activePage, ws, 
    globalVariables: session.globalVariables,
    projectName,
    broadcastVariables: () => broadcastVariables(session),
    logToClient: (msg, type) => logToClient(session, msg, type), 
    takeDebugSnapshot: (nodeId, nodeTitle, highlight) => takeDebugSnapshot(session, nodeId, nodeTitle, highlight), 
    smartSleep, 
    nodeRuntimeState: session.nodeRuntimeState,
    checkRunning: () => (ws as any).isSingleNodeRun ? (ws as any).isBotRunning : session.isBotRunning,
    nodeHandlers,
    onNodeDisplayUpdate: (nodeId, data) => {
      const msg = JSON.stringify({ type: 'UPDATE_NODE_DATA', nodeId, newData: data });
      if (session.activeWs && session.activeWs.readyState === 1) {
        session.activeWs.send(msg);
      }
    },
    onNodeExecuting: (nodeId, nodeTitle) => broadcastNodeExecuting(session, nodeId, nodeTitle)
  });
  
  return engine.executeNode(currentNode, context, targetHandle);
}
