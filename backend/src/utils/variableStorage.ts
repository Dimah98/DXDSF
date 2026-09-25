import path from 'path';
import fs from 'fs';
import { PROJECTS_DIR, SAVE_PATH } from '../constants';
import { writeJsonAtomic, readJsonSafe } from './fileUtils';
import { getDbProjectVariables, saveDbProjectVariables } from '../db/schema';
import { Logger } from '../logger';

const logger = new Logger('VariableStorage');

/**
 * Повертає шлях до резервного файлу змінних проекту на диску
 */
export function getProjectVarsPath(projectName: string): string {
  return path.join(PROJECTS_DIR, `${projectName}_vars.json`);
}

/**
 * Повертає шлях до дефолтного файлу змінних поруч із save.json
 */
export function getSaveVarsPath(): string {
  const dir = path.dirname(SAVE_PATH);
  return path.join(dir, 'save_vars.json');
}

/**
 * Завантажує змінні проекту.
 * Пріоритет:
 * 1. Швидка база даних SQLite (`project_variables`)
 * 2. Окремий файл {projectName}_vars.json (2-5 КБ) з авто-міграцією в SQLite
 * 3. Для 'default' — save_vars.json
 * 4. Фолбек: зчитування з головного файлу {projectName}.json з авто-міграцією
 */
export async function loadProjectVariables(projectName: string): Promise<Record<string, any>> {
  // 1. Спроба завантажити зі швидкого SQLite сховища
  try {
    const dbVars = getDbProjectVariables(projectName);
    if (dbVars && Object.keys(dbVars).length > 0) {
      return dbVars;
    }
  } catch (err) {
    logger.warn(`Failed to read variables from SQLite for ${projectName}`, { error: String(err) });
  }

  // 2. Читання з окремого файлу _vars.json
  const varsPath = getProjectVarsPath(projectName);
  if (fs.existsSync(varsPath)) {
    const fileVars = await readJsonSafe<Record<string, any>>(varsPath, {});
    if (Object.keys(fileVars).length > 0) {
      try {
        saveDbProjectVariables(projectName, fileVars);
      } catch (_) {}
      return fileVars;
    }
  }

  // 3. Фолбек для дефолтного проекту
  if (projectName === 'default') {
    const saveVarsPath = getSaveVarsPath();
    if (fs.existsSync(saveVarsPath)) {
      const defaultVars = await readJsonSafe<Record<string, any>>(saveVarsPath, {});
      if (Object.keys(defaultVars).length > 0) {
        try {
          saveDbProjectVariables(projectName, defaultVars);
        } catch (_) {}
        return defaultVars;
      }
    }
  }

  // 4. Фолбек зворотної сумісності: зчитуємо змінні з існуючого файлу проекту
  const projectPath = path.join(PROJECTS_DIR, `${projectName}.json`);
  let legacyPath = projectPath;
  if (!fs.existsSync(projectPath) && projectName === 'default' && fs.existsSync(SAVE_PATH)) {
    legacyPath = SAVE_PATH;
  }

  if (fs.existsSync(legacyPath)) {
    try {
      const raw = await fs.promises.readFile(legacyPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.variables === 'object' && parsed.variables !== null) {
        const vars = parsed.variables;
        // Автоматично мігруємо в SQLite та файл
        try {
          saveDbProjectVariables(projectName, vars);
        } catch (_) {}
        await saveProjectVariables(projectName, vars).catch(() => {});
        logger.info(`Migrated legacy variables to SQLite and file for ${projectName}`, {
          count: Object.keys(vars).length
        });
        return vars;
      }
    } catch (e) {
      logger.warn(`Failed to read legacy variables from ${legacyPath}`, { error: String(e) });
    }
  }

  return {};
}

/**
 * Миттєво зберігає змінні проекту в SQLite та оновлює резервний файл {projectName}_vars.json на диску.
 */
export async function saveProjectVariables(projectName: string, variables: Record<string, any>): Promise<void> {
  // 1. Зберігаємо в SQLite
  try {
    saveDbProjectVariables(projectName, variables);
  } catch (dbErr) {
    logger.error(`Failed to save variables to SQLite for ${projectName}`, dbErr instanceof Error ? dbErr : new Error(String(dbErr)));
  }

  // 2. Зберігаємо резервний файл на диск
  try {
    const varsPath = getProjectVarsPath(projectName);
    await writeJsonAtomic(varsPath, variables, 2);

    if (projectName === 'default') {
      const saveVarsPath = getSaveVarsPath();
      try {
        await writeJsonAtomic(saveVarsPath, variables, 2);
      } catch (_) {}
    }
  } catch (fileErr) {
    logger.warn(`Failed to write backup vars file for ${projectName}`, { error: String(fileErr) });
  }
}
