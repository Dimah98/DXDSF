import { describe, it, expect, beforeEach } from 'vitest';
import { RunLogger } from './RunLogger';
import fs from 'fs';
import { db } from './db/schema';

describe('RunLogger', () => {
  const testProject = 'test_project_logger_runs';
  const historyFile = RunLogger.getHistoryFile(testProject);

  beforeEach(() => {
    try {
      db.prepare('DELETE FROM executions WHERE project_name = ?').run(testProject);
    } catch {}
    if (fs.existsSync(historyFile)) {
      fs.unlinkSync(historyFile);
    }
  });

  it('should create run and finish with success status', () => {
    const runId = RunLogger.createRun(testProject);
    expect(runId).toBeDefined();

    let runs = RunLogger.getRuns(testProject);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe('running');

    RunLogger.finishRun(testProject, runId, 'success');

    runs = RunLogger.getRuns(testProject);
    expect(runs[0].status).toBe('success');
    expect(runs[0].endTime).toBeDefined();
    expect(runs[0].error).toBeUndefined();
  });

  it('should record error status and error message upon failure', () => {
    const runId = RunLogger.createRun(testProject);
    const errorMsg = 'Failed to find crop element';

    RunLogger.finishRun(testProject, runId, 'error', errorMsg);

    const runs = RunLogger.getRuns(testProject);
    expect(runs[0].status).toBe('error');
    expect(runs[0].error).toBe(errorMsg);
  });

  it('should record stopped status when cancelled by user', () => {
    const runId = RunLogger.createRun(testProject);
    RunLogger.finishRun(testProject, runId, 'stopped', 'Зупинено вручну');

    const runs = RunLogger.getRuns(testProject);
    expect(runs[0].status).toBe('stopped');
    expect(runs[0].error).toBe('Зупинено вручну');
  });
});
