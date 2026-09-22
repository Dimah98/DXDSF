import express from 'express';
import cors from 'cors';
import http from 'http';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { Logger } from './logger';
import { apiRateLimiter } from './auth/RateLimiter';
import { PROJECTS_DIR, DEFAULT_HTTP_PORT } from './constants';
import routes from './routes';
import { setupWebSocketServer } from './websocket';
import { startMassLaunchScheduler, stopMassLaunchScheduler } from './runner/MassLaunchRunner';
import { runAutoMigration } from './db/migrate';
import { sessions } from './browserManager';
import {
  wsLifecycle,
  browserLifecycle,
  timerManager,
  memoryMonitor
} from './services';

const logger = new Logger('Server');

// Глобальні обробники помилок процесу
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise rejection', reason instanceof Error ? reason : new Error(String(reason)), {
    promise: String(promise)
  });
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception', err);
  setTimeout(() => process.exit(1), 500);
});

// Ініціалізація додатку Express
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

function createSmartImMiddleware(dir: string) {
  const fileCache = new Map<string, string>();

  const refreshCache = () => {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        fileCache.clear();
        for (const file of files) {
          const lowerFile = file.toLowerCase();
          const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
          const lowerNameNoExt = nameWithoutExt.toLowerCase();
          const norm = lowerNameNoExt.replace(/['"_\s-]/g, '');

          if (!fileCache.has(lowerFile)) fileCache.set(lowerFile, file);
          if (!fileCache.has(lowerNameNoExt)) fileCache.set(lowerNameNoExt, file);
          if (!fileCache.has(norm)) fileCache.set(norm, file);
        }
      }
    } catch (e) {
      logger.warn('Failed to index im directory', { error: String(e) });
    }
  };

  refreshCache();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const rawName = decodeURIComponent(req.path.replace(/^\//, '')).trim();
    if (!rawName) return next();

    const exactPath = path.join(dir, rawName);
    if (fs.existsSync(exactPath)) {
      return res.sendFile(exactPath);
    }

    const lowerRaw = rawName.toLowerCase();
    const nameWithoutExt = rawName.replace(/\.[^/.]+$/, '');
    const lowerNameNoExt = nameWithoutExt.toLowerCase();
    const norm = lowerNameNoExt.replace(/['"_\s-]/g, '');

    const matched = fileCache.get(lowerRaw) || 
                    fileCache.get(lowerNameNoExt) || 
                    fileCache.get(norm);

    if (matched) {
      const matchPath = path.join(dir, matched);
      if (fs.existsSync(matchPath)) {
        return res.sendFile(matchPath);
      }
    }

    next();
  };
}

const smartImMiddleware = createSmartImMiddleware(path.resolve(__dirname, '../../im'));

// Статичні маршрути для медіа та зображень гри
app.use('/api/images', express.static(path.join(__dirname, '../images')));
app.use('/api/extensions', express.static(path.join(__dirname, '../data')));
app.use('/api/extensions', express.static(path.join(__dirname, '../extensions')));
app.use('/api/im', smartImMiddleware, express.static(path.resolve(__dirname, '../../im')));
app.use('/im', smartImMiddleware, express.static(path.resolve(__dirname, '../../im')));
app.use('/api/screenshots', express.static(PROJECTS_DIR));

// Застосовуємо rate limiting для всіх /api/* ендпоінтів
app.use('/api', apiRateLimiter);

// Підключаємо всі модульні маршрути додатку
app.use(routes);

// Створюємо HTTP сервер
const server = http.createServer(app);

// Налаштовуємо WebSocket сервер та перехоплювач upgrade
setupWebSocketServer(server);

const HTTP_PORT = parseInt(process.env.HTTP_PORT || String(DEFAULT_HTTP_PORT), 10);

// Перевіряємо та створюємо директорію проектів
try {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    logger.info('Created projects directory', { path: PROJECTS_DIR });
  }
} catch (err) {
  logger.error('Failed to create projects directory', err instanceof Error ? err : new Error(String(err)), { path: PROJECTS_DIR });
  throw new Error(`Cannot create projects directory: ${err instanceof Error ? err.message : String(err)}`);
}

// Запускаємо автоматичну міграцію та синхронізацію даних у SQLite у фоновому режимі
setImmediate(() => {
  try {
    runAutoMigration(PROJECTS_DIR);
  } catch (migErr) {
    logger.warn('Failed to run SQLite auto migration on startup', { error: String(migErr) });
  }
});

// Запускаємо планувальник масових запусків
startMassLaunchScheduler(10000);

// Запускаємо HTTP сервер
server.listen(HTTP_PORT, '0.0.0.0', () => {
  logger.info(`🚀 Сервер на порту ${HTTP_PORT}`);
});

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    stopMassLaunchScheduler();

    server.close(() => {
      logger.info('HTTP server closed');
    });
    
    await wsLifecycle.closeAllConnections();
    wsLifecycle.stopCleanupTimer();
    
    await browserLifecycle.cleanupZombieBrowsers(sessions);
    
    timerManager.clearAllTimers();
    timerManager.stopCleanupTimer();
    
    memoryMonitor.stopReportingTimer();
    
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown', err instanceof Error ? err : new Error(String(err)));
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, server };
