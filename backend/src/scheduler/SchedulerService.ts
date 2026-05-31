import fs from 'fs';
import path from 'path';

export interface ScheduledRun {
  projectName: string;
  runAt: number;
  createdAt: number;
  source: string;
  randomOffset?: number; // Збережений випадковий зсув для interval
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

  private save(): void {
    try {
      this.cleanupExpired();
      fs.writeFileSync(this.schedulePath, JSON.stringify({ scheduledRuns: this.scheduledRuns }, null, 2), 'utf-8');
    } catch (err) {
      console.error('Помилка збереження schedule.json:', err);
    }
  }

  public addScheduledRun(projectName: string, runAt: number, source: string, randomOffset?: number): void {
    // Видаляємо попередні програмні запуски для цього проекту з цього ж джерела
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
    const initialLength = this.scheduledRuns.length;
    // Видаляємо старі запуски, які прострочені більше ніж на 2 години
    this.scheduledRuns = this.scheduledRuns.filter(r => r.runAt >= now - 7200000);
    // Не зберігаємо тут, бо викликається зсередини save()
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
      if (!file.endsWith('.json') || file.endsWith('_stats.json') || file === 'schedule.json' || file === 'notifications.json') continue;
      
      const projectName = file.replace('.json', '');
      const projectPath = path.join(projectsDir, file);
      
      let projectData: any;
      try {
        projectData = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
      } catch (err) {
        continue;
      }
      
      const launchSettings = projectData.launchSettings;
      if (!launchSettings) continue;

      let shouldRun = false;

      // 1. Інтервальний запуск
      if (launchSettings.mode === 'interval' && launchSettings.intervalValue > 0) {
        const lastRun = this.getLastRunTime(projectName, projectsDir, projectData);
        const requiredDiffMs = launchSettings.intervalUnit === 'hours' 
          ? launchSettings.intervalValue * 3600000 
          : launchSettings.intervalValue * 60000;
        
        let targetRunAt = lastRun + requiredDiffMs;

        // Рандомізація
        if (launchSettings.randomOffsetMinutes > 0) {
          // Шукаємо чи є збережений зсув для поточного інтервалу
          let savedRun = this.scheduledRuns.find(r => r.projectName === projectName && r.source === 'interval_random');
          
          if (!savedRun || savedRun.runAt < now - 3600000) { // Якщо немає або старий
            const offsetMs = (Math.random() * 2 - 1) * (launchSettings.randomOffsetMinutes * 60000);
            const newRunAt = targetRunAt + offsetMs;
            this.addScheduledRun(projectName, newRunAt, 'interval_random', offsetMs);
            targetRunAt = newRunAt;
          } else {
            targetRunAt = savedRun.runAt;
          }
        }

        if (now >= targetRunAt) {
          shouldRun = true;
          // Видаляємо збережений зсув
          this.removeScheduledRun(projectName, 'interval_random');
        }
      }

      // 2. Програмний запуск (від ноди setNextRunNode)
      const nodeRun = this.scheduledRuns.find(r => r.projectName === projectName && r.source === 'node');
      if (nodeRun && now >= nodeRun.runAt) {
        shouldRun = true;
        this.removeScheduledRun(projectName, 'node');
      }

      if (shouldRun) {
        toRun.push(projectName);
      }
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
      if (!file.endsWith('.json') || file.endsWith('_stats.json') || file === 'schedule.json' || file === 'notifications.json') continue;
      
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
      }

      // Додаємо програмні запуски
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
