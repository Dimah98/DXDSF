import { Request, Response } from 'express';
import { Logger } from '../logger';
import { sessions } from '../browserManager';
import { browserSemaphore } from '../services';

const logger = new Logger('SystemController');

export function getHealth(_req: Request, res: Response): void {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    let activeSessionCount = 0;
    let activeBrowserCount = 0;
    
    sessions.forEach((session) => {
      activeSessionCount++;
      if (session.page && session.isBotRunning) {
        activeBrowserCount++;
      }
    });
    
    const healthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      memory: {
        heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.floor(memoryUsage.rss / 1024 / 1024),
        external: Math.floor(memoryUsage.external / 1024 / 1024)
      },
      activeSessionCount,
      activeBrowserCount
    };
    
    res.status(200).json(healthResponse);
  } catch (err) {
    logger.error('Health check error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
}

export function getSystemStatus(_req: Request, res: Response): void {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    const cpuUsage = process.cpuUsage();
    
    let activeSessionCount = 0;
    let activeBrowserCount = 0;
    
    sessions.forEach((session) => {
      activeSessionCount++;
      if (session.page && session.isBotRunning) {
        activeBrowserCount++;
      }
    });
    
    const semaphoreStats = browserSemaphore.getStatistics();
    
    const statusResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      system: {
        memory: {
          heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024),
          rss: Math.floor(memoryUsage.rss / 1024 / 1024),
          external: Math.floor(memoryUsage.external / 1024 / 1024)
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
}
