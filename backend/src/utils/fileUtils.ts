import fs from 'fs';
import path from 'path';

/**
 * Utility for atomic JSON file writes and safe reads.
 * Protects against corrupted files on sudden power loss or process crashes,
 * and handles Windows filesystem lock issues (EPERM / EBUSY).
 */

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Safely writes JSON data to a file atomically by writing to a temporary file
 * and then renaming it. Includes retry logic for Windows file lock collisions.
 *
 * @param filePath Target file path
 * @param data Data object to stringify and write
 * @param spaces JSON formatting indentation (default 2)
 */
export async function writeJsonAtomic(filePath: string, data: any, spaces: number = 2): Promise<void> {
  const dir = path.dirname(filePath);
  const tempPath = path.join(
    dir,
    `.${path.basename(filePath)}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`
  );

  const serialized = JSON.stringify(data, null, spaces);

  try {
    await fs.promises.writeFile(tempPath, serialized, 'utf-8');

    // Attempt atomic rename with retry for Windows EPERM/EBUSY file locks
    let renamed = false;
    let lastError: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await fs.promises.rename(tempPath, filePath);
        renamed = true;
        break;
      } catch (err: any) {
        lastError = err;
        if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') {
          await sleep(20 * (attempt + 1));
        } else {
          throw err;
        }
      }
    }

    // Fallback if rename fails due to persistent Windows locking
    if (!renamed) {
      try {
        await fs.promises.copyFile(tempPath, filePath);
        await fs.promises.unlink(tempPath).catch(() => {});
      } catch (fallbackErr) {
        throw lastError || fallbackErr;
      }
    }
  } catch (err) {
    // Clean up temporary file if write or rename failed
    try {
      await fs.promises.unlink(tempPath).catch(() => {});
    } catch {}
    throw err;
  }
}

/**
 * Safely reads and parses a JSON file. If the file does not exist or JSON parsing fails,
 * returns the provided default value without throwing.
 *
 * @param filePath Target file path
 * @param defaultValue Fallback value if reading or parsing fails
 */
export async function readJsonSafe<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}
