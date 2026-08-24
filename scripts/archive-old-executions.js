#!/usr/bin/env node
/**
 * archive-old-executions.js
 *
 * Щоденне архівування старих executions з SQLite.
 * Executions старші 30 днів переносяться в executions_archive,
 * потім видаляються з основної таблиці.
 *
 * Запуск:
 *   node scripts/archive-old-executions.js [--days N]
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, '../backend/data/sf.db');
const RETENTION_DAYS = parseInt(process.argv.find(a => a.startsWith('--days'))?.split('=')[1], 10) || 30;

const db = new DatabaseSync(DB_PATH);

// ─── Ensure archive table exists ──────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS executions_archive (
    id            INTEGER PRIMARY KEY,
    project_name  TEXT NOT NULL,
    started_at    INTEGER NOT NULL,
    duration_ms   INTEGER,
    status        TEXT NOT NULL,
    nodes_executed INTEGER DEFAULT 0,
    archived_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE INDEX IF NOT EXISTS idx_archive_project ON executions_archive(project_name, archived_at);
`);

// ─── Archive & delete ─────────────────────────────────────────────────────

const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

const countStmt = db.prepare('SELECT COUNT(*) as c FROM executions WHERE started_at < ?');
const { c: toArchive } = countStmt.get(cutoffMs);

if (toArchive === 0) {
  console.log(`No executions older than ${RETENTION_DAYS} days. Nothing to archive.`);
  db.close();
  process.exit(0);
}

const archiveStmt = db.prepare(`
  INSERT INTO executions_archive (id, project_name, started_at, duration_ms, status, nodes_executed)
  SELECT id, project_name, started_at, duration_ms, status, nodes_executed
  FROM executions WHERE started_at < ?
`);
const deleteStmt = db.prepare('DELETE FROM executions WHERE started_at < ?');

const tx = db.prepare('BEGIN');
const commit = db.prepare('COMMIT');
const rollback = db.prepare('ROLLBACK');

try {
  tx.run();
  const archiveResult = archiveStmt.run(cutoffMs);
  const deleteResult = deleteStmt.run(cutoffMs);
  commit.run();

  const archivedCount = archiveResult.changes;
  const deletedCount = deleteResult.changes;

  console.log(`Archived ${archivedCount} executions older than ${RETENTION_DAYS} days.`);
  console.log(`Deleted ${deletedCount} rows from executions.`);
  console.log(`Cutoff: ${new Date(cutoffMs).toISOString()}`);
} catch (e) {
  rollback.run();
  console.error('Archive failed, rolled back:', e.message);
  db.close();
  process.exit(1);
}

db.close();
