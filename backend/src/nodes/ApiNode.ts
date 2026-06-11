import { Logger } from '../logger';
import { NodeHandlerParams } from './types';
import { inputValidator } from '../validation/InputValidator';
import { sessions } from '../browserManager';

const logger = new Logger('ApiNode');

export const apiNodeHandler = async ({ currentNode, ws, logToClient, context, projectName }: NodeHandlerParams) => {
  const { mode } = currentNode.data;

  // ─── Режим перехоплення мережі ───────────────────────────────────────────────
  if (mode === 'intercept') {
    logToClient(`🕵️ API (перехоплення): Шукаємо збережені дані у фоні...`, 'info');

    try {
      const session = sessions.get(projectName);
      if (!session) {
        logToClient(`❌ Сесія браузера не знайдена. Перевірте чи запущений браузер.`, 'error');
        return { data: { ...context, error: 'No browser session' }, nextHandle: ['error'] };
      }

      const farmId = session.latestFarmId;
      const token = session.latestApiToken;

      if (!farmId || !token) {
        logToClient(`⏳ Дані ще не перехоплені браузером. Перезапустіть сторінку ферми (F5) щоб вони з'явилися.`, 'error');
        return { data: { ...context, error: 'No intercepted data yet' }, nextHandle: ['error'] };
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

      return {
        data: {
          ...context,
          raw: visitJson,
          value: visitJson,
          farmId,
          apiKey: token,
          __clockOffset: clockOffset
        }
      };

    } catch (err: any) {
      logger.error(`ApiNode intercept error`, err instanceof Error ? err : new Error(String(err)));
      logToClient(`❌ Перехоплення: ${err.message}`, 'error');
      return { data: { ...context, error: err.message }, nextHandle: ['error'] };
    }
  }

  // ─── Стандартний режим ручного вводу ─────────────────────────────────────────
  const { url, apiKey } = currentNode.data;

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
      
      return { data: { ...context, raw: json, value: json } };
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

  if (apiKey) {
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

    logToClient(`✅ API відповідь отримана`, 'success');
    return { data: { ...context, raw: json, value: json, __clockOffset: clockOffset } };
  } catch (err: any) {
    logger.error(`API request error`, err instanceof Error ? err : new Error(String(err)), { url });
    logToClient(`❌ API помилка: ${err.message || String(err)}`, 'error');
    return { data: { ...context, error: err.message }, nextHandle: ['error'] };
  }
};
