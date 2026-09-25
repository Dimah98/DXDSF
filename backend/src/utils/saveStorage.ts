import * as fs from 'fs';
import * as path from 'path';
import { PROJECTS_DIR, SAVE_PATH } from '../constants';
import { getDbProjectSave, saveDbProjectSave } from '../db/schema';
import { writeJsonAtomic } from './fileUtils';
import { Logger } from '../logger';

const logger = new Logger('SaveStorage');

/**
 * Отримує шлях до резервного файлу збереження проекту на диску
 */
export function getSaveFilePath(projectName: string): string {
  if (projectName === 'default' && fs.existsSync(SAVE_PATH)) {
    return SAVE_PATH;
  }
  return path.join(PROJECTS_DIR, `${projectName}_save.json`);
}

/**
 * Отримує дані збереження гри (ферма, інвентар, замовлення) для вказаного проекту.
 * Спочатку перевіряє швидку базу даних SQLite (0.1 мс).
 * Якщо запису немає в SQLite, перевіряє файли на диску та автоматично мігрує в SQLite.
 */
export async function getProjectSaveData(projectName: string): Promise<any | null> {
  // 1. Спроба завантажити зі швидкого сховища SQLite
  try {
    const dbData = getDbProjectSave(projectName);
    if (dbData !== null && dbData !== undefined) {
      return dbData;
    }
  } catch (err) {
    logger.warn(`Failed to read save from SQLite for project ${projectName}`, { error: String(err) });
  }

  // 2. Fallback: читання з диска при першому зверненні
  const filePath = getSaveFilePath(projectName);
  try {
    if (fs.existsSync(filePath)) {
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      // Авто-міграція в SQLite для миттєвого наступного доступу
      try {
        saveDbProjectSave(projectName, parsed);
      } catch (saveDbErr) {
        logger.warn(`Failed to cache disk save to SQLite for ${projectName}`, { error: String(saveDbErr) });
      }
      return parsed;
    }
  } catch (diskErr) {
    logger.error(`Failed to read fallback save file for ${projectName}`, diskErr instanceof Error ? diskErr : new Error(String(diskErr)));
  }

  return null;
}

/**
 * Зберігає дані гри проекту в SQLite та асинхронно оновлює резервну копію на диску.
 */
export async function saveProjectSaveData(projectName: string, data: any): Promise<void> {
  // 1. Миттєво зберігаємо в SQLite (надійно з WAL-журналом)
  try {
    saveDbProjectSave(projectName, data);
  } catch (dbErr) {
    logger.error(`Failed to save project save to SQLite for ${projectName}`, dbErr instanceof Error ? dbErr : new Error(String(dbErr)));
    throw dbErr;
  }

  // 2. Фоновий неблокуючий запис резервного файлу на диск
  setImmediate(async () => {
    try {
      const filePath = getSaveFilePath(projectName);
      await writeJsonAtomic(filePath, data);
    } catch (diskErr) {
      logger.debug(`Background disk save backup failed for ${projectName}`, { error: String(diskErr) });
    }
  });
}

/**
 * Зручний хелпер для нод крафту: повертає інвентар ферми без необхідності ручного парсингу.
 */
export async function getProjectInventory(projectName: string): Promise<Record<string, unknown>> {
  const saveData = await getProjectSaveData(projectName);
  if (!saveData || typeof saveData !== 'object') {
    return {};
  }
  const visitorFarmState = saveData.visitorFarmState as Record<string, unknown> | undefined;
  const visitedFarmState = saveData.visitedFarmState as Record<string, unknown> | undefined;
  return (
    (visitorFarmState?.inventory as Record<string, unknown>) ||
    (visitedFarmState?.inventory as Record<string, unknown>) ||
    (saveData.inventory as Record<string, unknown>) ||
    {}
  );
}
