import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const RUNS_DIR = path.join(__dirname, '../../data/runs');
const LOGS_DIR = path.join(__dirname, '../../data/logs/runs');

// Ensure directories exist
if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

export interface RunRecord {
  runId: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'success' | 'error';
}

export class RunLogger {
  static getHistoryFile(projectName: string) {
    return path.join(RUNS_DIR, `${projectName}.json`);
  }

  static getLogFile(projectName: string, runId: string) {
    return path.join(LOGS_DIR, `${projectName}_${runId}.log`);
  }

  static getRuns(projectName: string): RunRecord[] {
    const file = this.getHistoryFile(projectName);
    if (!fs.existsSync(file)) return [];
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      return [];
    }
  }

  static createRun(projectName: string): string {
    const runId = crypto.randomUUID();
    const runs = this.getRuns(projectName);
    const newRun: RunRecord = {
      runId,
      startTime: Date.now(),
      status: 'running'
    };
    runs.push(newRun);
    fs.writeFileSync(this.getHistoryFile(projectName), JSON.stringify(runs, null, 2), 'utf-8');
    
    // Create initial log file
    const logHeader = `[${new Date().toISOString()}] [INFO] Run started for project: ${projectName}\n`;
    fs.writeFileSync(this.getLogFile(projectName, runId), logHeader, 'utf-8');

    return runId;
  }

  static finishRun(projectName: string, runId: string, status: 'success' | 'error') {
    const runs = this.getRuns(projectName);
    const runIndex = runs.findIndex(r => r.runId === runId);
    if (runIndex !== -1) {
      runs[runIndex].endTime = Date.now();
      runs[runIndex].status = status;
      fs.writeFileSync(this.getHistoryFile(projectName), JSON.stringify(runs, null, 2), 'utf-8');
    }

    const logFooter = `[${new Date().toISOString()}] [INFO] Run finished with status: ${status}\n`;
    fs.appendFileSync(this.getLogFile(projectName, runId), logFooter, 'utf-8');
  }

  static logToRun(projectName: string, runId: string, message: string, type: string) {
    const logFile = this.getLogFile(projectName, runId);
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
    try {
      fs.appendFileSync(logFile, logEntry, 'utf-8');
    } catch (err) {
      console.error(`Failed to write to run log ${logFile}`, err);
    }
  }

  static getRunLogs(projectName: string, runId: string): string {
    const logFile = this.getLogFile(projectName, runId);
    if (!fs.existsSync(logFile)) return 'Logs not found.';
    try {
      return fs.readFileSync(logFile, 'utf-8');
    } catch (e: any) {
      return `Error reading logs: ${e.message}`;
    }
  }
}
