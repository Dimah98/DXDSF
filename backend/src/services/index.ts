import { PROJECTS_DIR } from '../constants';
import { sessions } from '../browserManager';
import { SchedulerService } from '../scheduler/SchedulerService';
import { NotificationService } from '../notifications/NotificationService';
import { WebSocketLifecycle } from '../lifecycle/WebSocketLifecycle';
import { BrowserLifecycle } from '../lifecycle/BrowserLifecycle';
import { TimerManager } from '../lifecycle/TimerManager';
import { MemoryMonitor } from '../lifecycle/MemoryMonitor';
import { browserSemaphore } from '../concurrency/Semaphore';

/**
 * Singleton instances of core backend services
 */
export const schedulerService = new SchedulerService(PROJECTS_DIR);
export const wsLifecycle = new WebSocketLifecycle((projectName: string) => sessions.get(projectName));
export const notificationService = new NotificationService(PROJECTS_DIR, (projectName, message, notification) => {
  try {
    const payload = {
      type: 'NOTIFICATION',
      projectName,
      message,
      notification
    };
    // Надсилаємо лише через activeSockets проекту (без wsLifecycle.broadcast,
    // який відправляє ВСІМ клієнтам включно з іншими проектами — це був подвійний broadcast)
    const session = sessions.get(projectName);
    if (session && session.activeSockets) {
      const json = JSON.stringify(payload);
      for (const socket of session.activeSockets) {
        if (socket && socket.readyState === 1) {
          try { socket.send(json); } catch (_) {}
        }
      }
    }
  } catch (err) {
    console.error('Failed to broadcast notification:', err);
  }
});
export const browserLifecycle = new BrowserLifecycle();
export const timerManager = new TimerManager((projectName: string) => sessions.get(projectName));
export const memoryMonitor = new MemoryMonitor();
export { browserSemaphore };
