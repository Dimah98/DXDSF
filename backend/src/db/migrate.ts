import * as fs from 'fs';
import * as path from 'path';
import {
  db,
  upsertProject
} from './schema';
import { PROJECTS_DIR } from '../constants';

const DEFAULT_PROJECTS_DIR = PROJECTS_DIR;
const RUNS_DIR = path.join(__dirname, '../../data/runs');

// Ensure migration metadata table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS _file_migrations (
    file_path TEXT PRIMARY KEY,
    mtime_ms REAL NOT NULL,
    migrated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
`);

const checkFileMigrationStmt = db.prepare('SELECT mtime_ms FROM _file_migrations WHERE file_path = ?');
const recordFileMigrationStmt = db.prepare(`
  INSERT INTO _file_migrations (file_path, mtime_ms, migrated_at)
  VALUES (?, ?, (unixepoch() * 1000))
  ON CONFLICT(file_path) DO UPDATE SET
    mtime_ms = excluded.mtime_ms,
    migrated_at = excluded.migrated_at
`);

function isFileAlreadyMigrated(filePath: string, currentMtime: number): boolean {
  try {
    const row = checkFileMigrationStmt.get(filePath) as { mtime_ms: number } | undefined;
    return row !== undefined && row.mtime_ms === currentMtime;
  } catch {
    return false;
  }
}

function markFileMigrated(filePath: string, currentMtime: number): void {
  try {
    recordFileMigrationStmt.run(filePath, currentMtime);
  } catch {}
}

export function migrateProjects(projectsDir: string = DEFAULT_PROJECTS_DIR) {
  if (!fs.existsSync(projectsDir)) return 0;
  const files = fs.readdirSync(projectsDir)
    .filter(f => f.endsWith('.json') && !f.includes('_') && f !== 'categories.json' && f !== 'schedule.json' && f !== 'notifications.json' && f !== 'configs.json' && f !== 'mass_launches.json');
  
  let count = 0;
  for (const file of files) {
    const projectName = file.replace('.json', '');
    const filePath = path.join(projectsDir, file);
    try {
      const stats = fs.statSync(filePath);
      if (isFileAlreadyMigrated(filePath, stats.mtimeMs)) continue;

      upsertProject(projectName, filePath, stats.birthtimeMs, stats.mtimeMs);
      markFileMigrated(filePath, stats.mtimeMs);
      count++;
    } catch (e) {
      console.error(`[Migrate] ${projectName}: failed to migrate project metadata`, e);
    }
  }
  return count;
}

export function migrateInventories(projectsDir: string = DEFAULT_PROJECTS_DIR) {
  if (!fs.existsSync(projectsDir)) return 0;
  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('_inventory.json'));
  let count = 0;

  const upsertStmt = db.prepare(`
    INSERT INTO inventory_items (project_name, item_name, quantity, image_url, selector, coords_x, coords_y, scanned_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_name, item_name) DO UPDATE SET
      quantity = excluded.quantity,
      image_url = COALESCE(excluded.image_url, image_url),
      selector = COALESCE(excluded.selector, selector),
      coords_x = COALESCE(excluded.coords_x, coords_x),
      coords_y = COALESCE(excluded.coords_y, coords_y),
      scanned_at = (unixepoch() * 1000)
  `);

  for (const file of files) {
    const projectName = file.replace('_inventory.json', '');
    const filePath = path.join(projectsDir, file);
    try {
      const stat = fs.statSync(filePath);
      if (isFileAlreadyMigrated(filePath, stat.mtimeMs)) continue;

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const items = Array.isArray(data.data) ? data.data : [];
      
      db.exec('BEGIN TRANSACTION');
      try {
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const name = item.image ? path.basename(item.image, path.extname(item.image)) : (item.name || 'unknown');
          const qty = typeof item.number === 'number' ? item.number : parseFloat(item.number) || 0;
          upsertStmt.run(
            projectName,
            name,
            qty,
            item.image || null,
            item.selector || null,
            item.coords?.x ?? null,
            item.coords?.y ?? null,
            Date.now()
          );
          count++;
        }
        markFileMigrated(filePath, stat.mtimeMs);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    } catch (e) {
      console.error(`[Migrate] ${projectName}: failed to migrate inventory`, e);
    }
  }
  return count;
}

export function migrateStats(projectsDir: string = DEFAULT_PROJECTS_DIR) {
  if (!fs.existsSync(projectsDir)) return 0;
  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('_stats.json'));
  let count = 0;

  const insertStmt = db.prepare(`
    INSERT INTO executions (project_name, run_id, started_at, end_time, duration_ms, status, nodes_executed, error, snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const checkStmt = db.prepare('SELECT id FROM executions WHERE project_name = ? AND started_at = ? LIMIT 1');

  for (const file of files) {
    const projectName = file.replace('_stats.json', '');
    const filePath = path.join(projectsDir, file);
    try {
      const stat = fs.statSync(filePath);
      if (isFileAlreadyMigrated(filePath, stat.mtimeMs)) continue;

      const raw = fs.readFileSync(filePath, 'utf-8');
      const stats = JSON.parse(raw);
      if (!Array.isArray(stats)) {
        markFileMigrated(filePath, stat.mtimeMs);
        continue;
      }

      db.exec('BEGIN TRANSACTION');
      try {
        for (const entry of stats) {
          if (!entry || typeof entry !== 'object') continue;
          const timestamp = typeof entry.timestamp === 'number' ? entry.timestamp : Date.now();
          const existing = checkStmt.get(projectName, timestamp);
          if (existing) continue;

          const status = (entry.status === 'error' || entry.status === 'stopped') ? entry.status : 'success';
          const snapshotStr = entry.snapshot ? JSON.stringify(entry.snapshot) : null;
          const error = entry.error || null;
          insertStmt.run(projectName, null, timestamp, timestamp, 0, status, 0, error, snapshotStr);
          count++;
        }
        markFileMigrated(filePath, stat.mtimeMs);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    } catch (e) {
      console.error(`[Migrate] ${projectName}: failed to migrate stats`, e);
    }
  }
  return count;
}

export function migrateRuns(runsDir: string = RUNS_DIR) {
  if (!fs.existsSync(runsDir)) return 0;
  const files = fs.readdirSync(runsDir).filter(f => f.endsWith('.json'));
  let count = 0;

  const insertStmt = db.prepare(`
    INSERT INTO executions (project_name, run_id, started_at, end_time, duration_ms, status, nodes_executed, error, snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const checkStmt = db.prepare('SELECT id FROM executions WHERE run_id = ? LIMIT 1');

  for (const file of files) {
    const projectName = file.replace('.json', '');
    const filePath = path.join(runsDir, file);
    try {
      const stat = fs.statSync(filePath);
      if (isFileAlreadyMigrated(filePath, stat.mtimeMs)) continue;

      const raw = fs.readFileSync(filePath, 'utf-8');
      const runs = JSON.parse(raw);
      if (!Array.isArray(runs)) {
        markFileMigrated(filePath, stat.mtimeMs);
        continue;
      }

      db.exec('BEGIN TRANSACTION');
      try {
        for (const run of runs) {
          if (!run || !run.runId) continue;
          const existing = checkStmt.get(run.runId);
          if (existing) continue;

          const startedAt = run.startTime || Date.now();
          const durationMs = run.endTime ? Math.max(0, run.endTime - startedAt) : 0;
          const status = run.status || 'success';
          insertStmt.run(projectName, run.runId, startedAt, startedAt + durationMs, durationMs, status, 0, run.error || null, null);
          count++;
        }
        markFileMigrated(filePath, stat.mtimeMs);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    } catch (e) {
      console.error(`[Migrate] ${projectName}: failed to migrate runs`, e);
    }
  }
  return count;
}

export function migrateLogs(projectsDir: string = DEFAULT_PROJECTS_DIR) {
  if (!fs.existsSync(projectsDir)) return 0;
  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('_logs.json'));
  let count = 0;

  const insertStmt = db.prepare(`
    INSERT INTO execution_logs (project_name, run_id, level, message, node_id, node_type, logged_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const file of files) {
    const projectName = file.replace('_logs.json', '');
    const filePath = path.join(projectsDir, file);
    try {
      const stat = fs.statSync(filePath);
      if (isFileAlreadyMigrated(filePath, stat.mtimeMs)) continue;

      const raw = fs.readFileSync(filePath, 'utf-8');
      const logs = JSON.parse(raw);
      if (!Array.isArray(logs)) {
        markFileMigrated(filePath, stat.mtimeMs);
        continue;
      }

      db.exec('BEGIN TRANSACTION');
      try {
        for (const log of logs) {
          const level = log.level || log.type || 'info';
          const message = log.message || log.text || (typeof log === 'string' ? log : '');
          const loggedAt = log.logged_at || log.timestamp || Date.now();
          insertStmt.run(projectName, log.runId || null, level, message, log.nodeId || null, log.nodeType || null, loggedAt);
          count++;
        }
        markFileMigrated(filePath, stat.mtimeMs);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    } catch (e) {
      console.error(`[Migrate] ${projectName}: failed to migrate logs`, e);
    }
  }
  return count;
}

export function runAutoMigration(projectsDir: string = DEFAULT_PROJECTS_DIR) {
  try {
    const startTime = Date.now();
    const projCount = migrateProjects(projectsDir);
    const invCount = migrateInventories(projectsDir);
    const statsCount = migrateStats(projectsDir);
    const runsCount = migrateRuns();
    const logsCount = migrateLogs(projectsDir);
    const totalMigrated = projCount + invCount + statsCount + runsCount + logsCount;

    if (totalMigrated > 0) {
      console.log(`[SQLite AutoMigration] Completed in ${Date.now() - startTime}ms (Projects: ${projCount}, Inventory: ${invCount}, Stats: ${statsCount}, Runs: ${runsCount}, Logs: ${logsCount})`);
    }
  } catch (err) {
    console.error('[SQLite AutoMigration] Failed to run migration:', err);
  }
}

// ─── Direct CLI execution ───────────────────────────────────────────────────

if (require.main === module) {
  console.log('=== SQLite Full Migration ===');
  runAutoMigration();
  console.log('=== Migration complete ===');
  console.log('Database path:', path.join(__dirname, '../../data/sf.db'));

  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM projects) as projects,
      (SELECT COUNT(*) FROM inventory_items) as inventory_items,
      (SELECT COUNT(*) FROM executions) as executions,
      (SELECT COUNT(*) FROM execution_logs) as execution_logs
  `).get() as Record<string, number>;
  console.log('Summary in SQLite:', counts);
}
