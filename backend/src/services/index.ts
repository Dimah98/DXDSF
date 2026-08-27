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
export const notificationService = new NotificationService(PROJECTS_DIR);
export const wsLifecycle = new WebSocketLifecycle((projectName: string) => sessions.get(projectName));
export const browserLifecycle = new BrowserLifecycle();
export const timerManager = new TimerManager((projectName: string) => sessions.get(projectName));
export const memoryMonitor = new MemoryMonitor();
export { browserSemaphore };
