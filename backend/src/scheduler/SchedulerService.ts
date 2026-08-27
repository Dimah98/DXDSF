import fs from 'fs';
import path from 'path';
import { sessions } from '../browserManager';

export interface ScheduledRun {
  projectName: string;
  runAt: number;
  createdAt: number;
  source: string;
  randomOffset?: number;
}

export interface ScheduleInfo {
  projectName: string;
  mode: string;
  nextRun: number | null;
  lastRun: number;
  settings: any;
  plannedRuns: ScheduledRun[];
}

export class SchedulerService {
  private scheduledRuns: ScheduledRun[] = [];
  private schedulePath: string;
  private lastAttemptTime: Map<string, number> = new Map();
  private readonly maxConcurrentLaunches = 3;

  constructor(projectsDir: string) {
    this.schedulePath = path.join(projectsDir, 'schedule.json');
    this.load();
  }

  private load(): void {
    if (fs.existsSync(this.schedulePath)) {
      try {
        const data = fs.readFileSync(this.schedulePath, 'utf-8');
        const parsed = JSON.parse(data);
        if (parsed.scheduledRuns && Array.isArray(parsed.scheduledRuns)) {
          this.scheduledRuns = parsed.scheduledRuns;
        }
      } catch (err) {
        console.error('Помилка читання schedule.json:', err);
      }
    }
  }

  public getNextScheduleTime(scheduleTime: string, scheduleDays: number[]): number | null {
    if (!scheduleDays || scheduleDays.length === 0) return null;
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setHours(hours, minutes, 0, 0);
    for (let i = 0; i < 8; i++) {
      if (targetDate.getTime() > now.getTime() && scheduleDays.includes(targetDate.getDay())) {
        return targetDate.getTime();
      }
      targetDate.setDate(targetDate.getDate() + 1);
    }
    return null;
  }

  public getLatestScheduleTime(scheduleTime: string, scheduleDays: number[]): number | null {
    if (!scheduleDays || scheduleDays.length === 0) return null;
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setHours(hours, minutes, 0, 0);
    for (let i = 0; i < 8; i++) {
      if (targetDate.getTime() <= now.getTime() && scheduleDays.includes(targetDate.getDay())) {
        return targetDate.getTime();
      }
      targetDate.setDate(targetDate.getDate() - 1);
    }
    return null;
  }

  public checkAndRescheduleIfNeeded(projectName: string, projectsDir: string): void {
    const futureNodeRun = this.scheduledRuns.find(r => r.projectName === projectName && r.source === 'node' && r.runAt > Date.now());
    if (futureNodeRun) {
      return;
    }
    const projectPath = path.join(projectsDir, `${projectName}.json`);
    if (!fs.existsSync(projectPath)) {
      return;
    }
    try {
      const projectData = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
      if (!projectData.nodes || !Array.isArray(projectData.nodes)) {
        return;
      }
      const nextRunNode = projectData.nodes.find((n: any) => n.type === 'setNextRunNode');
      if (!nextRunNode || !nextRunNode.data) {
        return;
      }
      const mode = nextRunNode.data.scheduleMode || 'delay';
      let runAt: number;
      if (mode === 'delay') {
        const value = Number(nextRunNode.data.delayValue) || 1;
        const unit = nextRunNode.data.delayUnit || 'hours';
        const delayMs = unit === 'hours' ? value * 3600000 : value * 60000;
        runAt = Date.now() + delayMs;
      } else {
        const targetTime = nextRunNode.data.targetTime || '08:00';
        const [hours, minutes] = targetTime.split(':').map(Number);
        const now = new Date();
        const target = new Date(now);
        target.setHours(hours, minutes, 0, 0);
        if (target.getTime() <= now.getTime()) {
          target.setDate(target.getDate() + 1);
        }
        runAt = target.getTime();
      }
      this.addScheduledRun(projectName, runAt, 'node');
    } catch (err) {
      console.error(`Scheduler error in checkAndRescheduleIfNeeded for ${projectName}:`, err);
    }
  }

  private save(): void {
    this.cleanupExpired();
    fs.promises.writeFile(this.schedulePath, JSON.stringify({ scheduledRuns: this.scheduledRuns }, null, 2), 'utf-8')
      .catch(err => {
        console.error('Помилка збереження schedule.json:', err);
      });
  }

  public addScheduledRun(projectName: string, runAt: number, source: string, randomOffset?: number): void {
    this.scheduledRuns = this.scheduledRuns.filter(r => !(r.projectName === projectName && r.source === source));
    
    this.scheduledRuns.push({
      projectName,
      runAt,
      createdAt: Date.now(),
      source,
      randomOffset
    });
    this.save();
  }

  private cleanupExpired(): void {
    const now = Date.now();
    this.scheduledRuns = this.scheduledRuns.filter(r => r.runAt >= now - 7200000);
  }

  public removeScheduledRun(projectName: string, source: string = 'node'): void {
    const initialLength = this.scheduledRuns.length;
    this.scheduledRuns = this.scheduledRuns.filter(r => !(r.projectName === projectName && r.source === source));
    if (this.scheduledRuns.length !== initialLength) {
      this.save();
    }
  }

  public checkAndGetProjectsToRun(projectsDir: string): string[] {
    const toRun: string[] = [];
    const now = Date.now();
    let files: string[] = [];
    
    try {
      files = fs.readdirSync(projectsDir);
    } catch (err) {
      console.error('Scheduler: failed to read projects dir', err);
      return [];
    }

    for (const file of files) {
      if (
        !file.endsWith('.json') ||
        file.endsWith('_stats.json') ||
        file.endsWith('_logs.json') ||
        file.endsWith('_inventory.json') ||
        file.endsWith('_layout.json') ||
        file.endsWith('_save.json') ||
        file === 'categories.json' ||
        file === 'global_building_types.json' ||
        file === 'schedule.json' ||
        file === 'notifications.json'
      ) {
        continue;
      }
      
      const projectName = file.replace('.json', '');
      const projectPath = path.join(projectsDir, file);
      
      let projectData: any;
      try {
        projectData = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
      } catch (err) {
        continue;
      }
      
      let shouldRun = false;
      const launchSettings = projectData.launchSettings;

      if (launchSettings && launchSettings.mode === 'interval' && launchSettings.intervalValue > 0) {
        const lastRun = this.getLastRunTime(projectName, projectsDir, projectData);
        const requiredDiffMs = launchSettings.intervalUnit === 'hours'
          ? launchSettings.intervalValue * 3600000
          : launchSettings.intervalValue * 60000;
        
        let targetRunAt = lastRun + requiredDiffMs;

        if (launchSettings.randomOffsetMinutes > 0) {
          let savedRun = this.scheduledRuns.find(r => r.projectName === projectName && r.source === 'interval_random');
          
          if (!savedRun || savedRun.runAt < now - 3600000) {
            const offsetMs = (Math.random() * 2 - 1) * (launchSettings.randomOffsetMinutes * 60000);
            const newRunAt = targetRunAt + offsetMs;
            this.addScheduledRun(projectName, newRunAt, 'interval_random', offsetMs);
            targetRunAt = newRunAt;
          } else {
            targetRunAt = savedRun.runAt;
          }
        }

        if (now >= targetRunAt) {
          const session = sessions.get(projectName);
          if (!session || !session.isBotRunning) {
            const lastAttempt = this.lastAttemptTime.get(projectName) || 0;
            if (now - lastAttempt >= 5 * 60 * 1000) {
              shouldRun = true;
              this.removeScheduledRun(projectName, 'interval_random');
            }
          }
        }
      }

      if (launchSettings && launchSettings.mode === 'schedule') {
        const lastRun = this.getLastRunTime(projectName, projectsDir, projectData);
        const latestTime = this.getLatestScheduleTime(launchSettings.scheduleTime, launchSettings.scheduleDays);
        if (latestTime !== null && lastRun < latestTime) {
          const session = sessions.get(projectName);
          if (!session || !session.isBotRunning) {
            const lastAttempt = this.lastAttemptTime.get(projectName) || 0;
            if (now - lastAttempt >= 5 * 60 * 1000) {
              shouldRun = true;
            }
          }
        }
      }

      const nodeRun = this.scheduledRuns.find(r => r.projectName === projectName && r.source === 'node');
      if (nodeRun && now >= nodeRun.runAt) {
        const session = sessions.get(projectName);
        if (!session || !session.isBotRunning) {
          const lastAttempt = this.lastAttemptTime.get(projectName) || 0;
          if (now - lastAttempt >= 5 * 60 * 1000) {
            shouldRun = true;
            this.removeScheduledRun(projectName, 'node');
          }
        }
      }

      if (shouldRun) {
        this.lastAttemptTime.set(projectName, now);
        toRun.push(projectName);
      }
    }

    if (toRun.length > this.maxConcurrentLaunches) {
      console.warn(`Scheduler: limiting concurrent launches from ${toRun.length} to ${this.maxConcurrentLaunches}`);
      toRun.length = this.maxConcurrentLaunches;
    }

    return toRun;
  }

  private getLastRunTime(projectName: string, projectsDir: string, projectData: any): number {
    const statPath = path.join(projectsDir, `${projectName}_stats.json`);
    let lastRun = projectData.updatedAt || 0;
    
    try {
      if (fs.existsSync(statPath)) {
        const statsContent = fs.readFileSync(statPath, 'utf-8');
        const stats = JSON.parse(statsContent);
        if (stats && stats.length > 0) {
          lastRun = stats[stats.length - 1].timestamp;
        }
      }
    } catch (err) {
      console.warn(`Scheduler: failed to read stats file for ${projectName}`);
    }
    return lastRun;
  }

  public getFullSchedule(projectsDir: string): ScheduleInfo[] {
    const schedule: ScheduleInfo[] = [];
    let files: string[] = [];
    
    try {
      files = fs.readdirSync(projectsDir);
    } catch (err) {
      return schedule;
    }

    for (const file of files) {
      if (
        !file.endsWith('.json') || 
        file.endsWith('_stats.json') || 
        file.endsWith('_logs.json') || 
        file.endsWith('_inventory.json') ||
        file.endsWith('_layout.json') ||
        file.endsWith('_save.json') ||
        file === 'categories.json' ||
        file === 'global_building_types.json' ||
        file === 'schedule.json' || 
        file === 'notifications.json'
      ) {
        continue;
      }
      
      const projectName = file.replace('.json', '');
      const projectPath = path.join(projectsDir, file);
      
      let projectData: any;
      try {
        projectData = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
      } catch (err) {
        continue;
      }
      
      const launchSettings = projectData.launchSettings || { mode: 'none' };
      const lastRun = this.getLastRunTime(projectName, projectsDir, projectData);
      
      let nextRun: number | null = null;
      
      if (launchSettings.mode === 'interval' && launchSettings.intervalValue > 0) {
        const requiredDiffMs = launchSettings.intervalUnit === 'hours' 
          ? launchSettings.intervalValue * 3600000 
          : launchSettings.intervalValue * 60000;
        
        nextRun = lastRun + requiredDiffMs;
        
        if (launchSettings.randomOffsetMinutes > 0) {
          const savedRun = this.scheduledRuns.find(r => r.projectName === projectName && r.source === 'interval_random');
          if (savedRun) {
            nextRun = savedRun.runAt;
          }
        }
      } else if (launchSettings.mode === 'schedule' && launchSettings.scheduleTime && launchSettings.scheduleDays) {
        nextRun = this.getNextScheduleTime(launchSettings.scheduleTime, launchSettings.scheduleDays);
      }

      const plannedRuns = this.scheduledRuns.filter(r => r.projectName === projectName && r.source === 'node');

      schedule.push({
        projectName,
        mode: launchSettings.mode,
        nextRun,
        lastRun,
        settings: launchSettings,
        plannedRuns
      });
    }

    return schedule;
  }
}
