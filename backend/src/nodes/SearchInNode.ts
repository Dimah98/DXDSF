import { Logger } from '../logger';
import { NodeHandlerParams } from './types';

const logger = new Logger('SearchInNode');

export const searchInNodeHandler = async ({ currentNode, activePage, nodeTitle, takeDebugSnapshot, ws, logToClient, context }: NodeHandlerParams) => {
  const { selector, imageName } = currentNode.data;
  if (!selector || !imageName) throw new Error('Вкажіть селектор та назву картинки');
  
  const fileName = imageName;
  
  // Requirement 13.1: Wrap async operations in try-catch with logging
  let result: any = null;
  try {
    result = await activePage.evaluate(({ sel, imgName }: any) => {
       // Шукаємо всі елементи, що підходять під селектор
       const elements = Array.from(document.querySelectorAll(sel));
       
       for (const el of elements) {
          // Перевіряємо чи є всередині потрібна картинка (або якщо сам елемент і є картинка)
          const img = (el.tagName === 'IMG' && el.getAttribute('src')?.includes(imgName)) 
            ? el 
            : el.querySelector(`img[src*="${imgName}"]`);

          if (img) {
             const r = img.getBoundingClientRect();
             
             // Фільтр: елемент повинен мати розміри та бути в межах видимого екрана
             // Додаємо невеликий запас (100px), щоб не чіпляти "сміттєві" об'єкти за межами
             if (r.width > 0 && r.height > 0 && r.left >= -50 && r.top >= -50 && r.left < window.innerWidth && r.top < window.innerHeight) {
                return { 
                  x: Math.round(r.left + window.scrollX + r.width / 2), 
                  y: Math.round(r.top + window.scrollY + r.height / 2) 
                };
             }
          }
       }
       return null;
    }, { sel: selector, imgName: fileName });
  } catch (err: any) {
    // Requirement 13.1: Log the error
    logger.error(`SearchIn evaluate failed for node ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)), { selector, imageName });
    logToClient(`❌ Помилка пошуку: ${err.message || String(err)}`, 'error');
    // Requirement 13.5: Continue execution through error handle path
    try {
      ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { status: 'Помилка' } }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DATA_UPDATE for node ${currentNode.id}`, { error: String(sendErr) });
    }
    return { nextHandle: 'not_found', data: context };
  }

  if (result) {
    await takeDebugSnapshot(currentNode.id, nodeTitle, { x: result.x, y: result.y });
    logToClient(`✅ Знайдено в ${selector}: (${result.x}, ${result.y})`, 'success');
    // Requirement 13.2: Wrap ws.send in try-catch
    try {
      ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { status: 'Знайдено', lastCoords: `X:${result.x}, Y:${result.y}` } }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DATA_UPDATE for node ${currentNode.id}`, { error: String(sendErr) });
    }
    return { nextHandle: 'found', data: { ...context, coords: result } };
  } else {
    logToClient(`❌ Не знайдено в ${selector}`, 'error');
    try {
      ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { status: 'Немає' } }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DATA_UPDATE for node ${currentNode.id}`, { error: String(sendErr) });
    }
    return { nextHandle: 'not_found', data: context };
  }
};
