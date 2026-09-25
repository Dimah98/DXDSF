const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = process.argv[2] || path.join(__dirname, '..', 'data', 'sf.db');
const projectsDir = process.argv[3] || path.join(__dirname, '..', 'projects');

console.log('=== Complete SQLite Migration & Audit ===');
console.log('Database:', dbPath);
console.log('Projects Directory:', projectsDir);

if (!fs.existsSync(dbPath)) {
  console.log(`Database does not exist at ${dbPath}, creating directory if needed...`);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA foreign_keys = OFF;');

try { db.exec('ALTER TABLE projects ADD COLUMN content TEXT;'); } catch {}
try { db.exec('CREATE TABLE IF NOT EXISTS project_variables (project_name TEXT PRIMARY KEY, variables TEXT NOT NULL DEFAULT \'{}\', updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));'); } catch {}
try { db.exec('CREATE TABLE IF NOT EXISTS project_saves (project_name TEXT PRIMARY KEY, save_data TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));'); } catch {}
try { db.exec('CREATE TABLE IF NOT EXISTS project_layouts (project_name TEXT PRIMARY KEY, layout_data TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));'); } catch {}

// 1. Clean up non-project rows from projects table
const systemNames = ['categories', 'notifications', 'schedule', 'global_building_types', 'buildings_catalog_settings', 'configs', 'mass_launches', 'test_project_logger_runs'];
for (const sys of systemNames) {
  try {
    db.prepare('DELETE FROM projects WHERE name = ?').run(sys);
  } catch (e) {}
}
// Clean up any _vars, _save, _layout that might have been added by accident
try {
  db.exec(`
    DELETE FROM projects WHERE 
      name LIKE '%_vars' OR 
      name LIKE '%_save' OR 
      name LIKE '%_layout' OR 
      name LIKE '%_stats' OR 
      name LIKE '%_logs' OR 
      name LIKE '%_inventory';
  `);
} catch (e) {}

// 2. Read all files in projectsDir if it exists
if (fs.existsSync(projectsDir)) {
  const files = fs.readdirSync(projectsDir);
  console.log(`Total files in directory: ${files.length}`);

  let projectsCount = 0;
  let varsCount = 0;
  let savesCount = 0;
  let layoutsCount = 0;

  // Prepared statements
  const upsertProjectStmt = db.prepare(`
    INSERT INTO projects (name, json_path, created_at, updated_at, content)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      json_path = excluded.json_path,
      updated_at = excluded.updated_at,
      content = excluded.content
  `);

  const upsertVarsStmt = db.prepare(`
    INSERT INTO project_variables (project_name, variables, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(project_name) DO UPDATE SET
      variables = excluded.variables,
      updated_at = excluded.updated_at
  `);

  const upsertSaveStmt = db.prepare(`
    INSERT INTO project_saves (project_name, save_data, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(project_name) DO UPDATE SET
      save_data = excluded.save_data,
      updated_at = excluded.updated_at
  `);

  const upsertLayoutStmt = db.prepare(`
    INSERT INTO project_layouts (project_name, layout_data, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(project_name) DO UPDATE SET
      layout_data = excluded.layout_data,
      updated_at = excluded.updated_at
  `);

  // 2.1 Migrate Projects (.json without suffixes)
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    if (file.includes('_')) continue;
    const name = file.replace('.json', '');
    if (systemNames.includes(name)) continue;

    const filePath = path.join(projectsDir, file);
    try {
      const stat = fs.statSync(filePath);
      let content = fs.readFileSync(filePath, 'utf-8');
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      const parsed = JSON.parse(content);

      upsertProjectStmt.run(name, filePath, Math.floor(stat.birthtimeMs), Math.floor(stat.mtimeMs), content);
      projectsCount++;

      // If project has embedded variables, save them too
      if (parsed && parsed.variables && typeof parsed.variables === 'object' && Object.keys(parsed.variables).length > 0) {
        upsertVarsStmt.run(name, JSON.stringify(parsed.variables), Math.floor(stat.mtimeMs));
        varsCount++;
      }
    } catch (err) {
      console.error(`Error migrating project ${name}:`, err.message);
    }
  }

  // 2.2 Migrate dedicated _vars.json
  for (const file of files) {
    if (!file.endsWith('_vars.json') && file !== 'save_vars.json') continue;
    const name = file === 'save_vars.json' ? 'default' : file.replace('_vars.json', '');
    const filePath = path.join(projectsDir, file);
    try {
      const stat = fs.statSync(filePath);
      let raw = fs.readFileSync(filePath, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      const vars = JSON.parse(raw);
      if (vars && typeof vars === 'object') {
        upsertVarsStmt.run(name, JSON.stringify(vars), Math.floor(stat.mtimeMs));
        varsCount++;
      }
    } catch (err) {
      console.error(`Error migrating vars ${name}:`, err.message);
    }
  }

  // 2.3 Migrate _save.json
  for (const file of files) {
    if (!file.endsWith('_save.json') && file !== 'save.json') continue;
    const name = file === 'save.json' ? 'default' : file.replace('_save.json', '');
    const filePath = path.join(projectsDir, file);
    try {
      const stat = fs.statSync(filePath);
      let raw = fs.readFileSync(filePath, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        upsertSaveStmt.run(name, typeof data === 'string' ? data : JSON.stringify(data), Math.floor(stat.mtimeMs));
        savesCount++;
      }
    } catch (err) {
      console.error(`Error migrating save ${name}:`, err.message);
    }
  }

  // 2.4 Migrate _layout.json
  for (const file of files) {
    if (!file.endsWith('_layout.json')) continue;
    const name = file.replace('_layout.json', '');
    const filePath = path.join(projectsDir, file);
    try {
      const stat = fs.statSync(filePath);
      let raw = fs.readFileSync(filePath, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        upsertLayoutStmt.run(name, typeof data === 'string' ? data : JSON.stringify(data), Math.floor(stat.mtimeMs));
        layoutsCount++;
      }
    } catch (err) {
      console.error(`Error migrating layout ${name}:`, err.message);
    }
  }

  console.log(`\n=== Migration Results ===`);
  console.log(`Projects processed: ${projectsCount}`);
  console.log(`Variables processed: ${varsCount}`);
  console.log(`Saves processed: ${savesCount}`);
  console.log(`Layouts processed: ${layoutsCount}`);
}

// Verify SQLite row counts
try {
  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM projects) as projects,
      (SELECT COUNT(*) FROM project_variables) as project_variables,
      (SELECT COUNT(*) FROM project_saves) as project_saves,
      (SELECT COUNT(*) FROM project_layouts) as project_layouts
  `).get();
  console.log('\n=== Database Summary ===');
  console.log(counts);
} catch (err) {
  console.error('Count error:', err.message);
}
