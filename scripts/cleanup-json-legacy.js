/**
 * cleanup-json-legacy.js
 *
 * Безпечне очищення legacy JSON-файлів після міграції на SQLite.
 *
 * Що видаляє:
 *   - *_stats.json   → дані в SQLite table `executions`
 *   - *_logs.json    → дані в SQLite table `execution_logs`
 *   - *_inventory.json → дані в SQLite table `inventory_items`
 *
 * Що НЕ чіпає:
 *   - {name}.json       (проєктні дані — primary source)
 *   - {name}_save.json  (game save дані)
 *   - schedule.json, notifications.json, categories.json
 *
 * Запуск:
 *   node scripts/cleanup-json-legacy.js --dry-run    # перевірка без видалення
 *   node scripts/cleanup-json-legacy.js --execute    # виконати очищення
 */

const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, '../backend/projects');
const DB_PATH = path.join(__dirname, '../backend/data/sf.db');
const ARCHIVE_DIR = path.join(__dirname, '../.backup/legacy-json');

const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getFilesToClean(dir) {
  const files = fs.readdirSync(dir);
  const toClean = [];
  let totalSize = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    if (
      file.endsWith('_stats.json') ||
      file.endsWith('_logs.json') ||
      file.endsWith('_inventory.json')
    ) {
      toClean.push({ name: file, path: filePath, size: stat.size });
      totalSize += stat.size;
    }
  }

  return { files: toClean, totalSize };
}

function validatePreconditions(files) {
  const errors = [];

  if (!fs.existsSync(DB_PATH)) {
    errors.push(`SQLite database not found: ${DB_PATH}`);
  }

  if (!fs.existsSync(PROJECTS_DIR)) {
    errors.push(`Projects directory not found: ${PROJECTS_DIR}`);
  }

  // Check SQLite has data corresponding to files that will be cleaned
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(DB_PATH);
    const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
    const execCount = db.prepare('SELECT COUNT(*) as c FROM executions').get().c;
    const invCount = db.prepare('SELECT COUNT(*) as c FROM inventory_items').get().c;
    db.close();

    const hasStatsFiles = files.some(f => f.name.endsWith('_stats.json'));
    const hasInvFiles = files.some(f => f.name.endsWith('_inventory.json'));

    if (projectCount === 0) errors.push('SQLite projects table is empty (run migration first)');
    if (hasStatsFiles && execCount === 0) errors.push('SQLite executions table is empty but stats files exist');
    if (hasInvFiles && invCount === 0) errors.push('SQLite inventory_items table is empty but inventory files exist');

    console.log(`SQLite check: ${projectCount} projects, ${execCount} executions, ${invCount} inventory items ✓`);
  } catch (e) {
    errors.push(`Failed to read SQLite: ${e.message}`);
  }

  return errors;
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  console.log('=== Legacy JSON Cleanup ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : EXECUTE ? 'EXECUTE' : 'PREVIEW (use --dry-run or --execute)'}`);
  console.log('');

  if (!DRY_RUN && !EXECUTE) {
    console.log('Usage:');
    console.log('  node scripts/cleanup-json-legacy.js --dry-run   # preview what will be cleaned');
    console.log('  node scripts/cleanup-json-legacy.js --execute   # perform cleanup');
    console.log('');
  }

  // Scan files
  const { files, totalSize } = getFilesToClean(PROJECTS_DIR);

  if (files.length === 0) {
    console.log('No legacy files found. Nothing to clean.');
    return;
  }

  // Validation
  const errors = validatePreconditions(files);
  if (errors.length > 0) {
    console.error('Precondition errors:');
    errors.forEach(e => console.error(`  ❌ ${e}`));
    process.exit(1);
  }

  console.log(`Found ${files.length} legacy files (${formatBytes(totalSize)}):`);
  const byType = { stats: 0, logs: 0, inventory: 0 };
  for (const f of files) {
    if (f.name.endsWith('_stats.json')) byType.stats++;
    else if (f.name.endsWith('_logs.json')) byType.logs++;
    else if (f.name.endsWith('_inventory.json')) byType.inventory++;
    console.log(`  ${f.name} (${formatBytes(f.size)})`);
  }
  console.log(`\nBreakdown: ${byType.stats} stats, ${byType.logs} logs, ${byType.inventory} inventory`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No files were modified.');
    return;
  }

  if (!EXECUTE) {
    console.log('\nRun with --execute to clean these files.');
    return;
  }

  // Execute cleanup
  console.log('\nExecuting cleanup...');
  ensureDir(ARCHIVE_DIR);

  let archived = 0;
  let failed = 0;

  for (const f of files) {
    const archivePath = path.join(ARCHIVE_DIR, f.name);
    try {
      fs.copyFileSync(f.path, archivePath);
      fs.unlinkSync(f.path);
      archived++;
      console.log(`  ✅ ${f.name} → archived + deleted`);
    } catch (e) {
      failed++;
      console.error(`  ❌ ${f.name}: ${e.message}`);
    }
  }

  console.log(`\n=== Cleanup complete ===`);
  console.log(`Archived: ${archived}, Failed: ${failed}`);
  console.log(`Archive location: ${ARCHIVE_DIR}`);
  console.log(`Space freed: ${formatBytes(totalSize)}`);
  console.log(`\nTo restore: copy files from ${ARCHIVE_DIR} back to ${PROJECTS_DIR}`);
}

main();
