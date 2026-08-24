import { Logger } from '../logger';
import { NodeHandlerParams } from './types';
import { inputValidator } from '../validation/InputValidator';
import { sessions } from '../browserManager';
import * as fs from 'fs'; // Імпортуємо модуль файлової системи для збереження файлів
import * as path from 'path'; // Імпортуємо модуль path для роботи зі шляхами файлів

const logger = new Logger('ApiNode');

// Функція для збереження відповіді API у файл інвентарю проекту
const saveResponseToProject = async (
  projectName: string,
  responseJson: unknown,
  saveToProject: boolean,
  logToClient: (msg: string, type?: 'info' | 'success' | 'error' | 'debug') => void
) => {
  if (saveToProject && responseJson) { // Перевіряємо чи увімкнено опцію та чи є дані для збереження
    const projectsDir = path.join(__dirname, '../../projects'); // Шлях до папки з проектами
    const inventoryFilePath = path.join(projectsDir, `${projectName}_save.json`); // Шлях до збереженого файлу проекту
    try {
      await fs.promises.mkdir(projectsDir, { recursive: true }); // Створюємо папку проектів якщо вона не існує
      await fs.promises.writeFile(inventoryFilePath, JSON.stringify(responseJson, null, 2), 'utf-8'); // Записуємо JSON дані у файл
      logToClient(`💾 JSON збережено в проект: ${projectName}_save.json`, 'success'); // Повідомляємо клієнта про успішне збереження та назву файлу
      logger.info(`Saved API response JSON to project`, { projectName, path: inventoryFilePath }); // Логуємо подію в бекенді
    } catch (saveErr) { // Перехоплюємо помилки запису
      logger.error(`Failed to save API response to inventory file`, saveErr instanceof Error ? saveErr : new Error(String(saveErr))); // Логуємо помилку
      logToClient(`⚠️ Не вдалося зберегти JSON в проект`, 'error'); // Виводимо помилку в консоль клієнта
    } // Кінець блоку спроби
  } // Кінець перевірки
};

export const apiNodeHandler = async ({ currentNode, ws, logToClient, context, projectName }: NodeHandlerParams) => {
  const { mode } = currentNode.data as Record<string, unknown>;

  // ─── Режим перехоплення мережі ───────────────────────────────────────────────
  if (mode === 'intercept') {
    logToClient(`🕵️ API (перехоплення): Шукаємо збережені дані у фоні...`, 'info');

    try {
      const session = sessions.get(projectName);
      if (!session) {
        logToClient(`❌ Сесія браузера не знайдена. Перевірте чи запущений браузер.`, 'error');
        return { data: { ...context, error: 'No browser session' }, nextHandle: ['error'] };
      }

      // Retry-логіка: чекаємо до 10 секунд поки браузер перехопить дані
      let farmId = session.latestFarmId;
      let token = session.latestApiToken;

      if (!farmId || !token) {
        logToClient(`⏳ Дані ще не перехоплені, чекаємо до 10 секунд...`, 'info');
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          farmId = session.latestFarmId;
          token = session.latestApiToken;
          if (farmId && token) break;
        }
      }

      if (!farmId || !token) {
        logToClient(`❌ Дані не перехоплені браузером після 10 секунд очікування. Перезавантажте сторінку ферми (F5).`, 'error');
        return { data: { ...context, error: 'No intercepted data after retry' }, nextHandle: ['error'] };
      }

      logToClient(`✅ Знайдено фонові дані! Farm ID: ${farmId}`, 'success');

      // Робимо реальний запит до /visit/{farmId} з перехопленим токеном
      let visitJson: any = null;
      let clockOffset = 0;

      const visitUrl = `https://api.sunflower-land.com/visit/${farmId}`;
      logToClient(`🌐 Запит до: ${visitUrl}`, 'debug');

      const visitRes = await fetch(visitUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (visitRes.ok) {
        visitJson = await visitRes.json();

        // Розраховуємо зміщення годинника
        const dateHeader = visitRes.headers.get('date');
        if (dateHeader) {
          const serverTime = new Date(dateHeader).getTime();
          if (!isNaN(serverTime)) clockOffset = Date.now() - serverTime;
        }

        logToClient(`✅ Дані ферми отримано!`, 'success');
      } else {
        const errMsg = `HTTP ${visitRes.status} ${visitRes.statusText}`;
        logToClient(`❌ API помилка при запиті /visit: ${errMsg}`, 'error');
        return { data: { ...context, error: errMsg }, nextHandle: ['error'] };
      }

      // Оновлюємо UI ноди знайденими даними
      ws.send(JSON.stringify({
        type: 'NODE_DATA_UPDATE',
        nodeId: currentNode.id,
        data: {
          farmId: farmId,
          apiKey: token,
          url: visitUrl,
          lastResponse: visitJson
        }
      }));

      // Зберігаємо отримані дані у файл інвентарю проекту за потреби
      // Використовуємо session.projectName як надійне джерело імені проекту
      const safeProjectName = session.projectName || projectName;
      if (safeProjectName !== projectName) {
        logToClient(`⚠️ Попередження: projectName (${projectName}) не збігається з session (${safeProjectName}). Використовуємо session.`, 'debug');
      }
      await saveResponseToProject(safeProjectName, visitJson, Boolean(currentNode.data.saveToProject), logToClient);

      return {
        // Явно передаємо сигнал тільки на зелений вихід (success) при успішному перехопленні
        nextHandle: ['success'],
        data: {
          ...context,
          raw: visitJson,
          value: visitJson,
          farmId,
          apiKey: token,
          __clockOffset: clockOffset
        }
      };

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`ApiNode intercept error`, err instanceof Error ? err : new Error(String(err)));
      logToClient(`❌ Перехоплення: ${errorMessage}`, 'error');
      return { data: { ...context, error: errorMessage }, nextHandle: ['error'] };
    }
  }

  // ─── Стандартний режим ручного вводу ─────────────────────────────────────────
  const { url, apiKey } = currentNode.data as Record<string, unknown>;

  if (!url || typeof url !== 'string') {
    logToClient(`❌ API помилка: URL не вказано або невалідний`, 'error');
    return { data: { ...context, error: 'Invalid URL' }, nextHandle: ['error'] };
  }

  // ─── Internal:// protocol support ─────────────────────────────────────────────
  // Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
  if (url.startsWith('internal://')) {
    const internalPath = url.replace('internal://', '');
    
    // Map internal paths to local endpoints
    const internalRoutes: Record<string, string> = {
      'config': `http://localhost:${process.env.HTTP_PORT || '3001'}/api/config`
    };
    
    const actualUrl = internalRoutes[internalPath];
    
    if (!actualUrl) {
      logToClient(`❌ Невідомий внутрішній шлях: ${internalPath}`, 'error');
      return { data: { ...context, error: `Unknown internal path: ${internalPath}` }, nextHandle: ['error'] };
    }
    
    logToClient(`🔗 Внутрішній API: ${internalPath} → ${actualUrl}`, 'info');
    
    // Make local GET request (no auth needed for internal://config)
    try {
      const res = await fetch(actualUrl);
      
      if (!res.ok) {
        const errMsg = `HTTP ${res.status} ${res.statusText}`;
        logToClient(`❌ Помилка внутрішнього API: ${errMsg}`, 'error');
        return { data: { ...context, error: errMsg }, nextHandle: ['error'] };
      }
      
      const json = await res.json();
      logToClient(`✅ Відповідь внутрішнього API отримана`, 'success');
      
      // Update UI node with response
      try {
        ws.send(JSON.stringify({ 
          type: 'NODE_DATA_UPDATE', 
          nodeId: currentNode.id, 
          data: { lastResponse: json } 
        }));
      } catch (sendErr) {
        logger.warn(`Failed to send NODE_DATA_UPDATE for internal API`, { error: String(sendErr) });
      }
      
      // Зберігаємо отримані дані у файл інвентарю проекту за потреби
      await saveResponseToProject(projectName, json, Boolean(currentNode.data.saveToProject), logToClient);

      // Явно вказуємо перехід по зеленому виходу (success) при успішному внутрішньому запиті
      return { nextHandle: ['success'], data: { ...context, raw: json, value: json } };
    } catch (err: any) {
      logger.error('Internal API request error', err instanceof Error ? err : new Error(String(err)), { url });
      logToClient(`❌ Помилка внутрішнього API: ${err.message}`, 'error');
      return { data: { ...context, error: err.message }, nextHandle: ['error'] };
    }
  }

  // ─── External API mode (original logic) ───────────────────────────────────────
  const urlValidation = inputValidator.validateURL(url);
  if (!urlValidation.isValid) {
    logToClient(`❌ API помилка: ${urlValidation.error}`, 'error');
    return { data: { ...context, error: urlValidation.error }, nextHandle: ['error'] };
  }

  const headers: Record<string, string> = {};
  logToClient(`🌐 API запит: ${url}`, 'debug');

  if (apiKey && typeof apiKey === 'string') {
    if (apiKey.startsWith('eyJ')) headers['Authorization'] = `Bearer ${apiKey}`;
    else headers['x-api-key'] = apiKey;
  }

  try {
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const errMsg = `HTTP ${res.status} ${res.statusText}`;
      logToClient(`❌ API помилка: ${errMsg}`, 'error');
      return { data: { ...context, error: errMsg }, nextHandle: ['error'] };
    }

    const json = await res.json();

    let clockOffset = 0;
    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const serverTime = new Date(dateHeader).getTime();
      if (!isNaN(serverTime)) {
        clockOffset = Date.now() - serverTime;
      }
    }

    try {
      ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { lastResponse: json } }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DATA_UPDATE`, { error: String(sendErr) });
    }

    // Зберігаємо отримані дані у файл інвентарю проекту за потреби
    await saveResponseToProject(projectName, json, Boolean(currentNode.data.saveToProject), logToClient);

    logToClient(`✅ API відповідь отримана`, 'success');
    // Явно вказуємо перехід по зеленому виходу (success) при успішному зовнішньому запиті
    return { nextHandle: ['success'], data: { ...context, raw: json, value: json, __clockOffset: clockOffset } };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`API request error`, err instanceof Error ? err : new Error(String(err)), { url });
    logToClient(`❌ API помилка: ${errorMessage || String(err)}`, 'error');
    return { data: { ...context, error: errorMessage }, nextHandle: ['error'] };
  }
};
