import fs from 'fs';
import path from 'path';
import { ConfigRule, SavedConfig } from './ConfigStore';
import { PROJECTS_DIR } from '../constants';

export function resolvePath(obj: unknown, pathStr: string): { value: unknown; parent: unknown; key: string | number | null; exists: boolean } {
  if (!pathStr || typeof pathStr !== 'string') {
    return { value: undefined, parent: null, key: null, exists: false };
  }

  let cleaned = pathStr.trim();
  // Видаляємо початковий '$'
  if (cleaned.startsWith('$')) {
    cleaned = cleaned.slice(1);
  }
  // Видаляємо початкову крапку '.' якщо є
  if (cleaned.startsWith('.')) {
    cleaned = cleaned.slice(1);
  }

  // Розбиваємо шлях на токени: підтримує dot notation (a.b), bracket notation ([0], ["key-with-dash"], ['key']), та wildcard (*)
  const tokens: string[] = [];
  const regex = /\[(?:'([^']+)'|"([^"]+)"|([^\]]+))\]|([^.\[\]]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    const token = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (token !== undefined && token !== '') {
      tokens.push(token.trim());
    }
  }

  if (tokens.length === 0) {
    return { value: obj, parent: null, key: null, exists: obj !== undefined };
  }

  let current = obj;
  let parent: unknown = null;
  let lastKey: string | number | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isLast = i === tokens.length - 1;

    if (current === null || current === undefined || typeof current !== 'object') {
      return { value: undefined, parent: null, key: null, exists: false };
    }

    let nextValue: unknown = undefined;
    let actualKey: string | number = token;
    let exists = false;

    if (Array.isArray(current)) {
      if (token === '*' || token === '0' || token === 'first' || token === '$first') {
        actualKey = 0;
        exists = current.length > 0;
        nextValue = current[0];
      } else {
        const idx = parseInt(token, 10);
        if (!isNaN(idx) && idx >= 0 && idx < current.length) {
          actualKey = idx;
          exists = true;
          nextValue = current[idx];
        } else {
          exists = false;
        }
      }
    } else {
      // Об'єкт (Dictionary)
      const currentObj = current as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(currentObj, token)) {
        actualKey = token;
        exists = true;
        nextValue = currentObj[token];
      } else if (i === 0 && (token === '0' || token === '*') && i + 1 < tokens.length && Object.prototype.hasOwnProperty.call(currentObj, tokens[i + 1])) {
        // Якщо на кореневому об'єкті вказано $[0].prop замість $.prop, а prop вже є в корені — пропускаємо [0]
        continue;
      } else if (token === '*' || token === '0' || token === 'first' || token === '$first') {
        // Якщо запитується перший елемент [0] або wildcard [*] для словника (наприклад, history["2026-08-26"])
        const keys = Object.keys(currentObj);
        if (keys.length > 0) {
          actualKey = keys[0];
          exists = true;
          nextValue = currentObj[keys[0]];
        } else {
          exists = false;
        }
      } else {
        exists = false;
      }
    }

    if (isLast) {
      return { value: nextValue, parent: current, key: actualKey, exists };
    }

    if (!exists || nextValue === null || nextValue === undefined) {
      return { value: undefined, parent: current, key: actualKey, exists: false };
    }

    parent = current;
    lastKey = actualKey;
    current = nextValue;
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

export function parseTimestampMs(val: any): number {
  if (typeof val === 'number') {
    return val > 0 && val < 10000000000 ? val * 1000 : val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const num = Number(trimmed);
    if (!isNaN(num) && num > 0) {
      return num < 10000000000 ? num * 1000 : num;
    }
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

export function getDayStart3AM(timestamp: number | Date = Date.now()): number {
  const d = new Date(timestamp);
  if (d.getHours() < 3) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(3, 0, 0, 0);
  return d.getTime();
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
      const ts = parseTimestampMs(actualValue);
      const targetDayStart = getDayStart3AM(ts);
      const currentDayStart = getDayStart3AM(Date.now());
      const pass = ts > 0 && targetDayStart === currentDayStart;
      const targetStr = ts > 0 ? new Date(ts).toLocaleString('uk-UA') : String(actualValue);
      logToClient(`📅 ${targetStr} є сьогодні (з 03:00) → ${pass} (time_is_today)`, pass ? 'success' : 'error');
      return { pass };
    }
    case 'time_not_today': {
      const ts = parseTimestampMs(actualValue);
      const targetDayStart = getDayStart3AM(ts);
      const currentDayStart = getDayStart3AM(Date.now());
      const pass = ts === 0 || targetDayStart !== currentDayStart;
      const targetStr = ts > 0 ? new Date(ts).toLocaleString('uk-UA') : String(actualValue);
      logToClient(`📅 ${targetStr} не сьогодні (з 03:00) → ${pass} (time_not_today)`, pass ? 'success' : 'error');
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

export async function loadConfigFilesAsync(
  config: SavedConfig,
  projectName: string,
  logToClient: (msg: string, type?: any) => void
): Promise<Map<string, any>> {
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
      const content = await fs.promises.readFile(filePath, 'utf-8');
      fileCache.set(fileRef, JSON.parse(content));
    } catch (e: any) {
      if (e?.code === 'ENOENT') {
        logToClient(`⚠️ Файл не знайдено: ${filePath}`, 'error');
      } else {
        logToClient(`❌ Помилка читання ${filePath}: ${e.message}`, 'error');
      }
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
    fs.promises.writeFile(filePath, JSON.stringify(fileCache.get(fileRef), null, 2), 'utf-8')
      .then(() => {
        logToClient(`💾 Файл оновлено: ${path.basename(filePath)}`, 'success');
      })
      .catch((e: any) => {
        logToClient(`❌ Помилка запису ${filePath}: ${e.message}`, 'error');
      });
  }
}

export async function saveConfigFilesAsync(
  filesToSave: Set<string>,
  fileCache: Map<string, any>,
  projectName: string,
  logToClient: (msg: string, type?: any) => void
): Promise<void> {
  for (const fileRef of filesToSave) {
    const filePath = getProjectFilePath(projectName, fileRef);
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(fileCache.get(fileRef), null, 2), 'utf-8');
      logToClient(`💾 Файл оновлено: ${path.basename(filePath)}`, 'success');
    } catch (e: any) {
      logToClient(`❌ Помилка запису ${filePath}: ${e.message}`, 'error');
    }
  }
}
