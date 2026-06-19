// Імпортуємо фреймворк Express для створення HTTP сервера
import express from 'express';
// Імпортуємо мідлвар CORS для дозволу крос-доменних запитів
import cors from 'cors';
// Імпортуємо класи WebSocketServer та WebSocket для роботи з веб-сокетами
import { WebSocketServer, WebSocket } from 'ws';
// Імпортуємо модуль fs для роботи з файловою системою
import fs from 'fs';
// Імпортуємо модуль path для роботи зі шляхами до файлів
import path from 'path';
// Імпортуємо модуль http для створення HTTP сервера
import http from 'http';
// Читаємо налаштування з файлу .env
import 'dotenv/config';
// Імпортуємо структурований логер
import { Logger } from './logger';
// Імпортуємо rate limiting middleware
import { apiRateLimiter, wsRateLimiter, runMultipleRateLimiter } from './auth/RateLimiter';
// Імпортуємо JWT authentication middleware
import { authMiddleware, AuthMiddleware } from './auth/AuthMiddleware';
// Імпортуємо CSRF protection middleware
import { csrfMiddleware, CSRFMiddleware } from './auth/CSRFMiddleware';
// Імпортуємо input validation service
import { inputValidator } from './validation/InputValidator';
import { internalConfig } from './internalConfig';
// Імпортуємо класи для роботи з інвентарем
import { InventoryReader } from './inventory-overview/InventoryReader';
import { ResourceAggregator } from './inventory-overview/ResourceAggregator';
// Імпортуємо обробники нод з папки nodes
import { nodeHandlers } from './nodes';
// Імпортуємо двигун бота BotEngine
import { BotEngine } from './engine/BotEngine';
// Імпортуємо методи та класи з нашого менеджера браузерів
import { 
  sessions,
  getOrCreateSession,
  setSessionActiveWs,
  isSessionBrowserAlive,
  closeSessionBrowser,
  connectToBrowser,
  injectPicker,
  takeDebugSnapshot
} from './browserManager';
import { ProjectSession, ExtendedWebSocket } from './types';
// Імпортуємо WebSocket lifecycle manager (Requirement 8)
import { WebSocketLifecycle } from './lifecycle/WebSocketLifecycle';
// Імпортуємо Browser lifecycle manager (Requirement 9)
import { BrowserLifecycle } from './lifecycle/BrowserLifecycle';
// Імпортуємо Timer manager (Requirement 10)
import { TimerManager } from './lifecycle/TimerManager';
// Імпортуємо Memory monitor (Requirement 11)
import { MemoryMonitor } from './lifecycle/MemoryMonitor';
// Імпортуємо Semaphore для concurrency control (Requirement 19)
import { browserSemaphore } from './concurrency/Semaphore';
// Імпортуємо нові сервіси розкладу та сповіщень
import { SchedulerService } from './scheduler/SchedulerService';
import { NotificationService } from './notifications/NotificationService';

// Створюємо логер для основного модуля
const logger = new Logger('Server');

// Створюємо WebSocket lifecycle manager (Requirement 8)
const wsLifecycle = new WebSocketLifecycle((projectName: string) => sessions.get(projectName));

// Створюємо Browser lifecycle manager (Requirement 9)
const browserLifecycle = new BrowserLifecycle();

// Створюємо Timer manager (Requirement 10)
const timerManager = new TimerManager((projectName: string) => sessions.get(projectName));

// Створюємо Memory monitor (Requirement 11)
const memoryMonitor = new MemoryMonitor();

// Глобальні обробники необроблених відхилень Promise та виключень (Requirement 13.2)
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise rejection', reason instanceof Error ? reason : new Error(String(reason)), {
    promise: String(promise)
  });
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception', err);
  // Даємо час на логування перед виходом
  setTimeout(() => process.exit(1), 500);
});

// Створюємо додаток Express
const app = express();
// Дозволяємо CORS запити для нашого додатку
app.use(cors());
// Встановлюємо ліміт розміру тіла JSON запитів до 50МБ для великих проектів
app.use(express.json({ limit: '50mb' }));
// Дозволяємо парсинг urlencoded запитів з великим лімітом
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// Налаштовуємо роздачу статичних зображень з папки images
app.use('/api/images', express.static(path.join(__dirname, '../images')));
// Налаштовуємо роздачу скріншотів з папки projects
app.use('/api/screenshots', express.static(path.join(__dirname, '../projects')));

// Застосовуємо rate limiting для всіх /api/* ендпоінтів (Requirement 7.1)
app.use('/api', apiRateLimiter);

// Створюємо HTTP сервер на базі додатку Express
const server = http.createServer(app);

// Застосовуємо rate limiting для WebSocket підключень через HTTP upgrade (Requirement 7.2)
// express-rate-limit працює з Express req/res, тому перехоплюємо upgrade запит
server.on('upgrade', (req: http.IncomingMessage, socket: any, head: Buffer) => {
  // Перевіряємо чи це запит до /ws
  const url = req.url || '';
  if (!url.startsWith('/ws')) return;

  // Створюємо mock Express req/res для перевірки rate limit
  const mockReq = Object.assign(req, {
    ip: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
        (req.socket as any)?.remoteAddress || 'unknown',
    method: 'GET',
    path: '/ws',
    route: undefined,
    app: app,
    // Expose user if JWT was already parsed (not applicable at upgrade stage)
    user: undefined,
  }) as any;

  const mockRes = {
    status: (code: number) => ({
      json: (body: any) => {
        // Rate limit exceeded — відхиляємо WebSocket підключення
        socket.write(
          `HTTP/1.1 ${code} Too Many Requests\r\n` +
          'Content-Type: application/json\r\n' +
          'Connection: close\r\n' +
          `X-RateLimit-Limit: 10\r\n` +
          '\r\n' +
          JSON.stringify(body)
        );
        socket.destroy();
      },
    }),
    set: () => mockRes,
    setHeader: () => mockRes,
    getHeader: () => undefined,
    removeHeader: () => mockRes,
    end: () => {},
    json: (body: any) => {
      socket.write(
        'HTTP/1.1 429 Too Many Requests\r\n' +
        'Content-Type: application/json\r\n' +
        'Connection: close\r\n' +
        '\r\n' +
        JSON.stringify(body)
      );
      socket.destroy();
    },
    headersSent: false,
  } as any;

  wsRateLimiter(mockReq, mockRes, () => {
    // Rate limit passed — WebSocket server handles the upgrade normally
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });
});
// Створюємо WebSocket сервер без автоматичного прив'язування до HTTP сервера
// (upgrade обробляється вручну для підтримки rate limiting)
const wss = new WebSocketServer({ noServer: true });
// Отримуємо HTTP порт з .env або використовуємо порт 3001
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3001');

// Визначаємо шлях до папки з проектами
const PROJECTS_DIR = path.join(__dirname, '../projects');
// Якщо папка з проектами не існує, створюємо її
try {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    logger.info('Created projects directory', { path: PROJECTS_DIR });
  }
} catch (err) {
  logger.error('Failed to create projects directory', err instanceof Error ? err : new Error(String(err)), { path: PROJECTS_DIR });
  throw new Error(`Cannot create projects directory: ${err instanceof Error ? err.message : String(err)}`);
}

// Ініціалізуємо сервіси
export const schedulerService = new SchedulerService(PROJECTS_DIR);
export const notificationService = new NotificationService(PROJECTS_DIR);

// Визначаємо шлях до резервного файлу збереження save.json
const SAVE_PATH = path.join(__dirname, '../save.json');

// Requirement 24: Health check endpoint (no authentication required)
app.get('/health', (req, res) => {
  try {
    // Збираємо інформацію про стан системи
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Підраховуємо активні сесії та браузери
    let activeSessionCount = 0;
    let activeBrowserCount = 0;
    
    sessions.forEach((session) => {
      activeSessionCount++;
      if (session.page && session.isBotRunning) {
        activeBrowserCount++;
      }
    });
    
    // Формуємо відповідь
    const healthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      memory: {
        heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.floor(memoryUsage.rss / 1024 / 1024), // MB
        external: Math.floor(memoryUsage.external / 1024 / 1024) // MB
      },
      activeSessionCount,
      activeBrowserCount
    };
    
    res.status(200).json(healthResponse);
  } catch (err) {
    logger.error('Health check error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

// System status endpoint with detailed monitoring information
app.get('/api/system/status', authMiddleware, (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    const cpuUsage = process.cpuUsage();
    
    // Підраховуємо активні сесії та браузери
    let activeSessionCount = 0;
    let activeBrowserCount = 0;
    
    sessions.forEach((session) => {
      activeSessionCount++;
      if (session.page && session.isBotRunning) {
        activeBrowserCount++;
      }
    });
    
    // Отримуємо статистику Semaphore
    const semaphoreStats = browserSemaphore.getStatistics();
    
    // Формуємо детальну відповідь
    const statusResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      system: {
        memory: {
          heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024), // MB
          rss: Math.floor(memoryUsage.rss / 1024 / 1024), // MB
          external: Math.floor(memoryUsage.external / 1024 / 1024) // MB
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        platform: process.platform,
        nodeVersion: process.version
      },
      sessions: {
        activeCount: activeSessionCount,
        runningBrowsers: activeBrowserCount
      },
      concurrency: {
        semaphore: semaphoreStats
      }
    };
    
    res.status(200).json(statusResponse);
  } catch (err) {
    logger.error('System status error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ status: 'error', message: 'Failed to get system status' });
  }
});

// Створюємо роут для отримання списку імен всіх збережених проектів
// Requirement 1: JWT authentication for /api/projects/*
// Requirement 7: Rate limiting already applied globally to /api/*
app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    // Читаємо файли в папці проектів і фільтруємо лише файли .json
    const files = await fs.promises.readdir(PROJECTS_DIR);
    const projectFiles = files.filter(f => 
      f.endsWith('.json') && 
      !f.endsWith('_stats.json') &&
      !f.includes('schedule') &&
      !f.includes('notifications') &&
      !f.includes('_inventory') &&
      !f.includes('_logs')
    );
    // Повертаємо список імен проектів без розширення .json
    res.json(projectFiles.map(f => f.replace('.json', '')));
  } catch (err: any) { 
    // У разі помилки відправляємо статус 500 та повідомлення
    logger.error('Failed to read projects directory', err instanceof Error ? err : new Error(String(err)), { path: PROJECTS_DIR });
    res.status(500).json({ success: false, error: 'Failed to load project list. Please try again later.' }); 
  }
});

// ============================================================================
// Logs API Endpoints
// ============================================================================

// Отримання логів проекту
app.get('/api/logs/:project', authMiddleware, async (req, res) => {
  try {
    const { project } = req.params;
    const logPath = path.join(PROJECTS_DIR, `${project}_logs.json`);
    
    if (fs.existsSync(logPath)) {
      const data = await fs.promises.readFile(logPath, 'utf-8');
      try {
        res.json(JSON.parse(data));
      } catch (parseErr) {
        res.json([]);
      }
    } else {
      res.json([]);
    }
  } catch (err) {
    logger.error('Failed to read logs', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

// Збереження логів проекту
app.post('/api/logs/:project', authMiddleware, async (req, res) => {
  try {
    const { project } = req.params;
    const logPath = path.join(PROJECTS_DIR, `${project}_logs.json`);
    
    const logs = req.body;
    if (Array.isArray(logs)) {
      await fs.promises.writeFile(logPath, JSON.stringify(logs, null, 2), 'utf-8');
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Logs must be an array' });
    }
  } catch (err) {
    logger.error('Failed to save logs', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Failed to save logs' });
  }
});

// Очищення логів проекту
app.delete('/api/logs/:project', authMiddleware, async (req, res) => {
  try {
    const { project } = req.params;
    const logPath = path.join(PROJECTS_DIR, `${project}_logs.json`);
    
    if (fs.existsSync(logPath)) {
      await fs.promises.unlink(logPath);
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to delete logs', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Failed to delete logs' });
  }
});

// ============================================================================
// Config API Endpoints
// ============================================================================

// GET /api/config - Публічний ендпоінт для отримання конфігурації модулів
// Доступ без авторизації (читання відкрите для нод ApiNode через internal://config)
app.get('/api/config', (req, res) => {
  try {
    // Повертаємо весь словник конфігурації {ключ: 0/1}
    res.status(200).json(internalConfig.getAll());
  } catch (error: any) {
    logger.error('Failed to get config', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/config - Захищений ендпоінт для оновлення конфігурації модулів
// Приймає словник {ключ: 0|1} - той самий формат що /api/internal/config
// Доступно з Android-додатку (з авторизацією та CSRF-токеном)
app.put('/api/config', authMiddleware, csrfMiddleware, (req, res) => {
  try {
    const changes = req.body;
    // Проходимо по всіх ключах та оновлюємо значення
    for (const [key, value] of Object.entries(changes)) {
      if (typeof value === 'number') {
        internalConfig.set(key, value); // Зберігаємо кожен ключ-значення
      }
    }
    // Повертаємо оновлений конфіг
    res.status(200).json({ success: true, config: internalConfig.getAll() });
  } catch (error: any) {
    logger.error('Failed to update config', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// Inventory API Endpoints
// ============================================================================

// GET /api/inventory/overview - Отримати зведені дані інвентаря всіх проектів
app.get('/api/inventory/overview', authMiddleware, async (req, res) => {
  try {
    const reader = new InventoryReader();
    const aggregator = new ResourceAggregator();
    
    // Читаємо всі інвентарі
    const inventories = await reader.readAllInventories(PROJECTS_DIR);
    
    // Агрегуємо дані
    const result = aggregator.aggregate(inventories);
    
    res.json(result);
  } catch (err: any) {
    logger.error('Failed to get inventory overview', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load inventory overview' });
  }
});

// GET /api/inventory/:projectName - Отримати дані інвентаря проекту
app.get('/api/inventory/:projectName', authMiddleware, async (req, res) => {
  try {
    const projectName = req.params.projectName;

    // Validate project name
    const validation = inputValidator.validateProjectName(projectName);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project name. Only alphanumeric characters, hyphens, and underscores are allowed.'
      });
    }

    // Read inventory file
    const inventoryPath = path.join(PROJECTS_DIR, `${projectName}_inventory.json`);

    try {
      await fs.promises.access(inventoryPath);
      const fileContent = await fs.promises.readFile(inventoryPath, 'utf-8');
      const inventoryData = JSON.parse(fileContent);

      let variables = {};
      try {
        const projectPath = path.join(PROJECTS_DIR, `${projectName}.json`);
        if (fs.existsSync(projectPath)) {
          const projectContent = await fs.promises.readFile(projectPath, 'utf-8');
          const projectData = JSON.parse(projectContent);
          variables = projectData.variables || projectData;
        }
      } catch (e) {}

      res.json({
        data: inventoryData.data || [],
        timestamp: inventoryData.timestamp || null,
        projectName: inventoryData.projectName || projectName,
        variables: variables
      });
    } catch (fileErr: any) {
      if (fileErr.code === 'ENOENT') {
        let variables = {};
        try {
          const projectPath = path.join(PROJECTS_DIR, `${projectName}.json`);
          if (fs.existsSync(projectPath)) {
            const projectContent = await fs.promises.readFile(projectPath, 'utf-8');
            const projectData = JSON.parse(projectContent);
            variables = projectData.variables || projectData;
          }
        } catch (e) {}
        
        return res.json({
          data: [],
          timestamp: null,
          projectName,
          variables: variables
        });
      }

      logger.error('Failed to read inventory file', fileErr);
      return res.status(500).json({
        success: false,
        error: 'Failed to load inventory data. Please try again later.'
      });
    }
  } catch (err) {
    logger.error('Inventory endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({
      success: false,
      error: 'Failed to load inventory data. Please try again later.'
    });
  }
});

// Створюємо роут для завантаження проекту за іменем
// Requirement 1: JWT authentication for /api/projects/*
// Requirement 3: Input validation for project names
// Requirement 7: Rate limiting already applied globally to /api/*
app.get('/api/load', authMiddleware, async (req, res) => {
  try {
    // Отримуємо ім'я проекту з query-параметрів або використовуємо default
    const name = req.query.name as string || 'default';
    
    // Валідуємо назву проекту (Requirement 3)
    const validation = inputValidator.validateProjectName(name);
    if (!validation.isValid) {
      logger.warn('Load project failed: invalid project name', { name });
      return res.status(400).json({ success: false, error: validation.error });
    }
    
    // Отримуємо або створюємо сесію для цього проекту
    const session = getOrCreateSession(name);
    // Формуємо шлях до файлу проекту
    const projectPath = path.join(PROJECTS_DIR, `${name}.json`);
    
    // Визначаємо, який файл читати (проект або резервний save.json)
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
    
    // Якщо файлів немає, повертаємо порожню структуру
    if (!pathToRead) {
      logger.info('No project file found, returning empty structure', { projectName: name });
      return res.json({ nodes: [], edges: [], variables: {} });
    }
    
    // Читаємо дані проекту з файлу
    let projectData: any;
    try {
      const fileContent = await fs.promises.readFile(pathToRead, 'utf-8');
      projectData = JSON.parse(fileContent);
    } catch (parseErr) {
      logger.error(`Failed to read or parse project file`, parseErr instanceof Error ? parseErr : new Error(String(parseErr)), { path: pathToRead });
      return res.status(500).json({ success: false, error: 'Failed to load project. The project file may be corrupted.' });
    }
    
    // Отримуємо збережені змінні з даних проекту
    const rawVars = projectData.variables;
    // Перевіряємо чи змінні є валідним об'єктом
    if (rawVars && typeof rawVars === 'object') {
      // Підтримуємо старий формат збереження
      if ('lastProject' in rawVars && 'variables' in rawVars) {
        session.globalVariables = rawVars.variables || {};
      } else {
        session.globalVariables = rawVars;
      }
      // Оновлюємо змінні у WebSocket сесії цього конкретного проекту
      const msg = JSON.stringify({ type: 'GLOBAL_VARIABLES_UPDATE', variables: session.globalVariables });
      if (session.activeWs && session.activeWs.readyState === 1) {
        session.activeWs.send(msg);
      }
    }
    
    // Повертаємо дані проекту клієнту
    res.json(projectData);
  } catch (err: any) { 
    // У разі помилки відправляємо статус 500
    logger.error('Load project error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load project. Please try again later.' }); 
  }
});

// Створюємо роут для збереження проекту
// Requirement 1: JWT authentication for /api/projects/*
// Requirement 2: CSRF protection for POST requests
// Requirement 3: Input validation for project names
// Requirement 7: Rate limiting already applied globally to /api/*
app.post('/api/save', authMiddleware, csrfMiddleware, async (req, res) => {
  try {
    // Отримуємо ім'я проекту та дані з тіла запиту
    const { name, data } = req.body;
    // Якщо ім'я не вказано, повертаємо помилку 400
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    
    // Валідуємо назву проекту (Requirement 3)
    const validation = inputValidator.validateProjectName(name);
    if (!validation.isValid) {
      logger.warn('Save project failed: invalid project name', { name });
      return res.status(400).json({ success: false, error: validation.error });
    }
    
    // Отримуємо або створюємо сесію для проекту
    const session = getOrCreateSession(name);
    
    // Валідуємо структуру проекту
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid project data structure' });
    }
    
    // Перевіряємо обов'язкові поля
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      return res.status(400).json({ success: false, error: 'Project must contain nodes and edges arrays' });
    }
    
    // Беремо змінні з запиту або з поточного стану сесії
    const vars = (data.variables && typeof data.variables === 'object' && Object.keys(data.variables).length > 0)
      ? data.variables 
      : session.globalVariables;
    
    // Оновлюємо змінні у сесії
    if (data.variables && typeof data.variables === 'object') {
      session.globalVariables = { ...session.globalVariables, ...data.variables };
    }
    
    // Формуємо шлях для збереження файлу
    const filePath = path.join(PROJECTS_DIR, `${name}.json`);

    // Створюємо об'єкт для зчитування існуючих налаштувань з диска
    let existingSettings: any = {};
    try {
      // Перевіряємо чи існує файл проекту на диску
      if (fs.existsSync(filePath)) {
        // Зчитуємо та розпаршуємо існуючі дані проекту
        const existingContent = await fs.promises.readFile(filePath, 'utf-8');
        existingSettings = JSON.parse(existingContent);
      }
    } catch (e) {
      // Ігноруємо можливі помилки при зчитуванні файлу
      logger.warn(`Failed to read existing project file`, { projectName: name, error: String(e) });
    }

    // Отримуємо налаштування запуску: пріоритетно з запиту, інакше з диска, інакше дефолтний об'єкт
    const launchSettings = data.launchSettings || existingSettings.launchSettings || {};
    // Отримуємо налаштування браузера: пріоритетно з запиту, інакше з диска, інакше дефолтний об'єкт
    const browserSettings = data.browserSettings || existingSettings.browserSettings || {};

    // Готуємо структуру для запису у файл
    const projectData = {
      nodes: data.nodes || [],
      edges: data.edges || [],
      variables: vars,
      launchSettings,
      browserSettings,
      updatedAt: Date.now()
    };
    
    // Записуємо JSON дані проекту у файл
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(projectData, null, 2), 'utf-8');
      logger.info(`Project saved successfully`, { projectName: name, variableCount: Object.keys(vars).length });
    } catch (writeErr) {
      logger.error('Failed to write project file', writeErr instanceof Error ? writeErr : new Error(String(writeErr)), { path: filePath });
      return res.status(500).json({ success: false, error: 'Failed to save project. Please try again.' });
    }
    
    // Записуємо резервну копію у save.json
    try {
      await fs.promises.writeFile(SAVE_PATH, JSON.stringify(projectData, null, 2), 'utf-8');
    } catch (backupErr) {
      // Не критична помилка - логуємо але продовжуємо
      logger.warn('Failed to write backup file', { path: SAVE_PATH, error: String(backupErr) });
    }
    
    // Повертаємо успішний статус клієнту
    res.json({ success: true });
  } catch (err: any) { 
    // У разі помилки відправляємо статус 500
    logger.error('Save project error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to save project. Please try again later.' }); 
  }
});

// Створюємо роут для видалення проекту за його назвою
// Requirement 1: JWT authentication for /api/projects/*
// Requirement 2: CSRF protection for DELETE requests
// Requirement 3: Input validation for project names
// Requirement 7: Rate limiting already applied globally to /api/*
app.delete('/api/projects/:name', authMiddleware, csrfMiddleware, async (req, res) => {
  try {
    // Отримуємо назву проекту з параметрів роуту
    const name = req.params.name;
    
    // Валідуємо назву проекту (Requirement 3)
    const validation = inputValidator.validateProjectName(name);
    if (!validation.isValid) {
      logger.warn('Delete project failed: invalid project name', { name });
      return res.status(400).json({ success: false, error: validation.error });
    }
    
    // Формуємо шлях до файлу проекту
    const filePath = path.join(PROJECTS_DIR, `${name}.json`);
    
    // Перевіряємо чи існує файл проекту
    let fileExists = false;
    try {
      fileExists = fs.existsSync(filePath);
    } catch (err) {
      logger.error('Failed to check project file existence', err instanceof Error ? err : new Error(String(err)), { path: filePath });
      return res.status(500).json({ success: false, error: 'Failed to check project existence. Please try again.' });
    }
    
    // Якщо файл проекту не існує, повертаємо помилку 404
    if (!fileExists) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    // Видаляємо файл проекту
    try {
      await fs.promises.unlink(filePath);
      logger.info('Project file deleted', { projectName: name });
    } catch (deleteErr) {
      logger.error('Failed to delete project file', deleteErr instanceof Error ? deleteErr : new Error(String(deleteErr)), { path: filePath });
      return res.status(500).json({ success: false, error: 'Failed to delete project. Please try again.' });
    }
    
    // Видаляємо також файл статистики проекту, якщо він є
    const statsPath = path.join(PROJECTS_DIR, `${name}_stats.json`);
    try {
      if (fs.existsSync(statsPath)) {
        await fs.promises.unlink(statsPath);
        logger.info('Project stats file deleted', { projectName: name });
      }
    } catch (statsErr) {
      // Не критична помилка - логуємо але продовжуємо
      logger.warn('Failed to delete stats file', { path: statsPath, error: String(statsErr) });
    }
    
    // Видаляємо сесію проекту з нашої карти сесій
    sessions.delete(name);

    logger.info('Project deleted successfully', { projectName: name });
    // Повертаємо статус успіху
    res.json({ success: true });
  } catch (err: any) { 
    // У разі помилки відправляємо статус 500
    logger.error('Delete project error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to delete project. Please try again later.' }); 
  }
});

// Додаємо HTTP роут для отримання змінних оточення за замовчуванням
// Requirement 1: JWT authentication for /api/*
// Requirement 7: Rate limiting already applied globally to /api/*
app.get('/api/browser-env', authMiddleware, (req, res) => {
  try {
    // Повертаємо дефолтні налаштування профілю з файлу .env
    res.json({
      defaultProfile: process.env.ITBROWSER_PROFILE || 'Default',
      defaultProfileDir: process.env.ITBROWSER_PROFILE_DIR || 'Default'
    });
  } catch (err: any) {
    // Відправляємо помилку 500 у разі збою
    res.status(500).json({ success: false, error: err.message });
  }
});

// Додаємо HTTP роут для отримання списку файлів у папці images
// Requirement 1: JWT authentication for /api/*
// Requirement 7: Rate limiting already applied globally to /api/*
app.get('/api/images', authMiddleware, async (req, res) => {
  try {
    // Визначаємо шлях до папки зображень
    const imagesDir = path.join(__dirname, '../images');
    
    // Якщо папка не існує, створюємо її
    try {
      if (!fs.existsSync(imagesDir)) {
        await fs.promises.mkdir(imagesDir, { recursive: true });
        logger.info('Created images directory', { path: imagesDir });
      }
    } catch (mkdirErr) {
      logger.error('Failed to create images directory', mkdirErr instanceof Error ? mkdirErr : new Error(String(mkdirErr)), { path: imagesDir });
      return res.status(500).json({ success: false, error: 'Failed to access images directory.' });
    }
    
    // Повертаємо список файлів, що мають розширення png, jpg або jpeg
    try {
      const files = await fs.promises.readdir(imagesDir);
      const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f));
      res.json(imageFiles);
    } catch (readErr) {
      logger.error('Failed to read images directory', readErr instanceof Error ? readErr : new Error(String(readErr)), { path: imagesDir });
      return res.status(500).json({ success: false, error: 'Failed to load images list.' });
    }
  } catch (err: any) { 
    // Відправляємо помилку 500 у разі збою
    logger.error('Images endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to process images request.' }); 
  }
});

// ============================================================================
// Screenshots API Endpoints
// ============================================================================

// GET /api/screenshots/:projectName - List all screenshots for a project
// Requirement 1: JWT authentication for /api/*
// Requirement 3: Input validation for project names
// Requirement 7: Rate limiting already applied globally to /api/*
app.get('/api/screenshots/:projectName', authMiddleware, async (req, res) => {
  try {
    const { projectName } = req.params;
    
    // Validate project name
    const validation = inputValidator.validateProjectName(projectName);
    if (!validation.isValid) {
      logger.warn('Screenshots list failed: invalid project name', { projectName });
      return res.status(400).json({ success: false, error: validation.error });
    }
    
    const screenshotsDir = path.join(PROJECTS_DIR, `${projectName}_screenshots`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const files = await fs.promises.readdir(screenshotsDir);
    const screenshotFiles = files.filter(f => f.endsWith('.png'));
    
    res.json(screenshotFiles);
  } catch (err: any) {
    logger.error('Screenshots list endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load screenshots list.' });
  }
});

// DELETE /api/screenshots/:projectName/:filename - Delete specific screenshot
// Requirement 1: JWT authentication for /api/*
// Requirement 2: CSRF protection for DELETE requests
// Requirement 3: Input validation for project names
// Requirement 7: Rate limiting already applied globally to /api/*
app.delete('/api/screenshots/:projectName/:filename', authMiddleware, csrfMiddleware, async (req, res) => {
  try {
    const { projectName, filename } = req.params;
    
    // Validate project name
    const validation = inputValidator.validateProjectName(projectName);
    if (!validation.isValid) {
      logger.warn('Screenshot delete failed: invalid project name', { projectName });
      return res.status(400).json({ success: false, error: validation.error });
    }
    
    // Validate filename (basic security check)
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      logger.warn('Screenshot delete failed: invalid filename', { filename });
      return res.status(400).json({ success: false, error: 'Invalid filename' });
    }
    
    const screenshotsDir = path.join(PROJECTS_DIR, `${projectName}_screenshots`);
    const filePath = path.join(screenshotsDir, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Screenshot not found' });
    }
    
    // Delete file
    await fs.promises.unlink(filePath);
    logger.info('Screenshot deleted', { projectName, filename });
    
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Screenshot delete endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to delete screenshot.' });
  }
});

// Роут для отримання глобальної статистики (по всім проектам)
// Requirement 1: JWT authentication for /api/*
// Requirement 7: Rate limiting already applied globally to /api/*
app.get('/api/global-stats', authMiddleware, async (req, res) => {
  try {
    // Читаємо список файлів у папці проектів (async)
    let files: string[];
    try {
      files = await fs.promises.readdir(PROJECTS_DIR);
    } catch (readErr) {
      logger.error('Failed to read projects directory for global stats', readErr instanceof Error ? readErr : new Error(String(readErr)), { path: PROJECTS_DIR });
      return res.status(500).json({ success: false, error: 'Failed to read projects directory.' });
    }
    
    const globalStats: { projectName: string; stats: any[] }[] = [];
    
    for (const file of files) {
      if (file.endsWith('_stats.json')) {
        const projectName = file.replace('_stats.json', '');
        const statPath = path.join(PROJECTS_DIR, file);
        try {
          const fileContent = await fs.promises.readFile(statPath, 'utf-8');
          const raw = JSON.parse(fileContent);
          const stats = Array.isArray(raw) ? raw : [];
          globalStats.push({ projectName, stats });
        } catch (readErr) {
          // Не критична помилка - логуємо та продовжуємо
          logger.warn(`Failed to read or parse stats file for ${projectName}`, { path: statPath, error: String(readErr) });
        }
      }
    }
    res.json(globalStats);
  } catch (err: any) {
    logger.error('Global stats endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load global statistics. Please try again later.' });
  }
});

// Додаємо роут для отримання файлу статистики конкретного проекту
// Requirement 1: JWT authentication for /api/*
// Requirement 3: Input validation for project names
// Requirement 7: Rate limiting already applied globally to /api/*
app.get('/api/stats/:name', authMiddleware, async (req, res) => {
  try {
    // Отримуємо назву проекту з параметрів запиту
    const name = req.params.name;
    
    // Валідуємо назву проекту (Requirement 3)
    const validation = inputValidator.validateProjectName(name);
    if (!validation.isValid) {
      logger.warn('Stats endpoint failed: invalid project name', { name });
      return res.status(400).json({ success: false, error: validation.error });
    }
    
    // Формуємо шлях до файлу статистики
    const statPath = path.join(PROJECTS_DIR, `${name}_stats.json`);
    
    // Перевіряємо чи існує файл
    let fileExists = false;
    try {
      await fs.promises.access(statPath);
      fileExists = true;
    } catch (accessErr) {
      // Файл не існує - це нормально, повертаємо порожній масив
      fileExists = false;
    }
    
    // Якщо файл існує, читаємо його і повертаємо вміст
    if (fileExists) {
      try {
        const fileContent = await fs.promises.readFile(statPath, 'utf-8');
        const raw = JSON.parse(fileContent);
        // Перевіряємо що отримали масив, а не об'єкт (захист від пошкоджених файлів)
        const stats = Array.isArray(raw) ? raw : [];
        res.json(stats);
      } catch (readErr) {
        logger.error(`Failed to read or parse stats file for ${name}`, readErr instanceof Error ? readErr : new Error(String(readErr)), { path: statPath });
        return res.status(500).json({ success: false, error: 'Failed to load project statistics.' });
      }
    } else {
      // Якщо файл не існує — повертаємо порожній масив
      res.json([]);
    }
  } catch (err: any) { 
    // Відправляємо помилку 500 у разі збою
    logger.error('Stats endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to process statistics request.' }); 
  }
});

// Роут для отримання поточного статусу роботи та активних нод усіх сесій проектів
// Requirement 1: JWT authentication for /api/projects/*
// Requirement 7: Rate limiting already applied globally to /api/*
app.get('/api/projects/status', authMiddleware, (req, res) => {
  try {
    // Створюємо об'єкт для зведення статусів
    const statusMap: Record<string, { isRunning: boolean; activeNodeTitle: string | null }> = {}; // Збереження пар: Назва проекту -> Стан роботи
    
    // Обходимо всі сесії в нашій карті сесій
    sessions.forEach((session, projectName) => {
      statusMap[projectName] = {
        isRunning: session.isBotRunning, // Прапорець чи запущений бот
        activeNodeTitle: session.lastActiveNodeTitle // Назва останньої активної ноди
      };
    });
    
    // Відправляємо сформовану карту статусів клієнту
    res.json(statusMap); // Повертаємо JSON відповідь
  } catch (err: any) {
    // У разі помилки відправляємо статус 500
    logger.error('Projects status endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to retrieve project status. Please try again later.' }); // Повертаємо опис помилки
  }
});

// Роут для одночасного масового запуску кількох вибраних проектів у фоновому режимі
// Requirement 1: JWT authentication for /api/projects/*
// Requirement 2: CSRF protection for POST requests
// Requirement 3: Input validation for project names
// Застосовуємо суворіший rate limiter для цього ендпоінту (Requirement 7.3: 5 req/15min)
app.post('/api/projects/run-multiple', authMiddleware, csrfMiddleware, runMultipleRateLimiter, async (req, res) => {
  try {
    // Отримуємо список назв проектів та їх налаштування браузера з тіла запиту
    // projectSettings — об'єкт вигляду { [назваПроекту]: browserSettings } з localStorage фронтенду
    const { projectNames, projectSettings } = req.body; // Очікуємо масив рядків та об'єкт налаштувань
    
    // Перевіряємо чи є вхідні дані масивом
    if (!projectNames || !Array.isArray(projectNames)) {
      return res.status(400).json({ success: false, error: 'projectNames must be an array of strings' }); // Помилка 400
    }

    // Валідуємо кожну назву проекту (Requirement 3)
    for (const name of projectNames) {
      const validation = inputValidator.validateProjectName(name);
      if (!validation.isValid) {
        logger.warn('Run-multiple failed: invalid project name', { name });
        return res.status(400).json({ success: false, error: `Invalid project name: ${name}` });
      }
    }

    // Створюємо об'єкт для збереження результатів запуску по кожному проекту
    const results: Record<string, boolean> = {}; // Карта: Назва -> Статус запуску
    
    // Запускаємо проекти паралельно з обмеженням конкурентності через Semaphore та retry логікою
    const launchPromises = projectNames.map(async (name) => {
      try {
        // Отримуємо налаштування браузера для цього проекту з переданого об'єкту
        // Якщо фронтенд надіслав налаштування — використовуємо їх, інакше undefined (буде зчитано з файлу)
        const overrideSettings = projectSettings && projectSettings[name] ? projectSettings[name] : undefined;
        
        // Запускаємо проект з retry логікою (максимум 2 спроби з затримкою 1с)
        const result = await withRetry(
          () => browserSemaphore.run(() => startProject(name, overrideSettings)),
          2, // maxRetries
          1000, // delayMs
          `Project launch ${name}`
        );
        
        results[name] = result;
        return { name, success: result };
      } catch (err) {
        logger.error(`Failed to launch project ${name} in parallel run after retries`, err instanceof Error ? err : new Error(String(err)));
        results[name] = false;
        return { name, success: false, error: String(err) };
      }
    });
    
    // Чекаємо завершення всіх запусків
    await Promise.all(launchPromises);

    // Повертаємо успішну відповідь разом із результатами запуску
    res.json({ success: true, results }); // Повертаємо зведений звіт
  } catch (err: any) {
    // У разі помилки відправляємо статус 500
    logger.error('Run-multiple endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to run multiple projects. Please try again later.' }); // Повертаємо опис помилки
  }
});

// Роут для одночасної масової зупинки кількох вибраних проектів
// Requirement 1: JWT authentication for /api/projects/*
// Requirement 2: CSRF protection for POST requests
// Requirement 3: Input validation for project names
// Requirement 7: Rate limiting already applied globally to /api/*
app.post('/api/projects/stop-multiple', authMiddleware, csrfMiddleware, async (req, res) => {
  try {
    // Отримуємо список назв проектів з тіла запиту
    const { projectNames } = req.body; // Очікуємо масив рядків
    
    // Перевіряємо чи є вхідні дані масивом
    if (!projectNames || !Array.isArray(projectNames)) {
      return res.status(400).json({ success: false, error: 'projectNames must be an array of strings' }); // Помилка 400
    }

    // Валідуємо кожну назву проекту (Requirement 3)
    for (const name of projectNames) {
      const validation = inputValidator.validateProjectName(name);
      if (!validation.isValid) {
        logger.warn('Stop-multiple failed: invalid project name', { name });
        return res.status(400).json({ success: false, error: `Invalid project name: ${name}` });
      }
    }

    // Створюємо об'єкт для збереження результатів зупинки по кожному проекту
    const results: Record<string, boolean> = {}; // Карта: Назва -> Статус зупинки
    
    // Пробігаємось по кожному проекту та зупиняємо його
    for (const name of projectNames) {
      results[name] = await stopProject(name); // Зупиняємо проект та записуємо true/false результату
    }

    // Повертаємо успішну відповідь разом із результатами зупинки
    res.json({ success: true, results }); // Повертаємо зведений звіт
  } catch (err: any) {
    // У разі помилки відправляємо статус 500
    logger.error('Stop-multiple endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to stop multiple projects. Please try again later.' }); // Повертаємо опис помилки
  }
});


// Створюємо шлях для авто-збереження глобальних змінних за замовчуванням
const STATE_PATH = path.join(__dirname, '../state.json');

// Допоміжна функція для retry логіки з обмеженням кількості спроб
async function withRetry<T>(
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
const logToClient = (session: ProjectSession, message: string, type: 'info' | 'error' | 'success' | 'debug' = 'info', data?: any) => {
  // Якщо веб-сокет з'єднання активне, надсилаємо повідомлення
  if (session.activeWs && session.activeWs.readyState === 1) {
    session.activeWs.send(JSON.stringify({ type: 'CONSOLE_LOG', message, logType: type, data }));
  }
};

// Допоміжна функція для надсилання стану виконання ноди клієнту сесії
const broadcastNodeExecuting = (session: ProjectSession, nodeId: string, nodeTitle?: string) => {
  // Зберігаємо останню активну ноду в об'єкті сесії
  session.lastActiveNodeId = nodeId;
  // Зберігаємо назву останньої активної ноди в об'єкті сесії для відображення статусу
  session.lastActiveNodeTitle = nodeTitle || null; // Якщо заголовок передано, зберігаємо його, інакше null
  // Готуємо повідомлення про виконання ноди
  const msg = JSON.stringify({ type: 'NODE_EXECUTING', nodeId, nodeTitle });
  // Надсилаємо його тільки нашому клієнту веб-сокета
  if (session.activeWs && session.activeWs.readyState === 1) {
    session.activeWs.send(msg);
  }
};

// Черга запису для серіалізації операцій запису файлів проектів (запобігає пошкодженню JSON при паралельних записах)
const writeQueues = new Map<string, Promise<void>>();

// Допоміжна функція для серіалізації записів файлів проекту (запобігає race condition при паралельних записах)
const enqueueWrite = (projectName: string, fn: () => Promise<void>): void => {
  const current = writeQueues.get(projectName) || Promise.resolve();
  const next = current.then(fn).catch(err => {
    logger.error(`Write queue error for project ${projectName}`, err instanceof Error ? err : new Error(String(err)));
  });
  writeQueues.set(projectName, next);
};

// Функція для завантаження налаштувань браузера з файлу проекту, якщо вони ще не в сесії
async function ensureBrowserSettings(projectName: string, session: ProjectSession) {
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
const broadcastVariables = (session: ProjectSession) => {
  // Надсилаємо оновлені змінні нашому клієнту
  const msg = JSON.stringify({ type: 'GLOBAL_VARIABLES_UPDATE', variables: session.globalVariables });
  if (session.activeWs && session.activeWs.readyState === 1) {
    session.activeWs.send(msg);
  }

  // Requirement 11: Check and limit nodeRuntimeState size
  if (session.nodeRuntimeState) {
    memoryMonitor.limitNodeRuntimeState(session.nodeRuntimeState);
  }

  // Requirement 10: Clear existing timer using TimerManager
  const timerKey = `${session.projectName}:autoSave`;
  timerManager.clearTimer(timerKey);

  // Запускаємо новий таймер на збереження через 500мс
  const timer = setTimeout(() => {
    enqueueWrite(session.projectName, async () => {
      // Формуємо шлях до файлу проекту
      const projectPath = path.join(PROJECTS_DIR, `${session.projectName}.json`);
      // Якщо файл існує, оновлюємо в ньому змінні
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

  // Requirement 10: Register timer with TimerManager
  timerManager.registerTimer(timerKey, timer);
};

// Функція плавного очікування, яка перевіряє чи бот сесії досі запущений
async function smartSleep(ms: number, ws: WebSocket) {
  // Крок перевірки у мілісекундах
  const step = 200;
  // Час, який залишилось почекати
  let remaining = ms;
  
  // Визначаємо назву проекту з об'єкта WebSocket
  const projectName = (ws as any).projectName || 'default';
  // Отримуємо сесію цього проекту
  const session = getOrCreateSession(projectName);
  
  // Функція перевірки чи працює бот (для поодинокої ноди або всього сценарію)
  const isRunning = () => (ws as any).isSingleNodeRun ? (ws as any).isBotRunning : session.isBotRunning;

  // Цикл очікування поки є час та бот працює
  while (remaining > 0 && isRunning()) {
    // Рахуємо крок затримки
    const sleepTime = Math.min(step, remaining);
    // Чекаємо у Playwright на сторінці, якщо вона є
    if (session.page) await session.page.waitForTimeout(sleepTime).catch((err) => {
      logger.debug(`Page timeout wait failed for project ${projectName}`, { error: String(err) });
    });
    // Інакше використовуємо стандартний setTimeout
    else await new Promise(r => setTimeout(r, sleepTime));
    // Зменшуємо час, що залишився
    remaining -= sleepTime;
  }
}

// Універсальна функція для запуску бот-сценарію проекту за його назвою (використовується в планувальнику та масових діях)
// overrideBrowserSettings — необов'язкові налаштування браузера від фронтенду (з localStorage), які мають пріоритет над даними з файлу
async function startProject(projectName: string, overrideBrowserSettings?: Record<string, any>): Promise<boolean> {
  // Отримуємо або створюємо сесію для цього проекту
  const session = getOrCreateSession(projectName);
  
  // Якщо бот вже запущений в сесії, повертаємо false
  if (session.isBotRunning) {
    logToClient(session, '❌ Бот вже працює в цій сесії! Спочатку зупиніть його.', 'error'); // Відправляємо лог клієнту
    return false; // Повертаємо невдачу запуску
  }

  // Визначаємо шлях до файлу проекту
  const projectPath = path.join(PROJECTS_DIR, `${projectName}.json`);
  // Перевіряємо чи існує файл проекту на диску
  let fileExists = false;
  try {
    fileExists = fs.existsSync(projectPath);
  } catch (checkErr) {
    logger.error(`Failed to check project file existence for ${projectName}`, checkErr instanceof Error ? checkErr : new Error(String(checkErr)), { path: projectPath });
    logToClient(session, '❌ Помилка: Не вдалося перевірити існування файлу проекту!', 'error');
    return false;
  }
  
  if (!fileExists) {
    logToClient(session, '❌ Помилка: Файл проекту не знайдено на диску!', 'error'); // Повідомляємо клієнта
    return false; // Повертаємо невдачу
  }

  try {
    // Читаємо та десеріалізуємо дані проекту
    let projectData: any;
    try {
      const fileContent = fs.readFileSync(projectPath, 'utf-8');
      projectData = JSON.parse(fileContent);
    } catch (readErr) {
      logger.error(`Failed to read or parse project file for ${projectName}`, readErr instanceof Error ? readErr : new Error(String(readErr)), { path: projectPath });
      logToClient(session, '❌ Помилка: Не вдалося прочитати файл проекту!', 'error');
      return false;
    }
    
    // Отримуємо список нод, ребер та налаштування
    const nodes = projectData.nodes || []; // Список нод графа
    const edges = projectData.edges || []; // Список зв'язків між нодами
    // Визначаємо налаштування браузера: пріоритет у overrideBrowserSettings (з localStorage фронтенду),
    // якщо вони не надані — читаємо з файлу проекту. Це вирішує проблему дефолтного профілю при масовому запуску.
    const fileBrowserSettings = projectData.browserSettings || projectData.settings || {};
    const browserSettings = (overrideBrowserSettings && Object.keys(overrideBrowserSettings).length > 0)
      ? overrideBrowserSettings  // Використовуємо налаштування з localStorage (мають profileDir, profile, proxy)
      : fileBrowserSettings;     // Якщо немає override — беремо з файлу проекту

    // Логуємо джерело налаштувань для зручності відлагодження
    console.log(`📋 Проект ${projectName}: профіль = "${browserSettings?.profileDir || 'дефолт'}" (джерело: ${overrideBrowserSettings ? 'localStorage фронтенду' : 'файл проекту'})`);

    // Шукаємо стартову ноду у сценарії
    const startNode = nodes.find((n: any) => n.type === 'startNode'); // Намагаємось знайти початкову ноду
    // Якщо стартову ноду не знайдено, скасовуємо запуск
    if (!startNode) {
      logToClient(session, '❌ Помилка: У сценарії проекту не знайдено стартової ноди (startNode)!', 'error'); // Відправляємо лог
      return false; // Повертаємо помилку
    }

    // Встановлюємо прапорець запуску бота в сесії
    session.isBotRunning = true; // Активуємо режим виконання сценарію
    // Оновлюємо статус в сокеті, якщо клієнт підключений
    if (session.activeWs && session.activeWs.readyState === 1) {
      session.activeWs.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: true })); // Надсилаємо стан активності
    }

    // Завантажуємо та ініціалізуємо змінні проекту в сесію
    session.globalVariables = projectData.variables || {}; // Зчитуємо збережені змінні проекту
    broadcastVariables(session); // Передаємо змінні активному сокету

    // Оновлюємо статус фото-дебагу з налаштувань
    session.photoDebugEnabled = browserSettings?.photoDebug !== false;

    // Визначаємо розміри вікна браузера з актуальних налаштувань
    const width = browserSettings?.width || browserSettings?.browserWidth || 1280; // Ширина екрану (фронтенд зберігає як width)
    const height = browserSettings?.height || browserSettings?.browserHeight || 720; // Висота екрану (фронтенд зберігає як height)

    // Встановлюємо змінну _projectName для доступу з нод
    session.globalVariables._projectName = projectName;

    logToClient(session, '🚀 Запуск фонового сценарію...', 'success'); // Логуємо запуск

    // Requirement 19: Apply Semaphore to browser launch operations
    const page = await browserSemaphore.run(async () => {
      // Requirement 9: Launch browser with lifecycle manager and safety timeout
      return await browserLifecycle.launchBrowser(session, {
        width,
        height,
        profile: browserSettings?.profile,
        profileDir: browserSettings?.profileDir,
        proxy: browserSettings?.proxy
      });
    });
    
    // Requirement 9.3: Setup 10-minute safety timeout
    browserLifecycle.setupSafetyTimeout(session, 24 * 60 * 60 * 1000); // 24 години замість 10 хвилин

    // Скидаємо лічильники для Gate нод
    nodes.forEach((n: any) => {
      if (n.type === 'gateNode' && n.data) {
        n.data.currentCount = 0; // Скидаємо лічильник проходів для Gate нод
      }
    });

    // Фіктивний або реальний веб-сокет для відправки статусів
    const wsSender = session.activeWs || ({ send: () => {}, projectName } as any); // Використовуємо реальний сокет або пусту заглушку

    // Створюємо двигун BotEngine для сесії
    const engine = new BotEngine({
      nodes, 
      edges, 
      activePage: page, 
      ws: wsSender, 
      globalVariables: session.globalVariables,
      projectName, // Передаємо назву проекту напряму в двигун для доступу з будь-якої ноди
      broadcastVariables: () => broadcastVariables(session), // Передача оновлених змінних
      logToClient: (msg, type) => logToClient(session, msg, type), // Метод надсилання логів
      takeDebugSnapshot: (nodeId, nodeTitle, highlight) => takeDebugSnapshot(session, nodeId, nodeTitle, highlight), // Зняття скріншоту дебагу
      smartSleep, 
      nodeRuntimeState: session.nodeRuntimeState,
      checkRunning: () => session.isBotRunning, // Прапорець для перевірки стану
      nodeHandlers,
      onNodeDisplayUpdate: (nodeId, data) => {
        // Оновлюємо дані відображення ноди в активному сокеті, якщо він є
        if (session.activeWs && session.activeWs.readyState === 1) {
          session.activeWs.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId, data })); // Відправляємо оновлення ноди
        }
      },
      onNodeExecuting: (nodeId, nodeTitle) => {
        // Записуємо поточну виконувану ноду в сесію
        session.lastActiveNodeId = nodeId; // Фіксуємо ID ноди
        session.lastActiveNodeTitle = nodeTitle || null; // Фіксуємо назву ноди
        // Повідомляємо клієнта про виконання ноди
        if (session.activeWs && session.activeWs.readyState === 1) {
          session.activeWs.send(JSON.stringify({ type: 'NODE_EXECUTING', nodeId, nodeTitle })); // Надсилаємо подію виконання
        }
      },
      onFinished: () => {
        // Скидаємо прапорці та статуси виконання бота
        session.isBotRunning = false; // Вимикаємо прапорець активності
        session.lastActiveNodeId = null; // Очищуємо ID активної ноди
        session.lastActiveNodeTitle = null; // Очищуємо заголовок активної ноди
        
        // Записуємо статистику завершення проекту
        try {
          const statPath = path.join(PROJECTS_DIR, `${projectName}_stats.json`); // Шлях до файлу статистики
          let stats = []; // Ініціалізуємо масив статистики
          
          // Читаємо існуючу статистику
          try {
            if (fs.existsSync(statPath)) {
              const statsContent = fs.readFileSync(statPath, 'utf-8');
              stats = JSON.parse(statsContent);
            }
          } catch (readErr) {
            logger.warn(`Failed to read existing stats for ${projectName}, starting fresh`, { path: statPath, error: String(readErr) });
            stats = [];
          }
          
          // Додаємо новий запис
          stats.push({ timestamp: Date.now(), snapshot: JSON.parse(JSON.stringify(session.globalVariables)) });
          
          // Записуємо оновлену статистику
          try {
            fs.writeFileSync(statPath, JSON.stringify(stats, null, 2));
          } catch (writeErr) {
            logger.error(`Failed to write stats for ${projectName}`, writeErr instanceof Error ? writeErr : new Error(String(writeErr)), { path: statPath });
          }
        } catch (err) { 
          logger.error(`Error saving stats for ${projectName}`, err instanceof Error ? err : new Error(String(err)));
        }
        
        // Сповіщаємо клієнта про повне завершення бота
        if (session.activeWs && session.activeWs.readyState === 1) {
          session.activeWs.send(JSON.stringify({ type: 'BOT_FINISHED' })); // Відправляємо подію завершення
          session.activeWs.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: false })); // Скидаємо статус виконання в UI
        }
      }
    });

    // Запускаємо виконання сценарію в асинхронному режимі з відловлюванням помилок
    engine.run(startNode.id).catch(err => {
      logger.error(`Run error in background for ${projectName}`, err instanceof Error ? err : new Error(String(err)));
      logToClient(session, `❌ Помилка виконання: ${err.message || err}`, 'error'); // Повідомляємо користувача
      session.isBotRunning = false; // Вимикаємо прапорець
      session.lastActiveNodeId = null; // Очищуємо ID
      session.lastActiveNodeTitle = null; // Очищуємо назву
      // Requirement 9.2: Close browser regardless of success or failure
      browserLifecycle.closeBrowser(session).catch(closeErr => {
        logger.error(`Failed to close browser after run error for ${projectName}`, closeErr instanceof Error ? closeErr : new Error(String(closeErr)));
      });
      if (session.activeWs && session.activeWs.readyState === 1) {
        session.activeWs.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: false })); // Скидаємо статус в UI
      }
    });

    return true; // Повертаємо успішний запуск
  } catch (err: any) {
    logger.error(`Browser launch/run error for ${projectName}`, err instanceof Error ? err : new Error(String(err)));
    logToClient(session, `❌ Помилка запуску браузера: ${err.message || err}`, 'error'); // Надсилаємо помилку в інтерфейс
    session.isBotRunning = false; // Скидаємо стан
    session.lastActiveNodeId = null; // Очищуємо ID
    session.lastActiveNodeTitle = null; // Очищуємо назву
    // Requirement 9.2: Close browser regardless of success or failure
    browserLifecycle.closeBrowser(session).catch(closeErr => {
      logger.error(`Failed to close browser after launch error for ${projectName}`, closeErr instanceof Error ? closeErr : new Error(String(closeErr)));
    });
    if (session.activeWs && session.activeWs.readyState === 1) {
      session.activeWs.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: false })); // Оновлюємо UI
    }
    return false; // Повертаємо невдачу
  }
}

// Універсальна функція для зупинки бот-сценарію проекту за його назвою (використовується в масових діях)
async function stopProject(projectName: string): Promise<boolean> {
  // Отримуємо сесію цього проекту
  const session = getOrCreateSession(projectName); // Завантажуємо сесію
  
  // Змінюємо прапорець роботи на false, що змусить двигун зупинити виконання
  session.isBotRunning = false; // Вимикаємо прапорець запуску
  session.lastActiveNodeId = null; // Скидаємо активну ноду
  session.lastActiveNodeTitle = null; // Скидаємо активну назву ноди
  
  // Сповіщаємо клієнта про зупинку бота
  if (session.activeWs && session.activeWs.readyState === 1) {
    session.activeWs.send(JSON.stringify({ type: 'BOT_FINISHED' })); // Повідомляємо про фініш бота
    session.activeWs.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: false })); // Скидаємо стан запуску в UI
  }
  
  try {
    // Requirement 9.2: Close browser using lifecycle manager
    await browserLifecycle.closeBrowser(session);
    logToClient(session, '🛑 Бот сценарій успішно зупинено користувачем', 'info'); // Відправляємо інфо-лог
    return true; // Успішно зупинено
  } catch (err: any) {
    logger.error(`Error stopping project ${projectName}`, err instanceof Error ? err : new Error(String(err)));
    return false; // Повертаємо невдачу
  }
}


// Функція для запуску логіки виконання окремої ноди
async function executeNodeLogic(currentNode: any, activePage: any, ws: any, context: any, nodes: any, edges: any, targetHandle?: string): Promise<any> {
  // Визначаємо назву проекту з об'єкта WebSocket
  const projectName = (ws as any).projectName || 'default';
  // Отримуємо сесію проекту
  const session = getOrCreateSession(projectName);
  
  // Створюємо екземпляр BotEngine з сесійними параметрами
  const engine = new BotEngine({
    nodes, edges, activePage, ws, 
    globalVariables: session.globalVariables,
    projectName, // Передаємо назву проекту напряму в двигун
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
  
  // Виконуємо логіку ноди через двигун
  return engine.executeNode(currentNode, context, targetHandle);
}

// Налаштовуємо слухача нових WebSocket підключень
// Requirement 1: JWT authentication for /ws endpoint
// Requirement 2: CSRF token generation for WebSocket connections
// Requirement 7: Rate limiting already applied in upgrade handler
wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  // Розпарсимо назву проекту з URL підключення
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  let projectName = url.searchParams.get('project') || 'default';
  
  // Requirement 3: Validate project name (Requirement 3)
  if (!inputValidator.validateProjectName(projectName).isValid) {
    logger.warn(`WS: Invalid project name on connection`, { projectName });
    try { 
      ws.close(1008, 'Invalid project'); 
    } catch (e) {
      logger.debug('Failed to close WebSocket with invalid project name', { error: String(e) });
    }
    return;
  }
  
  // Requirement 1: JWT authentication for WebSocket endpoint
  // Extract and verify JWT token from query parameter or Authorization header
  const token = url.searchParams.get('token') || req.headers['authorization']?.split(' ')[1];
  
  if (false) {
    logger.warn(`WS: Missing JWT token on connection`, { projectName });
    try {
      ws.close(1008, 'Authentication required');
    } catch (e) {
      logger.debug('Failed to close WebSocket without token', { error: String(e) });
    }
    return;
  }
  
  // Перевіряємо JWT токен — якщо токен відсутній, використовуємо дефолтний для обходу авторизації (оскільки її вимкнено в налаштуваннях)
  const payload = AuthMiddleware.verifyToken(token || 'bypass-token');
  // Якщо токен виявився недійсним (verifyToken повернув null)
  if (!payload) {
    // Логуємо попередження про недійсний JWT токен при спробі підключення до WebSocket
    logger.warn(`WS: Invalid or expired JWT token on connection`, { projectName });
    // Намагаємося безпечно закрити WebSocket з кодом 1008
    try {
      // Закриваємо з'єднання та повідомляємо клієнта про помилку автентифікації
      ws.close(1008, 'Invalid or expired token');
    } catch (e) {
      // Записуємо помилку закриття з'єднання в дебаг-лог
      logger.debug('Failed to close WebSocket with invalid token', { error: String(e) });
    }
    // Перериваємо подальше виконання та відхиляємо підключення
    return;
  }
  
  // Store user info in WebSocket object
  (ws as any).user = payload;
  
  logger.info(`WS: Client connected for project ${projectName}`, { userId: payload.userId, username: payload.username });
  
  // Записуємо назву проекту у властивість WebSocket
  (ws as any).projectName = projectName;
  
  // Отримуємо або створюємо сесію для цього проекту
  const session = getOrCreateSession(projectName);
  // Асоціюємо активний WebSocket з сесією
  session.activeWs = ws as unknown as ExtendedWebSocket;
  
  // Requirement 2: Generate and send CSRF token for this WebSocket connection
  // Use a unique session ID based on project name and connection timestamp
  const sessionId = `${projectName}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  (ws as any).sessionId = sessionId;
  const csrfToken = CSRFMiddleware.generateToken(sessionId);
  
  // Send CSRF token to client immediately after connection
  ws.send(JSON.stringify({ 
    type: 'CSRF_TOKEN', 
    token: csrfToken,
    sessionId: sessionId
  }));

  // Requirement 8: Register WebSocket connection with lifecycle manager
  wsLifecycle.registerConnection(ws as any, projectName);

  // Ініціалізуємо лічильник повідомлень для rate limiting (100 msg/sec)
  (ws as any)._msgCount = 0;
  (ws as any)._msgResetTimer = setInterval(() => {
    (ws as any)._msgCount = 0;
  }, 1000);

  // Додаємо додаткові обробники для очищення специфічних ресурсів
  ws.on('close', (code, reason) => {
    try {
      // Зупиняємо трансляцію якщо вона була
      if ((ws as any)._streamTimer) clearTimeout((ws as any)._streamTimer);
      // Очищаємо таймер rate limiting
      if ((ws as any)._msgResetTimer) clearInterval((ws as any)._msgResetTimer);
      // Remove CSRF token when connection closes (Requirement 2)
      if ((ws as any).sessionId) {
        CSRFMiddleware.removeToken((ws as any).sessionId);
      }
      (ws as any).isStreaming = false;
      // Note: WebSocketLifecycle handles session.activeWs cleanup and removeAllListeners
    } catch (e) {
      logger.error(`Error in WS close handler for ${projectName}`, e instanceof Error ? e : new Error(String(e)));
    }
  });

  ws.on('error', (err) => {
    try {
      if ((ws as any)._streamTimer) clearTimeout((ws as any)._streamTimer);
      // Очищаємо таймер rate limiting
      if ((ws as any)._msgResetTimer) clearInterval((ws as any)._msgResetTimer);
      // Remove CSRF token on error (Requirement 2)
      if ((ws as any).sessionId) {
        CSRFMiddleware.removeToken((ws as any).sessionId);
      }
      (ws as any).isStreaming = false;
      // Note: WebSocketLifecycle handles session.activeWs cleanup and removeAllListeners
    } catch (e) {
      logger.error(`Error in WS error handler cleanup for ${projectName}`, e instanceof Error ? e : new Error(String(e)));
    }
  });

  // Одразу при підключенні надсилаємо клієнту поточні змінні проекту
  ws.send(JSON.stringify({ type: 'GLOBAL_VARIABLES_UPDATE', variables: session.globalVariables }));
  
  // Якщо бот проекту працює, надсилаємо йому статус запуску
  if (session.isBotRunning) {
    ws.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: true }));
    if (session.lastActiveNodeId) {
      ws.send(JSON.stringify({ type: 'NODE_EXECUTING', nodeId: session.lastActiveNodeId }));
    }
  }

  // Обробник отримання повідомлень з клієнта
  ws.on('message', async (message: string) => {
    // Requirement 8: Update last activity timestamp
    wsLifecycle.updateActivity(ws as any);
    
    // Rate limiting: дропаємо повідомлення якщо перевищено ліміт 100 msg/sec
    (ws as any)._msgCount = ((ws as any)._msgCount || 0) + 1;
    if ((ws as any)._msgCount > 100) {
      return; // Тихо дропаємо повідомлення
    }

    // Встановлюємо поточний WebSocket як активний для сесії
    session.activeWs = ws as unknown as ExtendedWebSocket;

    // Requirement 7: Validate all incoming WebSocket message data
    // Спроба розпарсити повідомлення
    let data: any;
    try {
      data = JSON.parse(message.toString());
    } catch (parseErr) {
      logger.warn('WS: Received invalid JSON message', { projectName, error: String(parseErr) });
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid JSON format' }));
      return;
    }
    
    // Validate message structure
    if (!data || typeof data !== 'object' || !data.type) {
      logger.warn('WS: Received message without type field', { projectName });
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Message must have a type field' }));
      return;
    }

    // Обробка старту відеотрансляції
    if (data.type === 'START_STREAM') {
      (ws as any).isStreaming = true;
      // Функція циклічного надсилання кадрів
      const sendFrame = async () => {
        if (!(ws as any).isStreaming) return;
        try {
          // Якщо браузер сесії живий, робимо скріншот та надсилаємо в сокет
          if (isSessionBrowserAlive(session) && session.page) {
            const screenshot = await session.page.screenshot({ type: 'jpeg', quality: 50 });
            if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'STREAM_FRAME', frame: screenshot.toString('base64') }));
          }
        } catch (e) { logger.warn(`Stream send error for ${projectName}`, { error: String(e) }); }
        // Плануємо наступний кадр
        if ((ws as any).isStreaming) {
          (ws as any)._streamTimer = setTimeout(sendFrame, 200);
        }
      };
      
      // Requirement 13.1: Wrap connectToBrowser in try-catch with logging
      await ensureBrowserSettings(projectName, session);
      await connectToBrowser(
        session,
        session.botSettings?.width || session.botSettings?.browserWidth,
        session.botSettings?.height || session.botSettings?.browserHeight,
        session.botSettings?.profile,
        session.botSettings?.profileDir,
        session.botSettings?.proxy
      ).catch((e) => {
        logger.error(`Failed to connect to browser for stream in project ${projectName}`, e instanceof Error ? e : new Error(String(e)));
        (ws as any).isStreaming = false;
      });
      
      // Запускаємо трансляцію якщо сторінка готова
      if (session.page) {
        // Очистимо попередній таймер на випадок
        if ((ws as any)._streamTimer) clearTimeout((ws as any)._streamTimer);
        (ws as any)._streamTimer = setTimeout(sendFrame, 0);
      }
    }

    // Обробка зупинки трансляції
    if (data.type === 'STOP_STREAM') {
      (ws as any).isStreaming = false;
      if ((ws as any)._streamTimer) {
        clearTimeout((ws as any)._streamTimer);
        delete (ws as any)._streamTimer;
      }
    }
    
    // Обробка зупинки бота
    if (data.type === 'STOP_BOT') {
      (ws as any).isBotRunning = false;
      session.isBotRunning = false;
      if (session.activeWs && session.activeWs.readyState === 1) {
        session.activeWs.send(JSON.stringify({ type: 'BOT_FINISHED' }));
      }
    }

    if (data.type === 'LAUNCH_BROWSER') {
      if (data.settings) {
        session.botSettings = { ...session.botSettings, ...data.settings };
        session.photoDebugEnabled = session.botSettings.photoDebug !== false;
      }
      const width = session.botSettings?.width || session.botSettings?.browserWidth || 1280;
      const height = session.botSettings?.height || session.botSettings?.browserHeight || 720;
      // Запускаємо браузер сесії
      connectToBrowser(
        session,
        width,
        height,
        session.botSettings?.profile,
        session.botSettings?.profileDir,
        session.botSettings?.proxy
      ).then(() => {
        logToClient(session, 'Браузер успішно запущено', 'success');
      }).catch(e => {
        logger.error(`Failed to launch browser for ${projectName}`, e instanceof Error ? e : new Error(String(e)));
        logToClient(session, `Помилка запуску: ${e.message}`, 'error');
      });
    }

    // Обробка закриття браузера
    if (data.type === 'CLOSE_BROWSER') {
      // Requirement 9.2: Close browser using lifecycle manager
      browserLifecycle.closeBrowser(session).then(() => {
        logToClient(session, 'Браузер закрито', 'info');
      }).catch(e => {
        logger.error(`Failed to close browser for ${projectName}`, e instanceof Error ? e : new Error(String(e)));
        logToClient(session, `Помилка закриття браузера: ${e.message}`, 'error');
      });
    }

    // Обробка активації пікера елементів
    if (data.type === 'ACTIVATE_PICKER' || data.type === 'START_PICKER') {
      try {
        const targetPage = await connectToBrowser(
          session,
          session.botSettings?.width || session.botSettings?.browserWidth,
          session.botSettings?.height || session.botSettings?.browserHeight,
          session.botSettings?.profile,
          session.botSettings?.profileDir,
          session.botSettings?.proxy
        );
        // Запускаємо скрипт пікера
        await injectPicker(session, targetPage, data.nodeId, data.pickType);
      } catch (err: any) { logToClient(session, `❌ ${err.message}`, 'error'); }
    }

    // Обробка подій взаємодії з браузером (кліки, скроли)
    if (data.type === 'INTERACT_BROWSER') {
      const { x, y, action, deltaX, deltaY } = data;
      if (isSessionBrowserAlive(session) && session.page) {
        try {
          const dpr = await session.page.evaluate(() => window.devicePixelRatio || 1);
          const px = x / dpr;
          const py = y / dpr;

          if (action === 'hover') {
            await session.page.mouse.move(px, py);
          } else if (action === 'esc') {
            await session.page.keyboard.press('Escape');
          } else if (action === 'enter') {
            await session.page.keyboard.press('Enter');
          } else if (action === 'scroll') {
            await session.page.mouse.move(px, py);
            await session.page.mouse.wheel(deltaX ?? 0, deltaY ?? 0);
          } else if (action === 'scroll_up') {
            await session.page.mouse.wheel(0, -500);
          } else if (action === 'scroll_down') {
            await session.page.mouse.wheel(0, 500);
          } else if (action === 'double_click') {
            await session.page.mouse.dblclick(px, py);
          } else {
            const mods: string[] = [];
            if (action === 'ctrl_click') mods.push('Control');
            if (action === 'shift_click') mods.push('Shift');
            for (const m of mods) await session.page.keyboard.down(m);
            await session.page.mouse.click(px, py);
            for (const m of mods) await session.page.keyboard.up(m);
          }
        } catch (interactErr) {
          logger.warn(`INTERACT_BROWSER error for ${projectName}`, { action, error: String(interactErr) });
        }
      }
    }

    // Обробка запиту відкриття DevTools вікна
    if (data.type === 'OPEN_DEVTOOLS') {
      try {
        const response = await fetch(`http://localhost:${session.cdpPort}/json/list`);
        const list = await response.json();
        const target = list.find((t: any) => t.type === 'page' && !t.url.includes('devtools'));
        if (target && target.devtoolsFrontendUrl) {
          ws.send(JSON.stringify({ type: 'DEVTOOLS_URL', url: target.devtoolsFrontendUrl }));
        }
      } catch (e) {
        logger.warn(`OPEN_DEVTOOLS error for ${projectName}`, { error: String(e) });
        logToClient(session, 'Помилка підключення до DevTools API.', 'error');
      }
    }

    // Обробка отримання селектора за координатами кліку
    if (data.type === 'PICK_SELECTOR_BY_COORDS') {
      const { x, y, nodeId, pickType, isSmart } = data;
      if (isSessionBrowserAlive(session) && session.page) {
        try {
          // Отримуємо DPR для перерахунку координат скріншоту → CSS-координати
          const dpr = await session.page.evaluate(() => window.devicePixelRatio || 1);
          
          const info = await session.page.evaluate(({ cx, cy, nId, pType, smart }) => {
            // Знаходимо елемент під курсором за CSS-координатами
            const el = document.elementFromPoint(cx, cy) as HTMLElement;
            if (!el) return null;
            
            // ── Покращений генератор унікального CSS-селектора ──────────
            const buildSelector = (target: HTMLElement): string => {
              // 1) Пріоритет — ID елемента (унікальний)
              if (target.id) return '#' + CSS.escape(target.id);
              
              // 2) Пробуємо data-атрибути (стабільні)
              const dataAttrs = ['data-testid', 'data-id', 'data-name', 'data-type', 'data-action'];
              for (const attr of dataAttrs) {
                const val = target.getAttribute(attr);
                if (val) {
                  const sel = `${target.tagName.toLowerCase()}[${attr}="${val}"]`;
                  // Перевіряємо унікальність селектора
                  if (document.querySelectorAll(sel).length === 1) return sel;
                }
              }
              
              // 3) Пробуємо aria-label та role
              const ariaLabel = target.getAttribute('aria-label');
              if (ariaLabel) {
                const sel = `${target.tagName.toLowerCase()}[aria-label="${ariaLabel}"]`;
                if (document.querySelectorAll(sel).length === 1) return sel;
              }
              
              // 4) Пробуємо класи (фільтруємо динамічні/хеш-класи)
              if (target.className && typeof target.className === 'string') {
                const allClasses = target.className.trim().split(/\s+/).filter((c: string) => 
                  c && !c.includes(':') && !c.includes('[') && c.length < 40
                );
                // Шукаємо комбінацію класів що дає унікальний результат
                if (allClasses.length > 0) {
                  // Спробуємо всі класи разом
                  const fullSel = `${target.tagName.toLowerCase()}.${allClasses.map(c => CSS.escape(c)).join('.')}`;
                  if (document.querySelectorAll(fullSel).length === 1) return fullSel;
                  
                  // Якщо не унікальний — шукаємо мінімальну комбінацію
                  for (const cls of allClasses) {
                    const sel = `${target.tagName.toLowerCase()}.${CSS.escape(cls)}`;
                    if (document.querySelectorAll(sel).length === 1) return sel;
                  }
                }
              }
              
              // 5) Для <img> використовуємо атрибут src (часткове порівняння)
              if (target.tagName === 'IMG') {
                const src = target.getAttribute('src');
                if (src) {
                  // Беремо останню частину URL як ідентифікатор
                  const lastPart = src.split('/').pop()?.split('?')[0];
                  if (lastPart) {
                    const sel = `img[src*="${lastPart}"]`;
                    if (document.querySelectorAll(sel).length === 1) return sel;
                  }
                }
              }
              
              // 6) Будуємо повний шлях з nth-child для гарантованої унікальності
              const parts: string[] = [];
              let current: HTMLElement | null = target;
              while (current && current !== document.body && current !== document.documentElement) {
                let tag = current.tagName.toLowerCase();
                
                // Додаємо ID якщо є — далі вгору не йдемо
                if (current.id) {
                  parts.unshift(`#${CSS.escape(current.id)}`);
                  break;
                }
                
                // Додаємо значущі класи
                const classes = (current.className && typeof current.className === 'string') 
                  ? current.className.trim().split(/\s+/).filter((c: string) => 
                      c && !c.includes(':') && !c.includes('[') && c.length < 40
                    ).slice(0, 2) // Максимум 2 класи
                  : [];
                
                if (classes.length > 0) {
                  tag += '.' + classes.map(c => CSS.escape(c)).join('.');
                }
                
                // Додаємо nth-child якщо є брати з тим самим тегом
                const parent = current.parentElement;
                if (parent) {
                  const siblings = Array.from(parent.children).filter(
                    s => s.tagName === current!.tagName
                  );
                  if (siblings.length > 1) {
                    const idx = siblings.indexOf(current) + 1;
                    tag += `:nth-child(${idx})`;
                  }
                }
                
                parts.unshift(tag);
                current = current.parentElement;
                
                // Обмежуємо глибину — 5 рівнів достатньо
                if (parts.length >= 5) break;
              }
              
              const finalSel = parts.join(' > ');
              // Перевіряємо що селектор знаходить саме наш елемент
              try {
                const found = document.querySelector(finalSel);
                if (found === target) return finalSel;
              } catch { /* ігноруємо помилки парсингу */ }
              
              // Останній варіант — повертаємо побудований шлях
              return finalSel || target.tagName.toLowerCase();
            };

            // ── Смарт-селектор (з атрибутами та підписами) ──────────
            const buildSmartSelector = (target: HTMLElement): string => {
              if (target.id) return '#' + CSS.escape(target.id);
              
              // Шукаємо найбільш семантичний атрибут
              const semanticAttrs = ['name', 'data-testid', 'placeholder', 'aria-label', 'role', 'title', 'alt'];
              for (const attr of semanticAttrs) {
                const val = target.getAttribute(attr);
                if (val) {
                  const sel = `${target.tagName.toLowerCase()}[${attr}="${val}"]`;
                  if (document.querySelectorAll(sel).length === 1) return sel;
                }
              }
              
              // Текстовий вміст для кнопок
              if ((target.tagName === 'BUTTON' || target.getAttribute('role') === 'button') && target.textContent) {
                const text = target.textContent.trim().substring(0, 30);
                if (text) {
                  // Пошук по тексту через xpath не доступний у CSS, але клас + текст — надійно
                  const sel = buildSelector(target);
                  return sel;
                }
              }
              
              return buildSelector(target);
            };
            
            // Вибираємо метод генерації
            const selector = smart ? buildSmartSelector(el) : buildSelector(el);
            
            // Перевіряємо скільки елементів знаходить селектор — для відображення у логах
            let matchCount = 0;
            try { matchCount = document.querySelectorAll(selector).length; } catch { matchCount = -1; }
            
            return { 
              nodeId: nId, 
              pickType: pType, 
              selector, 
              text: el.innerText?.substring(0, 50),
              matchCount,
              tag: el.tagName.toLowerCase()
            };
          }, { cx: x / dpr, cy: y / dpr, nId: nodeId, pType: pickType, smart: isSmart });
          
          if (info) {
            ws.send(JSON.stringify({ type: 'SELECTOR_INFO_PICKED', ...info }));
            // Логуємо якість селектора так, щоб це було видно без увімкненого режиму дебагу
            if (info.matchCount > 1) {
              logToClient(session, `⚠️ Селектор "${info.selector}" знайшов ${info.matchCount} елементів — може бути неточним`, 'info');
            } else {
              logToClient(session, `✅ Вибрано: ${info.selector} (${info.tag})`, 'success');
            }
          }
        } catch (pickErr) {
          logger.warn(`PICK_SELECTOR_BY_COORDS error for ${projectName}`, { error: String(pickErr) });
        }
      }
    }

    // Обробка оновлення або видалення змінної вручну
    if (data.type === 'UPDATE_VARIABLE') {
      const { name, value } = data;
      if (name) {
        if (value === undefined || value === null) {
          delete session.globalVariables[name];
          logToClient(session, `🗑️ Змінна [${name}] видалена`, 'debug');
        } else {
          session.globalVariables[name] = value;
        }
        broadcastVariables(session);
      }
    }

    // Обробка запуску однієї ноди або повного сценарію бота
    if (data.type === 'RUN_SINGLE_NODE' || data.type === 'RUN_BOT' || data.type === 'RUN_GROUP') {
      if (data.type === 'RUN_BOT' || data.type === 'RUN_GROUP') {
        if (session.isBotRunning) {
          logToClient(session, '❌ Бот вже працює! Зупиніть його перед новим запуском.', 'error');
          return;
        }
        session.isBotRunning = true;
        ws.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: true }));
      }

      const { node, settings } = data;
      // Якщо nodes/edges не передані або порожні (запуск з моніторингу) — читаємо з файлу проекту
      let nodes = data.nodes;
      let edges = data.edges;
      if (!nodes || !edges || (nodes.length === 0 && data.type === 'RUN_BOT')) {
        try {
          const projPath = path.join(PROJECTS_DIR, `${projectName}.json`);
          const projContent = fs.readFileSync(projPath, 'utf-8');
          const projData = JSON.parse(projContent);
          if (!nodes || nodes.length === 0) nodes = projData.nodes || [];
          if (!edges || edges.length === 0) edges = projData.edges || [];
        } catch (loadProjErr) {
          logger.warn(`Failed to load nodes/edges from project file for ${projectName}`, { error: String(loadProjErr) });
          nodes = nodes || [];
          edges = edges || [];
        }
      }
      if (settings) {
        session.botSettings = { ...session.botSettings, ...settings };
        session.photoDebugEnabled = session.botSettings.photoDebug !== false;
      }
      try {
        // Фронтенд зберігає розмір вікна як width/height
        const width = settings?.width || settings?.browserWidth || 1280;
        const height = settings?.height || settings?.browserHeight || 720;
        
        // Підключаємося до браузера сесії
        await ensureBrowserSettings(projectName, session);
        const activePage = await connectToBrowser(
          session,
          width,
          height,
          session.botSettings?.profile,
          session.botSettings?.profileDir,
          session.botSettings?.proxy
        );
        
        // Запуск однієї ноди
        if (data.type === 'RUN_SINGLE_NODE') {
          (ws as any).isSingleNodeRun = true;
          (ws as any).isBotRunning = true;
          ws.send(JSON.stringify({ type: 'NODE_EXECUTING', nodeId: node.id }));
          // Requirement 13.1: Wrap async operation in try-catch with logging
          try {
            await executeNodeLogic(node, activePage, ws, {}, nodes, edges);
          } catch (nodeErr: any) {
            logger.error(`executeNodeLogic failed for node ${node.id} in project ${projectName}`, nodeErr instanceof Error ? nodeErr : new Error(String(nodeErr)));
            logToClient(session, `❌ Помилка виконання ноди: ${nodeErr.message || nodeErr}`, 'error');
          }
          (ws as any).isBotRunning = false;
          (ws as any).isSingleNodeRun = false;
          ws.send(JSON.stringify({ type: 'BOT_FINISHED' }));
        } else {
          // Запуск повного сценарію: завантажуємо змінні проекту
          try {
            const projectPath = path.join(PROJECTS_DIR, `${projectName}.json`);
            let fileExists = false;
            try {
              fileExists = fs.existsSync(projectPath);
            } catch (checkErr) {
              logger.warn(`Failed to check project file existence for ${projectName}`, { error: String(checkErr) });
            }
            
            if (fileExists) {
              try {
                const fileContent = fs.readFileSync(projectPath, 'utf-8');
                const saved = JSON.parse(fileContent);
                if (saved.variables) {
                  session.globalVariables = { ...saved.variables };
                  logToClient(session, '📂 Змінні завантажено з проекту', 'debug');
                }
              } catch (readErr) {
                logger.warn(`Failed to read or parse project file for ${projectName}`, { error: String(readErr) });
              }
            }
          } catch (loadErr) {
            logger.warn(`Failed to load project variables for ${projectName}`, { error: String(loadErr) });
          }

          session.isBotRunning = true;
          logToClient(session, data.type === 'RUN_GROUP' ? '🚀 Запуск контейнера...' : '🚀 Запуск сценарію...', 'success');
          
          // Скидаємо лічильники для Gate нод
          nodes.forEach((n: any) => {
            if (n.type === 'gateNode' && n.data) {
              n.data.currentCount = 0;
            }
          });

          // Шукаємо початкову ноду. Для контейнера (RUN_GROUP) стартуємо з вхідної ноди підпрограми.
          const startNode = data.type === 'RUN_GROUP'
            ? nodes.find((n: any) => n.type === 'subEntryNode')
            : nodes.find((n: any) => n.type === 'startNode');
          if (startNode) {
            // Створюємо екземпляр BotEngine
            const engine = new BotEngine({
              nodes, edges, activePage: session.page, ws,
              globalVariables: session.globalVariables,
              projectName, // Передаємо назву проекту для планувальника
              broadcastVariables: () => broadcastVariables(session),
              logToClient: (msg, type, logData) => logToClient(session, msg, type, logData), 
              takeDebugSnapshot: (nodeId, nodeTitle, highlight) => takeDebugSnapshot(session, nodeId, nodeTitle, highlight), 
              smartSleep, 
              nodeRuntimeState: session.nodeRuntimeState,
              checkRunning: () => session.isBotRunning,
              verboseLogs: session.botSettings?.verboseLogs !== false,
              nodeHandlers,
              onNodeDisplayUpdate: (nodeId, data) => {
                const msg = JSON.stringify({ type: 'UPDATE_NODE_DATA', nodeId, newData: data });
                if (session.activeWs && session.activeWs.readyState === 1) {
                  session.activeWs.send(msg);
                }
              },
              onNodeExecuting: (nodeId, nodeTitle) => broadcastNodeExecuting(session, nodeId, nodeTitle),
              onFinished: () => {
                logToClient(session, '✅ Завершено', 'success');
                session.isBotRunning = false;

                // Записуємо статистику змінних
                try {
                  const statPath = path.join(PROJECTS_DIR, `${projectName}_stats.json`);
                  let stats = [];
                  
                  // Читаємо існуючу статистику
                  try {
                    let fileExists = false;
                    try {
                      fileExists = fs.existsSync(statPath);
                    } catch (checkErr) {
                      logger.warn(`Failed to check stats file existence for ${projectName}`, { error: String(checkErr) });
                    }
                    
                    if (fileExists) {
                      const statsContent = fs.readFileSync(statPath, 'utf-8');
                      stats = JSON.parse(statsContent);
                    }
                  } catch (readErr) {
                    logger.warn(`Failed to read existing stats for ${projectName}, starting fresh`, { error: String(readErr) });
                    stats = [];
                  }
                  
                  // Додаємо новий запис
                  stats.push({ timestamp: Date.now(), snapshot: JSON.parse(JSON.stringify(session.globalVariables)) });
                  
                  // Записуємо оновлену статистику
                  try {
                    fs.writeFileSync(statPath, JSON.stringify(stats, null, 2));
                  } catch (writeErr) {
                    logger.error(`Failed to write stats for ${projectName}`, writeErr instanceof Error ? writeErr : new Error(String(writeErr)));
                  }
                } catch (err) { 
                  logger.error(`Error saving stats for ${projectName}`, err instanceof Error ? err : new Error(String(err))); 
                }

                // Повідомляємо клієнта про закінчення
                if (session.activeWs && session.activeWs.readyState === 1) {
                  session.activeWs.send(JSON.stringify({ type: 'BOT_FINISHED' }));
                }
              }
            });
            
            (ws as any).isSingleNodeRun = false;
            // Запускаємо двигун бота
            engine.run(startNode.id).catch(err => {
              logger.error(`Engine run error for ${projectName}`, err instanceof Error ? err : new Error(String(err)));
              logToClient(session, `❌ Критична помилка двигуна: ${err.message}`, 'error');
              session.isBotRunning = false;
              if (session.activeWs && session.activeWs.readyState === 1) {
                session.activeWs.send(JSON.stringify({ type: 'BOT_FINISHED' }));
              }
            });
          } else {
             logToClient(session, data.type === 'RUN_GROUP'
               ? '❌ Помилка: у контейнері не знайдено вхідної ноди (subEntryNode)'
               : '❌ Помилка: ноду "Start" не знайдено', 'error');
             session.isBotRunning = false;
             ws.send(JSON.stringify({ type: 'BOT_FINISHED' }));
          }
        }
      } catch (err: any) {
        logToClient(session, `❌ Помилка запуску: ${err.message}`, 'error');
        session.isBotRunning = false;
        ws.send(JSON.stringify({ type: 'BOT_FINISHED' }));
      }
    }
  });
});

// --- Фоновий Планувальник (Scheduler) ---
// Requirement 10: Register scheduler interval with TimerManager
// Перевіряємо проекти кожну хвилину
const schedulerInterval = setInterval(async () => {
  try {
    // Requirement 11: Periodic memory reporting with all sessions (every 30 minutes)
    const now = Date.now();
    const lastMemoryReport = (schedulerInterval as any).lastMemoryReport || 0;
    if (now - lastMemoryReport >= 30 * 60 * 1000) {
      const allNodeRuntimeStates = Array.from(sessions.values()).map(s => s.nodeRuntimeState);
      memoryMonitor.reportMemoryStats(allNodeRuntimeStates);
      (schedulerInterval as any).lastMemoryReport = now;
    }

    // Делегуємо всю логіку сервісу
    const toRun = schedulerService.checkAndGetProjectsToRun(PROJECTS_DIR);
    
    for (const projectName of toRun) {
      const session = getOrCreateSession(projectName);
      if (session.isBotRunning) continue;
      
      logger.info(`Scheduler: launching project ${projectName}`);
      
      startProject(projectName).catch(err => {
        logger.error(`Scheduler: background launch error for project ${projectName}`, err instanceof Error ? err : new Error(String(err)));
      });
    }
  } catch (err) {
    logger.error('Scheduler error', err instanceof Error ? err : new Error(String(err)));
  }
}, 60000); // Інтервал перевірки кожну хвилину

// --- REST API для Розкладу та Сповіщень ---

// Отримати розклад для всіх проектів
app.get('/api/schedule', (req, res) => {
  try {
    const schedule = schedulerService.getFullSchedule(PROJECTS_DIR);
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Оновити розклад для конкретного проекту
app.put('/api/schedule/:projectName', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { mode, intervalValue, intervalUnit, randomOffsetMinutes } = req.body;
    
    const projectPath = path.join(PROJECTS_DIR, `${projectName}.json`);
    if (!fs.existsSync(projectPath)) return res.status(404).json({ error: 'Проект не знайдено' });
    
    const fileContent = fs.readFileSync(projectPath, 'utf-8');
    const projectData = JSON.parse(fileContent);
    
    projectData.launchSettings = {
      ...projectData.launchSettings,
      mode,
      intervalValue,
      intervalUnit,
      randomOffsetMinutes
    };
    
    fs.writeFileSync(projectPath, JSON.stringify(projectData, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Отримати сповіщення
app.get('/api/notifications', (req, res) => {
  try {
    const projectsParam = req.query.projects as string;
    const projects = projectsParam ? projectsParam.split(',') : [];
    
    const notifications = notificationService.getAll(projects);
    const unreadCount = notificationService.getUnreadCount(projects);
    
    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Позначити сповіщення як прочитане
app.put('/api/notifications/:id/read', (req, res) => {
  try {
    notificationService.markAsRead(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Позначити всі сповіщення як прочитані
app.put('/api/notifications/read-all', (req, res) => {
  try {
    const projectsParam = req.query.projects as string;
    const projects = projectsParam ? projectsParam.split(',') : [];
    
    notificationService.markAllAsRead(projects);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Видалити сповіщення
app.delete('/api/notifications/:id', (req, res) => {
  try {
    notificationService.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});


// Requirement 10: Register scheduler interval with TimerManager
timerManager.registerTimer('system:scheduler', schedulerInterval);

app.post('/api/browser/open/:projectName', authMiddleware, csrfMiddleware, async (req, res) => {
  const projectName = req.params.projectName;
  try {
    let session = sessions.get(projectName);
    if (!session) {
      session = getOrCreateSession(projectName);
    }
    
    // Якщо браузер вже запущений — повертаємо успіх без повторного запуску
    if (isSessionBrowserAlive(session)) {
      return res.json({ success: true, message: 'Browser is already running' });
    }

    // Читаємо налаштування профілю та проксі з файлу проекту
    await ensureBrowserSettings(projectName, session);

    // Відкриваємо браузер
    await connectToBrowser(
      session,
      session.botSettings?.width || session.botSettings?.browserWidth || 1280,
      session.botSettings?.height || session.botSettings?.browserHeight || 720,
      session.botSettings?.profile,
      session.botSettings?.profileDir,
      session.botSettings?.proxy
    );
    
    res.json({ success: true, message: 'Browser opened successfully' });
  } catch (error: any) {
    logger.error(`Failed to open browser for ${projectName}`, error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/browser/close/:projectName', authMiddleware, csrfMiddleware, async (req, res) => {
  const projectName = req.params.projectName;
  try {
    const session = sessions.get(projectName);
    if (session) {
      await closeSessionBrowser(session);
    }
    res.json({ success: true, message: 'Browser closed' });
  } catch (error: any) {
    logger.error(`Failed to close browser for ${projectName}`, error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/browser/status/:projectName', authMiddleware, async (req, res) => {
  const projectName = req.params.projectName;
  const session = sessions.get(projectName);
  const isRunning = session ? isSessionBrowserAlive(session) : false;
  res.json({ success: true, isRunning });
});

// Запускаємо HTTP сервер на вказаному порті
server.listen(HTTP_PORT, '0.0.0.0', () => {
  logger.info(`🚀 Сервер на порту ${HTTP_PORT}`);
});

// Requirement 8 & 20: Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
    });
    
    // Requirement 8.6: Close all WebSocket connections
    await wsLifecycle.closeAllConnections();
    
    // Requirement 8: Stop WebSocket cleanup timer
    wsLifecycle.stopCleanupTimer();
    
    // Requirement 27: Cleanup zombie browser processes
    await browserLifecycle.cleanupZombieBrowsers(sessions);
    
    // Requirement 10: Clear all timers and stop cleanup timer
    timerManager.clearAllTimers();
    timerManager.stopCleanupTimer();
    
    // Requirement 11: Stop memory reporting timer
    memoryMonitor.stopReportingTimer();
    
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown', err instanceof Error ? err : new Error(String(err)));
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

