import fs from 'fs';
import path from 'path';
import { ConfigRule, SavedConfig } from './ConfigStore';

const PROJECTS_DIR = path.join(__dirname, '../../projects');

export function resolvePath(obj: unknown, pathStr: string): { value: unknown; parent: unknown; key: string | number | null; exists: boolean } {
  if (!pathStr.startsWith('$.')) {
    return { value: undefined, parent: null, key: null, exists: false };
  }
  const keys = pathStr.slice(2).replace(/\[(\w+)\]/g, '.$1').split('.').filter(Boolean);
  let current = obj;
  let parent: unknown = null;
  let lastKey: string | number | null = null;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const isLast = i === keys.length - 1;
    if (current === null || current === undefined) {
      return { value: undefined, parent: null, key: null, exists: false };
    }
    if (isLast) {
      parent = current;
      lastKey = key;
      const exists = Object.prototype.hasOwnProperty.call(current, key);
      return { value: (current as Record<string, unknown>)[key], parent, key: lastKey, exists };
    }
    parent = current;
    lastKey = key;
    current = (current as Record<string, unknown>)[key];
  }
  return { value: current, parent, key: lastKey, exists: true };
}

export function deleteAtPath(obj: unknown, pathStr: string): boolean {
  const resolved = resolvePath(obj, pathStr);
  if (!resolved.exists || !resolved.parent || resolved.key === null) return false;
  const parent = resolved.parent as Record<string, unknown>;
  const key = resolved.key;
  if (Array.isArray(parent) && typeof key === 'string') {
    const idx = parseInt(key, 10);
    if (!isNaN(idx) && idx >= 0 && idx < parent.length) {
      parent.splice(idx, 1);
      return true;
    }
  }
  delete parent[key];
  return true;
}

export function getProjectFilePath(projectName: string, fileRef: string): string {
  if (fileRef === '(save)') {
    return path.join(PROJECTS_DIR, `${projectName}_save.json`);
  }
  if (fileRef === '(stats)') {
    return path.join(PROJECTS_DIR, `${projectName}_stats.json`);
  }
  if (!path.isAbsolute(fileRef)) {
    return path.join(PROJECTS_DIR, fileRef);
  }
  return fileRef;
}

export function evaluateRule(
  rule: ConfigRule,
  leftData: unknown,
  rightData: unknown | undefined,
  logToClient: (msg: string, type?: unknown) => void
): { pass: boolean; extractedValue?: unknown; deleted?: boolean } {
  const resolved = resolvePath(leftData, rule.path);
  const actualValue = resolved.value;
  const exists = resolved.exists;

  let rightValue: unknown = rule.value;
  let rightLabel = JSON.stringify(rule.value);
  if (rule.rightType === 'path' && rightData && rule.rightPath) {
    const rightResolved = resolvePath(rightData, rule.rightPath);
    rightValue = rightResolved.value;
    rightLabel = `[${rule.rightPath}=${JSON.stringify(rightValue)}]`;
  }

  switch (rule.operator) {
    case 'exists': {
      const pass = exists && actualValue !== undefined && actualValue !== null;
      logToClient(`📋 exists [${rule.path}] → ${pass} (value: ${JSON.stringify(actualValue)})`, pass ? 'success' : 'error');
      return { pass };
    }
    case 'not_exists': {
      const pass = !exists || actualValue === undefined || actualValue === null;
      logToClient(`📋 not_exists [${rule.path}] → ${pass} (value: ${JSON.stringify(actualValue)})`, pass ? 'success' : 'error');
      return { pass };
    }
    case 'read': {
      logToClient(`📖 read [${rule.path}] = ${JSON.stringify(actualValue)}`, 'info');
      return { pass: true, extractedValue: actualValue };
    }
    case 'read_delete': {
      logToClient(`📖⛔ read_delete [${rule.path}] = ${JSON.stringify(actualValue)}`, 'info');
      return { pass: true, extractedValue: actualValue, deleted: true };
    }
    case '>': {
      const a = Number(actualValue ?? 0);
      const b = Number(rightValue ?? 0);
      const pass = a > b;
      logToClient(`⚙️ ${a} > ${rightLabel} → ${pass}`, pass ? 'success' : 'error');
      return { pass };
    }
    case '<': {
      const a = Number(actualValue ?? 0);
      const b = Number(rightValue ?? 0);
      const pass = a < b;
      logToClient(`⚙️ ${a} < ${rightLabel} → ${pass}`, pass ? 'success' : 'error');
      return { pass };
    }
    case '>=': {
      const a = Number(actualValue ?? 0);
      const b = Number(rightValue ?? 0);
      const pass = a >= b;
      logToClient(`⚙️ ${a} >= ${rightLabel} → ${pass}`, pass ? 'success' : 'error');
      return { pass };
    }
    case '<=': {
      const a = Number(actualValue ?? 0);
      const b = Number(rightValue ?? 0);
      const pass = a <= b;
      logToClient(`⚙️ ${a} <= ${rightLabel} → ${pass}`, pass ? 'success' : 'error');
      return { pass };
    }
    case '==': {
      const pass = actualValue == rightValue;
      logToClient(`⚙️ ${JSON.stringify(actualValue)} == ${rightLabel} → ${pass}`, pass ? 'success' : 'error');
      return { pass };
    }
    case '!=': {
      const pass = actualValue != rightValue;
      logToClient(`⚙️ ${JSON.stringify(actualValue)} != ${rightLabel} → ${pass}`, pass ? 'success' : 'error');
      return { pass };
    }
    case 'contains': {
      const a = String(actualValue ?? '');
      const b = String(rightValue ?? '');
      const pass = a.includes(b);
      logToClient(`🔤 "${a}" contains "${b}" → ${pass}`, pass ? 'success' : 'error');
      return { pass };
    }
    case 'starts_with': {
      const a = String(actualValue ?? '');
      const b = String(rightValue ?? '');
      const pass = a.startsWith(b);
      logToClient(`🔤 "${a}" startsWith "${b}" → ${pass}`, pass ? 'success' : 'error');
      return { pass };
    }
    case 'ends_with': {
      const a = String(actualValue ?? '');
      const b = String(rightValue ?? '');
      const pass = a.endsWith(b);
      logToClient(`🔤 "${a}" endsWith "${b}" → ${pass}`, pass ? 'success' : 'error');
      return { pass };
    }
    case 'matches': {
      const a = String(actualValue ?? '');
      const b = String(rightValue ?? '');
      let pass = false;
      try { pass = new RegExp(b).test(a); } catch (e) { logToClient(`❌ Invalid regex: "${b}"`, 'error'); }
      logToClient(`🔤 "${a}" matches /${b}/ → ${pass}`, pass ? 'success' : 'error');
      return { pass };
    }
    case 'time_before': {
      const a = Number(actualValue ?? 0);
      const now = Date.now();
      const pass = a < now;
      logToClient(`⏰ ${a} < now(${now}) → ${pass} (time_before)`, pass ? 'success' : 'error');
      return { pass };
    }
    case 'time_after': {
      const a = Number(actualValue ?? 0);
      const now = Date.now();
      const pass = a > now;
      logToClient(`⏰ ${a} > now(${now}) → ${pass} (time_after)`, pass ? 'success' : 'error');
      return { pass };
    }
    case 'time_equals': {
      const a = Number(actualValue ?? 0);
      const now = Date.now();
      const pass = Math.abs(a - now) < 1000;
      logToClient(`⏰ ${a} ≈ now(${now}) → ${pass} (time_equals, ±1s)`, pass ? 'success' : 'error');
      return { pass };
    }
    case 'time_is_today': {
      const a = Number(actualValue ?? 0);
      const targetDate = new Date(a).setHours(0, 0, 0, 0);
      const today = new Date().setHours(0, 0, 0, 0);
      const pass = targetDate === today;
      logToClient(`📅 ${new Date(a).toLocaleDateString('uk-UA')} є сьогодні → ${pass} (time_is_today)`, pass ? 'success' : 'error');
      return { pass };
    }
    case 'time_not_today': {
      const a = Number(actualValue ?? 0);
      const targetDate = new Date(a).setHours(0, 0, 0, 0);
      const today = new Date().setHours(0, 0, 0, 0);
      const pass = targetDate !== today;
      logToClient(`📅 ${new Date(a).toLocaleDateString('uk-UA')} не сьогодні → ${pass} (time_not_today)`, pass ? 'success' : 'error');
      return { pass };
    }
    default:
      logToClient(`❌ Невідомий оператор: ${rule.operator}`, 'error');
      return { pass: false };
  }
}

export function evaluateConfig(
  config: SavedConfig,
  projectName: string,
  fileCache: Map<string, any>,
  filesToSave: Set<string>,
  extractedVars: Record<string, any>,
  globalVariables: Record<string, any>,
  logToClient: (msg: string, type?: any) => void,
  depth: number = 0
): boolean {
  const indent = '  '.repeat(depth);

  if (config.enabled === false) {
    logToClient(`${indent}🚫 Конфіг «${config.name}» ВИМКНЕНО → FALSE`, 'error');
    return false;
  }

  logToClient(`${indent}🔧 Конфіг: «${config.name}» (${config.rules.length} правил${config.subConfigs?.length ? `, ${config.subConfigs.length} підконфігів` : ''})`, 'info');

  const requiredRules = config.rules.filter(r => r.required !== false);
  const optionalRules = config.rules.filter(r => r.required === false);

  let allRequiredPassed = true;
  for (const rule of requiredRules) {
    const leftData = fileCache.get(rule.file) ?? {};
    const rightData = rule.rightType === 'path' && rule.rightFile
      ? fileCache.get(rule.rightFile)
      : undefined;

    const result = evaluateRule(rule, leftData, rightData, logToClient);

    if (result.extractedValue !== undefined) {
      const varName = rule.outputVar || rule.path.split('.').pop()?.replace(/\[\w+\]/g, '') || rule.id;
      extractedVars[varName] = result.extractedValue;
      if (rule.outputVar) {
        globalVariables[rule.outputVar] = result.extractedValue;
      }
      logToClient(`📦 [${varName}] = ${JSON.stringify(result.extractedValue)}`, 'success');
    }

    if (result.deleted) {
      deleteAtPath(leftData, rule.path);
      filesToSave.add(rule.file);
      logToClient(`⛔ Видалено: ${rule.path}`, 'info');
    }

    if (!result.pass) {
      allRequiredPassed = false;
    }
  }

  let anyOptionalPassed = optionalRules.length === 0;
  if (optionalRules.length > 0) {
    for (const rule of optionalRules) {
      const leftData = fileCache.get(rule.file) ?? {};
      const rightData = rule.rightType === 'path' && rule.rightFile
        ? fileCache.get(rule.rightFile)
        : undefined;

      const result = evaluateRule(rule, leftData, rightData, logToClient);

      if (result.extractedValue !== undefined) {
        const varName = rule.outputVar || rule.path.split('.').pop()?.replace(/\[\w+\]/g, '') || rule.id;
        extractedVars[varName] = result.extractedValue;
        if (rule.outputVar) {
          globalVariables[rule.outputVar] = result.extractedValue;
        }
        logToClient(`📦 [${varName}] = ${JSON.stringify(result.extractedValue)}`, 'success');
      }

      if (result.deleted) {
        deleteAtPath(leftData, rule.path);
        filesToSave.add(rule.file);
        logToClient(`⛔ Видалено: ${rule.path}`, 'info');
      }

      if (result.pass) {
        anyOptionalPassed = true;
      }
    }
  }

  const rulesPassed = allRequiredPassed && anyOptionalPassed;

  if (config.subConfigs && config.subConfigs.length > 0) {
    let anySubPassed = false;
    for (const sub of config.subConfigs) {
      const subPassed = evaluateConfig(sub, projectName, fileCache, filesToSave, extractedVars, globalVariables, logToClient, depth + 1);
      if (subPassed) anySubPassed = true;
    }
    const final = rulesPassed && anySubPassed;
    logToClient(`${indent}${final ? '✅' : '❌'} Результат «${config.name}» (required=${allRequiredPassed}, optional=${anyOptionalPassed}, subs=${anySubPassed}) → ${final ? 'TRUE' : 'FALSE'}`, final ? 'success' : 'error');
    return final;
  }

  logToClient(`${indent}${rulesPassed ? '✅' : '❌'} Результат «${config.name}» (required=${allRequiredPassed}, optional=${anyOptionalPassed}) → ${rulesPassed ? 'TRUE' : 'FALSE'}`, rulesPassed ? 'success' : 'error');
  return rulesPassed;
}

/**
 * Завантажити всі файли, необхідні для оцінки конфігурації.
 */
export function loadConfigFiles(
  config: SavedConfig,
  projectName: string,
  logToClient: (msg: string, type?: any) => void
): Map<string, any> {
  function collectFiles(cfg: SavedConfig, files: Set<string>) {
    for (const rule of cfg.rules) {
      files.add(rule.file);
      if (rule.rightType === 'path' && rule.rightFile) files.add(rule.rightFile);
    }
    if (cfg.subConfigs) {
      for (const sub of cfg.subConfigs) collectFiles(sub, files);
    }
  }
  const allFiles = new Set<string>();
  collectFiles(config, allFiles);

  const fileCache = new Map<string, any>();
  for (const fileRef of allFiles) {
    const filePath = getProjectFilePath(projectName, fileRef);
    try {
      if (fs.existsSync(filePath)) {
        fileCache.set(fileRef, JSON.parse(fs.readFileSync(filePath, 'utf-8')));
      } else {
        logToClient(`⚠️ Файл не знайдено: ${filePath}`, 'error');
        fileCache.set(fileRef, {});
      }
    } catch (e: any) {
      logToClient(`❌ Помилка читання ${filePath}: ${e.message}`, 'error');
      fileCache.set(fileRef, {});
    }
  }
  return fileCache;
}

/**
 * Зберегти змінені файли після оцінки конфігурації.
 */
export function saveConfigFiles(
  filesToSave: Set<string>,
  fileCache: Map<string, any>,
  projectName: string,
  logToClient: (msg: string, type?: any) => void
) {
  for (const fileRef of filesToSave) {
    const filePath = getProjectFilePath(projectName, fileRef);
    try {
      fs.writeFileSync(filePath, JSON.stringify(fileCache.get(fileRef), null, 2), 'utf-8');
      logToClient(`💾 Файл оновлено: ${path.basename(filePath)}`, 'success');
    } catch (e: any) {
      logToClient(`❌ Помилка запису ${filePath}: ${e.message}`, 'error');
    }
  }
}
