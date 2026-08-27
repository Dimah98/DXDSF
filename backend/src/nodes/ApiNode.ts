import { Logger } from '../logger';
import { NodeHandlerParams } from './types';
import { inputValidator } from '../validation/InputValidator';
import { sessions } from '../browserManager';
import { PROJECTS_DIR } from '../constants';
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
    const inventoryFilePath = path.join(PROJECTS_DIR, `${projectName}_save.json`); // Шлях до збереженого файлу проекту
    try {
      await fs.promises.mkdir(PROJECTS_DIR, { recursive: true }); // Створюємо папку проектів якщо вона не існує
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
    logToClient(`🕵️ API (перехоплення): Шукаємо збережені дані авторизації у браузері...`, 'info');

    try {
      const session = sessions.get(projectName);
      if (!session) {
        logToClient(`❌ Сесія браузера не знайдена. Перевірте чи відкритий браузер для цього проекту.`, 'error');
        return { data: { ...context, error: 'No browser session' }, nextHandle: ['error'] };
      }

      // Допоміжна функція вилучення токена та Farm ID зі сховища сторінки
      const extractFromPage = async (page: any): Promise<{ token?: string | null; farmId?: string | null } | null> => {
        try {
          if (!page || page.isClosed()) return null;
          return await page.evaluate(() => {
            const jwtRegex = /eyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]+/;
            let foundToken: string | null = null;
            let foundFarmId: string | null = null;

            // 1. Пошук у localStorage
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;
                const val = localStorage.getItem(key);
                if (!val) continue;

                if (!foundToken) {
                  const m = val.match(jwtRegex);
                  if (m) foundToken = m[0];
                }
                if (key.toLowerCase().includes('farmid') && !foundFarmId) {
                  const numMatch = val.match(/\d+/);
                  if (numMatch) foundFarmId = numMatch[0];
                }
              }
            } catch (_) {}

            // 2. Пошук у sessionStorage
            if (!foundToken) {
              try {
                for (let i = 0; i < sessionStorage.length; i++) {
                  const key = sessionStorage.key(i);
                  if (!key) continue;
                  const val = sessionStorage.getItem(key);
                  if (!val) continue;

                  const m = val.match(jwtRegex);
                  if (m) { foundToken = m[0]; break; }
                }
              } catch (_) {}
            }

            // 3. Пошук у cookie
            if (!foundToken) {
              try {
                const m = document.cookie.match(jwtRegex);
                if (m) foundToken = m[0];
              } catch (_) {}
            }

            // 4. Пошук Farm ID в URL адресі
            try {
              const urlM = window.location.href.match(/(?:visit|farm|world)\/(\d+)/i) || window.location.href.match(/\b(\d{5,})\b/);
              if (urlM && !foundFarmId) foundFarmId = urlM[1];
            } catch (_) {}

            return { token: foundToken, farmId: foundFarmId };
          });
        } catch (_) {
          return null;
        }
      };

      const parseJwtFarmId = (jwtToken: string): string | null => {
        try {
          const parts = jwtToken.split('.');
          if (parts.length >= 2) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            const extracted = payload.farmId || payload.sub || payload.user?.farmId || payload.userId || payload.id;
            if (extracted) return String(extracted);
          }
        } catch (_) {}
        return null;
      };

      let farmId = session.latestFarmId;
      let token = session.latestApiToken;

      // Спроба отримати зі сховища активної сторінки
      if (!farmId || !token) {
        const storageData = await extractFromPage(session.page);
        if (storageData?.token && !token) {
          token = storageData.token;
          session.latestApiToken = token;
        }
        if (token && !farmId) {
          farmId = parseJwtFarmId(token);
          if (farmId) session.latestFarmId = farmId;
        }
        if (storageData?.farmId && !farmId) {
          farmId = storageData.farmId;
          session.latestFarmId = farmId;
        }
      }

      // Retry-логіка: очікуємо до 10 секунд (перевіряємо мережу та сторінку кожні 500мс)
      if (!farmId || !token) {
        logToClient(`⏳ Очікуємо перехоплення даних з браузера (до 10 сек)...`, 'info');
        for (let i = 0; i < 20; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          farmId = session.latestFarmId;
          token = session.latestApiToken;

          if (token && !farmId) {
            farmId = parseJwtFarmId(token);
            if (farmId) session.latestFarmId = farmId;
          }

          if ((!farmId || !token) && session.context) {
            const pages = session.context.pages();
            for (const p of pages) {
              const storageData = await extractFromPage(p);
              if (storageData?.token && !token) {
                token = storageData.token;
                session.latestApiToken = token;
              }
              if (token && !farmId) {
                farmId = parseJwtFarmId(token);
                if (farmId) session.latestFarmId = farmId;
              }
              if (storageData?.farmId && !farmId) {
                farmId = storageData.farmId;
                session.latestFarmId = farmId;
              }
              if (farmId && token) break;
            }
          }

          if (farmId && token) break;
        }
      }

      // Якщо перехопити наживо не вдалося, перевіряємо збережені дані у властивостях ноди
      if (!token && currentNode.data.apiKey && typeof currentNode.data.apiKey === 'string') {
        token = currentNode.data.apiKey;
        logToClient(`ℹ️ Використовуємо збережений Bearer токен ноди`, 'info');
      }
      if (!farmId && token) {
        farmId = parseJwtFarmId(token);
      }
      if (!farmId && currentNode.data.farmId) {
        farmId = String(currentNode.data.farmId);
        logToClient(`ℹ️ Використовуємо збережений Farm ID ноди: ${farmId}`, 'info');
      }

      if (!farmId || !token) {
        logToClient(`❌ Дані не перехоплені браузером. Переконайтеся, що гра Sunflower Land завантажена у браузері (перезавантажте F5 або увійдіть у гру).`, 'error');
        return { data: { ...context, error: 'No intercepted data after retry' }, nextHandle: ['error'] };
      }

      logToClient(`✅ Авторизаційні дані знайдено! Farm ID: ${farmId}`, 'success');

      // Виконуємо запит до API
      let visitJson: any = null;
      let clockOffset = 0;
      const visitUrl = `https://api.sunflower-land.com/visit/${farmId}`;
      logToClient(`🌐 Запит до: ${visitUrl}`, 'debug');

      let visitRes = await fetch(visitUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Якщо /visit повернув помилку, пробуємо альтернативні ендпоінти
      if (!visitRes.ok) {
        const altUrl = `https://api.sunflower-land.com/community/farms/${farmId}`;
        logToClient(`⚠️ /visit повернув ${visitRes.status}. Пробуємо ${altUrl}...`, 'debug');
        const altRes = await fetch(altUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (altRes.ok) {
          visitRes = altRes;
        }
      }

      if (visitRes.ok) {
        visitJson = await visitRes.json();

        // Розраховуємо зміщення годинника
        const dateHeader = visitRes.headers.get('date');
        if (dateHeader) {
          const serverTime = new Date(dateHeader).getTime();
          if (!isNaN(serverTime)) clockOffset = Date.now() - serverTime;
        }

        logToClient(`✅ Дані ферми успішно отримано через перехоплення!`, 'success');
      } else {
        const errBody = await visitRes.text().catch(() => '');
        const errMsg = `HTTP ${visitRes.status} ${visitRes.statusText}${errBody ? `: ${errBody.substring(0, 100)}` : ''}`;
        logToClient(`❌ API помилка при запиті: ${errMsg}`, 'error');
        return { data: { ...context, error: errMsg }, nextHandle: ['error'] };
      }

      // Оновлюємо UI ноди знайденими даними
      try {
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
      } catch (_) {}

      // Зберігаємо отримані дані у файл інвентарю проекту за потреби
      const safeProjectName = session.projectName || projectName;
      await saveResponseToProject(safeProjectName, visitJson, Boolean(currentNode.data.saveToProject), logToClient);

      return {
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
      logToClient(`❌ Помилка перехоплення: ${errorMessage}`, 'error');
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
