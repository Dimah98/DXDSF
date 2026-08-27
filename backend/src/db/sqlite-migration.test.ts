import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import {
  upsertProject,
  getProjects,
  deleteProject,
  recordRunStart,
  recordRunFinish,
  recordExecution,
  getRunsForProject,
  getProjectStats,
  getExecutionStats,
  insertLog,
  getLogs,
  saveLogs,
  deleteLogs,
  upsertInventoryItem,
  getInventory,
  getAllInventories,
  deleteInventory
} from './schema';
import {
  runAutoMigration
} from './migrate';

describe('SQLite Database Layer & Helpers', () => {
  const testProject = 'test_sqlite_project';

  beforeEach(() => {
    deleteProject(testProject);
    upsertProject(testProject, `/fake/path/${testProject}.json`, 1000, 2000);
  });

  it('should upsert, get and delete projects', () => {
    upsertProject(testProject, `/fake/path/${testProject}.json`, 1000, 2000);
    const projects = getProjects();
    const found = projects.find(p => p.name === testProject);
    expect(found).toBeDefined();
    expect(found?.json_path).toBe(`/fake/path/${testProject}.json`);

    deleteProject(testProject);
    const after = getProjects().find(p => p.name === testProject);
    expect(after).toBeUndefined();
  });

  it('should record run start, finish and query runs for project', () => {
    const runId = 'test-run-12345';
    recordRunStart(testProject, runId, 10000);

    let runs = getRunsForProject(testProject);
    expect(runs).toHaveLength(1);
    expect(runs[0].runId).toBe(runId);
    expect(runs[0].status).toBe('running');

    recordRunFinish(testProject, runId, 'success', undefined, 15000, { sunflower: 10 });
    runs = getRunsForProject(testProject);
    expect(runs[0].status).toBe('success');
    expect(runs[0].endTime).toBe(15000);

    const stats = getProjectStats(testProject);
    expect(stats).toHaveLength(1);
    expect(stats[0].snapshot).toEqual({ sunflower: 10 });
  });

  it('should calculate aggregated execution stats', () => {
    recordExecution(testProject, 1000, 200, 'success', 5);
    recordExecution(testProject, 2000, 300, 'error', 2, 'Failed to click element');
    recordExecution(testProject, 3000, 100, 'stopped', 1);

    const execStats = getExecutionStats(testProject);
    expect(execStats.total_runs).toBe(3);
    expect(execStats.success_count).toBe(1);
    expect(execStats.error_count).toBe(1);
    expect(execStats.stopped_count).toBe(1);
  });

  it('should handle logs insertion, retrieval, batch saving and deletion', () => {
    insertLog(testProject, 'info', 'Step 1 completed', 'node-1', 'clickNode');
    insertLog(testProject, 'error', 'Step 2 failed', 'node-2', 'apiNode');

    let logs = getLogs(testProject);
    expect(logs).toHaveLength(2);
    expect(logs[0].message).toBe('Step 1 completed');
    expect(logs[1].level).toBe('error');

    deleteLogs(testProject);
    expect(getLogs(testProject)).toHaveLength(0);

    saveLogs(testProject, [
      { level: 'info', message: 'Batch log 1' },
      { level: 'debug', message: 'Batch log 2' }
    ]);
    logs = getLogs(testProject);
    expect(logs).toHaveLength(2);
  });

  it('should upsert, get and delete inventory items', () => {
    upsertInventoryItem(testProject, 'Sunflower', 42, '/im/sunflower.png');
    upsertInventoryItem(testProject, 'Potato', 10, '/im/potato.png');

    let items = getInventory(testProject);
    expect(items).toHaveLength(2);
    const sunflower = items.find(i => i.item_name === 'Sunflower');
    expect(sunflower?.quantity).toBe(42);

    // Update quantity
    upsertInventoryItem(testProject, 'Sunflower', 50, '/im/sunflower.png');
    items = getInventory(testProject);
    expect(items.find(i => i.item_name === 'Sunflower')?.quantity).toBe(50);

    const allInv = getAllInventories();
    expect(allInv[testProject]).toBeDefined();

    deleteInventory(testProject);
    expect(getInventory(testProject)).toHaveLength(0);
  });

  it('should migrate legacy json files safely', () => {
    const tempDir = path.join(__dirname, '../../data/test_migration_temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    try {
      // Create fake legacy files
      fs.writeFileSync(path.join(tempDir, `${testProject}.json`), JSON.stringify({ nodes: [] }));
      fs.writeFileSync(path.join(tempDir, `${testProject}_inventory.json`), JSON.stringify({
        data: [{ image: 'wheat.png', number: 15 }]
      }));
      fs.writeFileSync(path.join(tempDir, `${testProject}_stats.json`), JSON.stringify([
        { timestamp: 1234567, snapshot: { coins: 100 }, status: 'success' }
      ]));
      fs.writeFileSync(path.join(tempDir, `${testProject}_logs.json`), JSON.stringify([
        { level: 'info', message: 'Legacy log line', timestamp: 1234567 }
      ]));

      // Run migration
      runAutoMigration(tempDir);

      // Verify migration into SQLite
      const projects = getProjects().find(p => p.name === testProject);
      expect(projects).toBeDefined();

      const inv = getInventory(testProject);
      expect(inv.some(i => i.item_name === 'wheat')).toBe(true);

      const stats = getProjectStats(testProject);
      expect(stats.some(s => s.snapshot?.coins === 100)).toBe(true);

      const logs = getLogs(testProject);
      expect(logs.some(l => l.message === 'Legacy log line')).toBe(true);
    } finally {
      // Cleanup temp dir
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
      deleteProject(testProject);
    }
  });
});
