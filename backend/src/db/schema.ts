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

// ─── Schema ──────────────────────────────────────────────────────────────

const SCHEMA = `
-- Projects metadata
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  json_path   TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Execution runs (aggregated, one row per run)
CREATE TABLE IF NOT EXISTS executions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name  TEXT NOT NULL,
  started_at    INTEGER NOT NULL,
  duration_ms   INTEGER,
  status        TEXT NOT NULL CHECK(status IN ('success', 'error', 'stopped')),
  nodes_executed INTEGER DEFAULT 0,
  FOREIGN KEY (project_name) REFERENCES projects(name)
);

-- Execution logs (one per line, deduplicated)
CREATE TABLE IF NOT EXISTS execution_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name  TEXT NOT NULL,
  execution_id  INTEGER,
  logged_at     INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  level         TEXT NOT NULL CHECK(level IN ('info', 'error', 'success', 'debug')),
  message       TEXT NOT NULL,
  node_id       TEXT,
  node_type     TEXT
);

-- Inventory items (one row per project + item, updated on scan)
CREATE TABLE IF NOT EXISTS inventory_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  item_name   TEXT NOT NULL,
  quantity    REAL NOT NULL DEFAULT 0,
  image_url   TEXT,
  selector    TEXT,
  coords_x    INTEGER,
  coords_y    INTEGER,
  scanned_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE(project_name, item_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exec_project ON executions(project_name, started_at);
CREATE INDEX IF NOT EXISTS idx_logs_project ON execution_logs(project_name, logged_at);
CREATE INDEX IF NOT EXISTS idx_logs_exec ON execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_inv_project ON inventory_items(project_name, item_name);
`;

db.exec(SCHEMA);

export { db };

// ─── Helpers ─────────────────────────────────────────────────────────────

export function upsertProject(name: string, jsonPath: string) {
  const stmt = db.prepare(`
    INSERT INTO projects (name, json_path) VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET updated_at = (unixepoch() * 1000)
  `);
  stmt.run(name, jsonPath);
}

export function recordExecution(
  projectName: string,
  startedAt: number,
  durationMs: number,
  status: 'success' | 'error' | 'stopped',
  nodesExecuted: number = 0
) {
  const stmt = db.prepare(`
    INSERT INTO executions (project_name, started_at, duration_ms, status, nodes_executed)
    VALUES (?, ?, ?, ?, ?)
  `);
  return stmt.run(projectName, startedAt, durationMs, status, nodesExecuted);
}

export function insertLog(
  projectName: string,
  level: string,
  message: string,
  nodeId?: string,
  nodeType?: string
) {
  const stmt = db.prepare(`
    INSERT INTO execution_logs (project_name, level, message, node_id, node_type)
    VALUES (?, ?, ?, ?, ?)
  `);
  return stmt.run(projectName, level, message, nodeId ?? null, nodeType ?? null);
}

export function upsertInventoryItem(
  projectName: string,
  itemName: string,
  quantity: number,
  imageUrl?: string
) {
  const stmt = db.prepare(`
    INSERT INTO inventory_items (project_name, item_name, quantity, image_url)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(project_name, item_name) DO UPDATE SET
      quantity = excluded.quantity,
      image_url = COALESCE(excluded.image_url, image_url),
      scanned_at = (unixepoch() * 1000)
  `);
  return stmt.run(projectName, itemName, quantity, imageUrl ?? null);
}

export function getInventory(projectName: string) {
  const stmt = db.prepare(`
    SELECT item_name, quantity, image_url, scanned_at
    FROM inventory_items
    WHERE project_name = ?
    ORDER BY item_name
  `);
  return stmt.all(projectName) as Array<{
    item_name: string;
    quantity: number;
    image_url: string | null;
    scanned_at: number;
  }>;
}

export function getExecutionStats(projectName: string) {
  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total_runs,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
      AVG(duration_ms) as avg_duration_ms,
      MAX(started_at) as last_run_at
    FROM executions
    WHERE project_name = ?
  `);
  return stmt.get(projectName) as {
    total_runs: number;
    success_count: number;
    error_count: number;
    avg_duration_ms: number | null;
    last_run_at: number | null;
  };
}
