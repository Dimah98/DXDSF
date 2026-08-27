// @ts-ignore — node:sqlite is built-in since Node 22.5, types may be missing
import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import * as fs from 'fs';

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'sf.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
} catch {}

// ─── Schema ──────────────────────────────────────────────────────────────

const BASE_SCHEMA = `
-- Projects metadata
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  json_path   TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Execution runs (one row per run / stats snapshot)
CREATE TABLE IF NOT EXISTS executions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id         TEXT UNIQUE,
  project_name   TEXT NOT NULL,
  started_at     INTEGER NOT NULL,
  end_time       INTEGER,
  duration_ms    INTEGER,
  status         TEXT NOT NULL,
  nodes_executed INTEGER DEFAULT 0,
  error          TEXT,
  snapshot       TEXT,
  FOREIGN KEY (project_name) REFERENCES projects(name)
);

-- Execution logs (one per line, deduplicated)
CREATE TABLE IF NOT EXISTS execution_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name  TEXT NOT NULL,
  run_id        TEXT,
  execution_id  INTEGER,
  logged_at     INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  level         TEXT NOT NULL,
  message       TEXT NOT NULL,
  node_id       TEXT,
  node_type     TEXT
);

-- Inventory items (one row per project + item, updated on scan)
CREATE TABLE IF NOT EXISTS inventory_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  item_name    TEXT NOT NULL,
  quantity     REAL NOT NULL DEFAULT 0,
  image_url    TEXT,
  selector     TEXT,
  coords_x     INTEGER,
  coords_y     INTEGER,
  scanned_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE(project_name, item_name)
);
`;

db.exec(BASE_SCHEMA);

// Migration for existing tables (if created with previous schema before columns were added)
try {
  const tableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='executions'").get() as { sql: string } | undefined;
  if (tableSql && tableSql.sql && tableSql.sql.includes("status IN ('success', 'error', 'stopped')")) {
    db.exec(`
      CREATE TABLE executions_new (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id         TEXT UNIQUE,
        project_name   TEXT NOT NULL,
        started_at     INTEGER NOT NULL,
        end_time       INTEGER,
        duration_ms    INTEGER,
        status         TEXT NOT NULL,
        nodes_executed INTEGER DEFAULT 0,
        error          TEXT,
        snapshot       TEXT,
        FOREIGN KEY (project_name) REFERENCES projects(name)
      );
      INSERT OR IGNORE INTO executions_new (id, run_id, project_name, started_at, end_time, duration_ms, status, nodes_executed, error, snapshot)
      SELECT id, run_id, project_name, started_at, end_time, duration_ms, status, nodes_executed, error, snapshot FROM executions;
      DROP TABLE executions;
      ALTER TABLE executions_new RENAME TO executions;
    `);
  }
} catch {}

try { db.exec('ALTER TABLE executions ADD COLUMN run_id TEXT'); } catch {}
try { db.exec('ALTER TABLE executions ADD COLUMN end_time INTEGER'); } catch {}
try { db.exec('ALTER TABLE executions ADD COLUMN error TEXT'); } catch {}
try { db.exec('ALTER TABLE executions ADD COLUMN snapshot TEXT'); } catch {}
try { db.exec('ALTER TABLE execution_logs ADD COLUMN run_id TEXT'); } catch {}

// Indexes (created after columns are guaranteed to exist)
try { db.exec('DROP INDEX IF EXISTS idx_exec_run_id;'); } catch {}

const INDEXES = `
CREATE INDEX IF NOT EXISTS idx_exec_project ON executions(project_name, started_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exec_run_id ON executions(run_id);
CREATE INDEX IF NOT EXISTS idx_logs_project ON execution_logs(project_name, logged_at);
CREATE INDEX IF NOT EXISTS idx_logs_run_id ON execution_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_logs_exec ON execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_inv_project ON inventory_items(project_name, item_name);
`;

db.exec(INDEXES);

export { db };

// ─── Project Helpers ──────────────────────────────────────────────────────

export function upsertProject(name: string, jsonPath: string, createdAt?: number, updatedAt?: number) {
  const now = Date.now();
  const created = createdAt || now;
  const updated = updatedAt || now;
  const stmt = db.prepare(`
    INSERT INTO projects (name, json_path, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      json_path = excluded.json_path,
      updated_at = excluded.updated_at
  `);
  stmt.run(name, jsonPath, created, updated);
}

export function getProjects(): Array<{ id: number; name: string; json_path: string; created_at: number; updated_at: number }> {
  const stmt = db.prepare('SELECT id, name, json_path, created_at, updated_at FROM projects ORDER BY name ASC');
  return stmt.all() as any[];
}

export function deleteProject(name: string) {
  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare('DELETE FROM execution_logs WHERE project_name = ?').run(name);
    db.prepare('DELETE FROM executions WHERE project_name = ?').run(name);
    db.prepare('DELETE FROM inventory_items WHERE project_name = ?').run(name);
    db.prepare('DELETE FROM projects WHERE name = ?').run(name);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ─── Execution & Stats Helpers ────────────────────────────────────────────

export function recordRunStart(projectName: string, runId: string, startTime?: number) {
  const start = startTime || Date.now();
  db.prepare(`INSERT OR IGNORE INTO projects (name, json_path, created_at, updated_at) VALUES (?, '', ?, ?)`).run(projectName, start, start);
  const stmt = db.prepare(`
    INSERT INTO executions (project_name, run_id, started_at, status)
    VALUES (?, ?, ?, 'running')
    ON CONFLICT(run_id) DO UPDATE SET
      started_at = excluded.started_at,
      status = 'running'
  `);
  stmt.run(projectName, runId, start);
}

export function recordRunFinish(
  projectName: string,
  runId: string,
  status: 'success' | 'error' | 'stopped',
  error?: string,
  endTime?: number,
  snapshot?: any
) {
  const end = endTime || Date.now();
  const snapshotStr = snapshot ? JSON.stringify(snapshot) : null;
  const stmt = db.prepare(`
    UPDATE executions
    SET status = ?, error = ?, end_time = ?, duration_ms = (? - started_at), snapshot = COALESCE(?, snapshot)
    WHERE run_id = ?
  `);
  const result = stmt.run(status, error || null, end, end, snapshotStr, runId);
  
  // If run wasn't recorded at start, insert it directly
  if (result.changes === 0) {
    const insertStmt = db.prepare(`
      INSERT INTO executions (project_name, run_id, started_at, end_time, duration_ms, status, error, snapshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(projectName, runId, end, end, 0, status, error || null, snapshotStr);
  }
}

export function recordExecution(
  projectName: string,
  startedAt: number,
  durationMs: number,
  status: 'running' | 'success' | 'error' | 'stopped',
  nodesExecuted: number = 0,
  error?: string,
  snapshot?: any,
  runId?: string
) {
  const snapshotStr = snapshot ? (typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot)) : null;
  const stmt = db.prepare(`
    INSERT INTO executions (project_name, run_id, started_at, end_time, duration_ms, status, nodes_executed, error, snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const endTime = startedAt + (durationMs || 0);
  return stmt.run(
    projectName,
    runId || null,
    startedAt,
    endTime,
    durationMs,
    status,
    nodesExecuted,
    error || null,
    snapshotStr
  );
}

export function getRunsForProject(projectName: string): Array<{
  runId: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'success' | 'error' | 'stopped';
  error?: string;
}> {
  const stmt = db.prepare(`
    SELECT run_id, started_at, end_time, status, error
    FROM executions
    WHERE project_name = ? AND run_id IS NOT NULL
    ORDER BY started_at DESC
  `);
  const rows = stmt.all(projectName) as Array<{
    run_id: string;
    started_at: number;
    end_time: number | null;
    status: string;
    error: string | null;
  }>;
  return rows.map(r => ({
    runId: r.run_id,
    startTime: r.started_at,
    endTime: r.end_time || undefined,
    status: r.status as 'running' | 'success' | 'error' | 'stopped',
    error: r.error || undefined
  }));
}

export function getProjectStats(projectName: string): Array<{
  timestamp: number;
  status: string;
  error?: string;
  snapshot?: Record<string, any>;
}> {
  const stmt = db.prepare(`
    SELECT started_at as timestamp, status, error, snapshot
    FROM executions
    WHERE project_name = ?
    ORDER BY started_at ASC
  `);
  const rows = stmt.all(projectName) as Array<{
    timestamp: number;
    status: string;
    error: string | null;
    snapshot: string | null;
  }>;
  return rows.map(r => {
    let parsedSnapshot: Record<string, any> | undefined = undefined;
    if (r.snapshot) {
      try {
        parsedSnapshot = typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : r.snapshot;
      } catch {}
    }
    return {
      timestamp: r.timestamp,
      status: r.status,
      error: r.error || undefined,
      snapshot: parsedSnapshot
    };
  });
}

export function getAllGlobalStats(): Array<{
  projectName: string;
  stats: Array<{ timestamp: number; status: string; error?: string; snapshot?: Record<string, any> }>;
}> {
  const stmt = db.prepare(`
    SELECT project_name, started_at as timestamp, status, error, snapshot
    FROM executions
    ORDER BY project_name, started_at ASC
  `);
  const rows = stmt.all() as Array<{
    project_name: string;
    timestamp: number;
    status: string;
    error: string | null;
    snapshot: string | null;
  }>;
  const grouped: Record<string, any[]> = {};
  for (const r of rows) {
    if (!grouped[r.project_name]) {
      grouped[r.project_name] = [];
    }
    let parsedSnapshot: Record<string, any> | undefined = undefined;
    if (r.snapshot) {
      try {
        parsedSnapshot = typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : r.snapshot;
      } catch {}
    }
    grouped[r.project_name].push({
      timestamp: r.timestamp,
      status: r.status,
      error: r.error || undefined,
      snapshot: parsedSnapshot
    });
  }
  return Object.entries(grouped).map(([projectName, stats]) => ({ projectName, stats }));
}

export function getExecutionStats(projectName: string) {
  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total_runs,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
      SUM(CASE WHEN status = 'stopped' THEN 1 ELSE 0 END) as stopped_count,
      AVG(duration_ms) as avg_duration_ms,
      MAX(started_at) as last_run_at
    FROM executions
    WHERE project_name = ?
  `);
  return stmt.get(projectName) as {
    total_runs: number;
    success_count: number;
    error_count: number;
    stopped_count: number;
    avg_duration_ms: number | null;
    last_run_at: number | null;
  };
}

// ─── Log Helpers ──────────────────────────────────────────────────────────

export function insertLog(
  projectName: string,
  level: string,
  message: string,
  nodeId?: string,
  nodeType?: string,
  runId?: string,
  loggedAt?: number
) {
  const stmt = db.prepare(`
    INSERT INTO execution_logs (project_name, run_id, level, message, node_id, node_type, logged_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    projectName,
    runId || null,
    level,
    message,
    nodeId || null,
    nodeType || null,
    loggedAt || Date.now()
  );
}

export function getLogs(projectName: string, limit: number = 1000): Array<{
  level: string;
  message: string;
  logged_at: number;
  node_id: string | null;
  node_type: string | null;
}> {
  const stmt = db.prepare(`
    SELECT level, message, logged_at, node_id, node_type
    FROM execution_logs
    WHERE project_name = ?
    ORDER BY logged_at ASC
    LIMIT ?
  `);
  return stmt.all(projectName, limit) as any[];
}

export function getRunLogs(projectName: string, runId: string): string {
  const stmt = db.prepare(`
    SELECT level, message, logged_at
    FROM execution_logs
    WHERE project_name = ? AND run_id = ?
    ORDER BY logged_at ASC
  `);
  const rows = stmt.all(projectName, runId) as Array<{ level: string; message: string; logged_at: number }>;
  if (rows.length === 0) return '';
  return rows
    .map(r => `[${new Date(r.logged_at).toISOString()}] [${r.level.toUpperCase()}] ${r.message}`)
    .join('\n') + '\n';
}

export function saveLogs(projectName: string, logs: any[]) {
  if (!Array.isArray(logs) || logs.length === 0) return;
  const stmt = db.prepare(`
    INSERT INTO execution_logs (project_name, run_id, level, message, node_id, node_type, logged_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  db.exec('BEGIN TRANSACTION');
  try {
    for (const log of logs) {
      const level = log.level || log.type || 'info';
      const message = log.message || log.text || (typeof log === 'string' ? log : '');
      const loggedAt = log.logged_at || log.timestamp || Date.now();
      const nodeId = log.nodeId || log.node_id || null;
      const nodeType = log.nodeType || log.node_type || null;
      const runId = log.runId || log.run_id || null;
      stmt.run(projectName, runId, level, message, nodeId, nodeType, loggedAt);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function deleteLogs(projectName: string) {
  const stmt = db.prepare('DELETE FROM execution_logs WHERE project_name = ?');
  return stmt.run(projectName);
}

// ─── Inventory Helpers ────────────────────────────────────────────────────

export function upsertInventoryItem(
  projectName: string,
  itemName: string,
  quantity: number,
  imageUrl?: string,
  selector?: string,
  coordsX?: number,
  coordsY?: number
) {
  const stmt = db.prepare(`
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
  return stmt.run(
    projectName,
    itemName,
    quantity,
    imageUrl || null,
    selector || null,
    coordsX ?? null,
    coordsY ?? null,
    Date.now()
  );
}

export function getInventory(projectName: string): Array<{
  item_name: string;
  quantity: number;
  image_url: string | null;
  scanned_at: number;
}> {
  const stmt = db.prepare(`
    SELECT item_name, quantity, image_url, scanned_at
    FROM inventory_items
    WHERE project_name = ?
    ORDER BY item_name ASC
  `);
  return stmt.all(projectName) as any[];
}

export function getAllInventories(): Record<string, Array<{ item_name: string; quantity: number; image_url: string | null; scanned_at: number }>> {
  const stmt = db.prepare(`
    SELECT project_name, item_name, quantity, image_url, scanned_at
    FROM inventory_items
    ORDER BY project_name, item_name ASC
  `);
  const rows = stmt.all() as any[];
  const result: Record<string, any[]> = {};
  for (const r of rows) {
    if (!result[r.project_name]) {
      result[r.project_name] = [];
    }
    result[r.project_name].push({
      item_name: r.item_name,
      quantity: r.quantity,
      image_url: r.image_url,
      scanned_at: r.scanned_at
    });
  }
  return result;
}

export function deleteInventory(projectName: string) {
  const stmt = db.prepare('DELETE FROM inventory_items WHERE project_name = ?');
  return stmt.run(projectName);
}
