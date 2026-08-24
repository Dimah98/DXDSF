import * as fs from 'fs';
import * as path from 'path';
import { db, upsertProject, upsertInventoryItem, recordExecution } from './schema';

const PROJECTS_DIR = path.join(__dirname, '../../projects');

function migrateInventories() {
  const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('_inventory.json'));
  console.log(`Migrating ${files.length} inventory files...`);
  for (const file of files) {
    const projectName = file.replace('_inventory.json', '');
    const filePath = path.join(PROJECTS_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const items = Array.isArray(data.data) ? data.data : [];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const name = item.image ? path.basename(item.image, path.extname(item.image)) : 'unknown';
        upsertInventoryItem(
          projectName,
          name,
          typeof item.number === 'number' ? item.number : parseFloat(item.number) || 0,
          item.image
        );
      }
      console.log(`  ${projectName}: ${items.length} items migrated`);
    } catch (e) {
      console.error(`  ${projectName}: failed to migrate inventory`, e);
    }
  }
}

function migrateStats() {
  const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('_stats.json'));
  console.log(`Migrating ${files.length} stats files...`);
  for (const file of files) {
    const projectName = file.replace('_stats.json', '');
    const filePath = path.join(PROJECTS_DIR, file);
    try {
      const stats = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (!Array.isArray(stats)) { console.log(`  ${projectName}: not an array, skipped`); continue; }
      let successCount = 0, totalDuration = 0, validRuns = 0;
      for (const entry of stats) {
        if (!entry || typeof entry !== 'object') continue;
        // const ts = typeof entry.timestamp === 'number' ? entry.timestamp : Date.now(); // unused
        const hasData = entry.snapshot && Object.keys(entry.snapshot).length > 0;
        if (hasData) { successCount++; } else { continue; }
        totalDuration += 0; // duration not tracked in old format
        validRuns++;
      }
      if (validRuns > 0) {
        recordExecution(projectName, Date.now(), 0, 'success', validRuns);
      }
      console.log(`  ${projectName}: ${validRuns} runs aggregated`);
    } catch (e) {
      console.error(`  ${projectName}: failed to migrate stats`, e);
    }
  }
}

function migrateProjects() {
  const files = fs.readdirSync(PROJECTS_DIR)
    .filter(f => f.endsWith('.json') && !f.includes('_'));
  console.log(`Migrating ${files.length} project metadata...`);
  for (const file of files) {
    const projectName = file.replace('.json', '');
    const filePath = path.join(PROJECTS_DIR, file);
    try {
      const stats = fs.statSync(filePath);
      upsertProject(projectName, filePath);
      // Update created_at to match file birthtime
      db.prepare('UPDATE projects SET created_at = ?, updated_at = ? WHERE name = ?')
        .run(stats.birthtimeMs, stats.mtimeMs, projectName);
      console.log(`  ${projectName}: metadata migrated`);
    } catch (e) {
      console.error(`  ${projectName}: failed to migrate project`, e);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

console.log('=== SQLite Migration ===');
migrateProjects();
migrateInventories();
migrateStats();
console.log('=== Migration complete ===');
console.log('Database path:', path.join(__dirname, '../../data/sf.db'));

// Show summary
const counts = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM projects) as projects,
    (SELECT COUNT(*) FROM inventory_items) as inventory_items,
    (SELECT COUNT(*) FROM executions) as executions
`).get() as Record<string, number>;
console.log('Summary:', counts);
