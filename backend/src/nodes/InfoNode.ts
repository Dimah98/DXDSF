import { Logger } from '../logger';
import { NodeHandlerParams } from './types';
import { inputValidator } from '../validation/InputValidator';

const logger = new Logger('InfoNode');

export const infoNodeHandler = async ({
  currentNode,
  activePage,
  ws,
  globalVariables,
  broadcastVariables,
  context,
  logToClient
}: NodeHandlerParams) => {
  let nodeResults: Record<string, unknown> = { data: context };
  const nodeData = currentNode.data as Record<string, unknown>;
  const { selector, variablePrefix = 'scanned' } = nodeData;

  try {
    // Requirement 4: Validate CSS selector before Playwright operations
    if (!selector || typeof selector !== 'string') {
      logger.warn(`Info node ${currentNode.id}: missing or invalid selector`, { selector });
      logToClient(`❌ Сканер: Селектор не вказано або невалідний`, 'error');
      return { data: context, nextHandle: ['error'] };
    }
    
    const selectorValidation = inputValidator.validateSelector(selector);
    if (!selectorValidation.isValid) {
      logger.warn(`Info node ${currentNode.id}: selector validation failed`, { selector, error: selectorValidation.error });
      logToClient(`❌ Невалідний селектор: ${selectorValidation.error}`, 'error');
      return { data: context, nextHandle: ['error'] };
    }
    
    // Чекаємо на появу елемента з швидким таймаутом (за замовчуванням 2000мс або з налаштувань ноди)
    const scanTimeout = typeof nodeData.timeout === 'number' && nodeData.timeout > 0 
      ? Number(nodeData.timeout) 
      : (typeof nodeData.timeout === 'string' && !isNaN(parseFloat(nodeData.timeout)) ? parseFloat(nodeData.timeout) : 2000);

    // Шукаємо елемент у всіх фреймах сторінки (включаючи iframes)
    let elementHandle: any = null;
    const frames = activePage.frames();
    const perFrameTimeout = Math.max(500, Math.floor(scanTimeout / (frames.length || 1)));

    for (const frame of frames) {
      try {
        const handle = await frame.locator(selector).first().elementHandle({ timeout: perFrameTimeout });
        if (handle) {
          elementHandle = handle;
          break;
        }
      } catch (e) {
        /* елемент недоступний в цьому фреймі */
      }
    }

    if (!elementHandle) {
       logToClient(`❌ Сканер: Елемент не знайдено (${selector})`, 'error');
       if (ws && typeof ws.send === 'function' && (ws.readyState === undefined || ws.readyState === 1)) {
         try {
           ws.send(JSON.stringify({ 
             type: 'NODE_DATA_UPDATE', 
             nodeId: currentNode.id, 
             data: { lastText: 'Не знайдено' } 
           }));
         } catch {}
       }
       return { nextHandle: 'fail', data: context }; // Передаємо сигнал на порт помилки
    }

    const box = await elementHandle.boundingBox();
    const text = await elementHandle.textContent();
    // Витягуємо число з тексту — підтримуємо дробові (3.5, 0.75) та цілі числа
    const numMatch = text?.match(/\d+(\.\d+)?/)?.[0];
    const num = numMatch ? parseFloat(numMatch) : 0;
    
    // Отримуємо детальну інформацію про знайдений елемент
    const info = await elementHandle.evaluate((e: Element) => {
        const imageNames = Array.from(e.querySelectorAll('img')).map(img => {
           const parts = img.src.split('/');
           return parts[parts.length - 1].split('?')[0];
        }).filter(n => n && !n.startsWith('data:'));

        const childrenNames = Array.from(e.children).map(c => ({
           name: c.textContent?.trim().substring(0, 15) || c.tagName.toLowerCase(),
           selector: c.tagName.toLowerCase() + (c.id ? '#' + c.id : '') + (c.className && typeof c.className === 'string' ? '.' + c.className.split(' ')[0] : '')
        })).filter(i => i.name);

        return {
           children: e.children.length,
           images: e.querySelectorAll('img').length,
           imageNames,
           childrenNames
        };
    });

    const coords = box ? { x: Math.round(box.x + box.width/2), y: Math.round(box.y + box.height/2) } : { x: 0, y: 0 };
    
    globalVariables[`${variablePrefix}_text`] = text || "";
    globalVariables[`${variablePrefix}_num`] = num;
    
    nodeResults = {
       nextHandle: ['next', 'coords', 'text', 'num', 'children', 'images'],
       data: {
         ...context,
         coords,
         text: text || "",
         num,
         children: info?.children || 0,
         images: info?.images || 0,
         imageNames: info?.imageNames || [],
         childrenNames: info?.childrenNames || [],
         value: text || num
       }
    };

    if (typeof broadcastVariables === 'function') {
      try { broadcastVariables(); } catch {}
    }
    
    if (ws && typeof ws.send === 'function' && (ws.readyState === undefined || ws.readyState === 1)) {
      try {
        ws.send(JSON.stringify({ 
           type: 'NODE_DATA_UPDATE', 
           nodeId: currentNode.id, 
           data: { 
              lastCoords: `X:${coords.x}, Y:${coords.y}`,
              lastText: text?.substring(0, 15),
              lastNum: num,
              lastChildrenCount: info?.children,
              lastImagesCount: info?.images,
              imageNames: info?.imageNames || [],
              childrenNames: info?.childrenNames || []
           } 
        }));
      } catch {}
    }
  } catch (e: any) { 
    logger.error(`InfoNode scan error for node ${currentNode.id}`, e instanceof Error ? e : new Error(String(e)));
    logToClient(`❌ Сканер помилка: ${e.message}`, 'error');
    return { nextHandle: 'fail', data: context };
  }
  return nodeResults;
};
