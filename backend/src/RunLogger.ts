import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  recordRunStart,
  recordRunFinish,
  getRunsForProject,
  insertLog,
  getRunLogs as getDbRunLogs,
  db
} from './db/schema';

const RUNS_DIR = path.join(__dirname, '../../data/runs');
const LOGS_DIR = path.join(__dirname, '../../data/logs/runs');

// Ensure directories exist asynchronously
fs.promises.mkdir(RUNS_DIR, { recursive: true }).catch(() => {});
fs.promises.mkdir(LOGS_DIR, { recursive: true }).catch(() => {});

interface PendingLog {
  projectName: string;
  runId: string;
  level: string;
  message: string;
  loggedAt: number;
}

let pendingLogBuffer: PendingLog[] = [];
let logFlushTimer: NodeJS.Timeout | null = null;

export function flushPendingLogs() {
  if (pendingLogBuffer.length === 0) return;
  const toFlush = pendingLogBuffer;
  pendingLogBuffer = [];
  
  try {
    db.exec('BEGIN TRANSACTION');
    const stmt = db.prepare(`
      INSERT INTO execution_logs (project_name, run_id, level, message, logged_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const log of toFlush) {
      stmt.run(log.projectName, log.runId, log.level, log.message, log.loggedAt);
    }
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    console.warn(`[RunLogger] Failed to batch insert logs into SQLite`, err);
  }
}

export interface RunRecord {
  runId: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'success' | 'error' | 'stopped';
  error?: string;
}

export class RunLogger {
  static getHistoryFile(projectName: string) {
    return path.join(RUNS_DIR, `${projectName}.json`);
  }

  static getLogFile(projectName: string, runId: string) {
    return path.join(LOGS_DIR, `${projectName}_${runId}.log`);
  }

  static getRuns(projectName: string): RunRecord[] {
    try {
      const dbRuns = getRunsForProject(projectName);
      if (dbRuns && dbRuns.length > 0) {
        return dbRuns;
      }
    } catch (dbErr) {
      console.warn(`[RunLogger] Failed to read runs from SQLite for ${projectName}, falling back to file`, dbErr);
    }

    const file = this.getHistoryFile(projectName);
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
      }
    } catch {
      return [];
    }
    return [];
  }

  static async getRunsAsync(projectName: string): Promise<RunRecord[]> {
    try {
      const dbRuns = getRunsForProject(projectName);
      if (dbRuns && dbRuns.length > 0) {
        return dbRuns;
      }
    } catch (dbErr) {
      console.warn(`[RunLogger] Failed to read runs from SQLite for ${projectName}, falling back to file`, dbErr);
    }

    const file = this.getHistoryFile(projectName);
    try {
      const content = await fs.promises.readFile(file, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  static createRun(projectName: string): string {
    const runId = crypto.randomUUID();
    const startTime = Date.now();

    // 1. Save in SQLite
    try {
      recordRunStart(projectName, runId, startTime);
    } catch (dbErr) {
      console.warn(`[RunLogger] Failed to record run start in SQLite`, dbErr);
    }

    // 2. Save in fallback JSON history file asynchronously
    const file = this.getHistoryFile(projectName);
    fs.promises.readFile(file, 'utf-8')
      .then(content => {
        try {
          return JSON.parse(content) as RunRecord[];
        } catch {
          return [] as RunRecord[];
        }
      })
      .catch(() => [] as RunRecord[])
      .then(runs => {
        runs.push({ runId, startTime, status: 'running' });
        return fs.promises.writeFile(file, JSON.stringify(runs, null, 2), 'utf-8');
      })
      .catch(fileErr => {
        console.warn(`[RunLogger] Failed to write run to file`, fileErr);
      });
    
    // 3. Create initial log file asynchronously
    const logHeader = `[${new Date().toISOString()}] [INFO] Run started for project: ${projectName}\n`;
    fs.promises.writeFile(this.getLogFile(projectName, runId), logHeader, 'utf-8').catch(() => {});

    return runId;
  }

  static finishRun(
    projectName: string,
    runId: string,
    status: 'success' | 'error' | 'stopped',
    error?: string,
    snapshot?: any
  ) {
    const endTime = Date.now();

    // Flush any pending logs immediately
    flushPendingLogs();

    // 1. Update in SQLite
    try {
      recordRunFinish(projectName, runId, status, error, endTime, snapshot);
    } catch (dbErr) {
      console.warn(`[RunLogger] Failed to update run in SQLite`, dbErr);
    }

    // 2. Update fallback JSON file asynchronously
    const file = this.getHistoryFile(projectName);
    fs.promises.readFile(file, 'utf-8')
      .then(content => {
        const runs = JSON.parse(content);
        const runIndex = runs.findIndex((r: RunRecord) => r.runId === runId);
        if (runIndex !== -1) {
          runs[runIndex].endTime = endTime;
          runs[runIndex].status = status;
          if (error) runs[runIndex].error = error;
          return fs.promises.writeFile(file, JSON.stringify(runs, null, 2), 'utf-8');
        }
        return null;
      })
      .catch(fileErr => {
        console.warn(`[RunLogger] Failed to update run history file`, fileErr);
      });

    // 3. Write footer to log file asynchronously
    const logFooter = `[${new Date().toISOString()}] [INFO] Run finished with status: ${status}${error ? ` (${error})` : ''}\n`;
    fs.promises.appendFile(this.getLogFile(projectName, runId), logFooter, 'utf-8').catch(() => {});
  }

  static logToRun(projectName: string, runId: string, message: string, type: string) {
    // 1. Buffer for SQLite batch transaction
    pendingLogBuffer.push({
      projectName,
      runId,
      level: type,
      message,
      loggedAt: Date.now()
    });

    if (pendingLogBuffer.length >= 50) {
      flushPendingLogs();
    } else if (!logFlushTimer) {
      logFlushTimer = setTimeout(() => {
        logFlushTimer = null;
        flushPendingLogs();
      }, 250);
    }

    // 2. Save in log file asynchronously
    const logFile = this.getLogFile(projectName, runId);
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
    fs.promises.appendFile(logFile, logEntry, 'utf-8').catch(err => {
      console.error(`Failed to write to run log ${logFile}`, err);
    });
  }

  static getRunLogs(projectName: string, runId: string): string {
    const logFile = this.getLogFile(projectName, runId);
    try {
      if (fs.existsSync(logFile)) {
        return fs.readFileSync(logFile, 'utf-8');
      }
    } catch (e: any) {
      console.warn(`Failed reading log file ${logFile}`, e);
    }

    // Fallback to SQLite execution_logs
    try {
      const dbLogs = getDbRunLogs(projectName, runId);
      if (dbLogs) return dbLogs;
    } catch (dbErr) {
      console.warn(`Failed reading logs from SQLite`, dbErr);
    }

    return 'Logs not found.';
  }

  static async getRunLogsAsync(projectName: string, runId: string): Promise<string> {
    const logFile = this.getLogFile(projectName, runId);
    try {
      return await fs.promises.readFile(logFile, 'utf-8');
    } catch (e: any) {
      // Fallback to SQLite execution_logs
      try {
        const dbLogs = getDbRunLogs(projectName, runId);
        if (dbLogs) return dbLogs;
      } catch (dbErr) {
        console.warn(`Failed reading logs from SQLite`, dbErr);
      }
    }
    return 'Logs not found.';
  }
}
