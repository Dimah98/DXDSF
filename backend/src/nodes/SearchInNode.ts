import { Logger } from '../logger';
import { NodeHandlerParams } from './types';

const logger = new Logger('SearchInNode');

export const searchInNodeHandler = async ({ currentNode, activePage, nodeTitle, takeDebugSnapshot, ws, logToClient, context }: NodeHandlerParams) => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const selector = (nodeData.selector as string) || '';
  const imageName = (nodeData.imageName as string) || '';
  if (!selector || !imageName) throw new Error('Вкажіть селектор та назву картинки');
  
  const fileName = imageName;
  
  // Requirement 13.1: Wrap async operations in try-catch with logging
  let result: { x: number, y: number } | null = null;
  try {
    result = await activePage.evaluate(
      `((args) => {
        const { sel, imgName } = args;
        function findElements(s) {
          try {
            return Array.from(document.querySelectorAll(s));
          } catch (e) {
            const hasTextMatch = s.match(/^(.+?):has-text\\((['"]?)(.*?)\\2\\)$/i);
            if (hasTextMatch) {
              const baseSel = hasTextMatch[1].trim() || '*';
              const searchText = hasTextMatch[3];
              const candidates = Array.from(document.querySelectorAll(baseSel));
              return candidates.filter(el => el.textContent && el.textContent.includes(searchText));
            }
            const textMatch = s.match(/^text=(['"]?)(.*?)\\1$/i) || s.match(/^:text\\((['"]?)(.*?)\\1\\)$/i);
            if (textMatch) {
              const searchText = textMatch[2].trim();
              const candidates = Array.from(document.querySelectorAll('*'));
              return candidates.filter(el => el.textContent && el.textContent.trim() === searchText);
            }
            if (s.startsWith('//') || s.startsWith('(//')) {
              const results = [];
              const query = document.evaluate(s, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
              for (let i = 0; i < query.snapshotLength; i++) {
                const node = query.snapshotItem(i);
                if (node instanceof Element) results.push(node);
              }
              return results;
            }
            return [];
          }
        }

        // Шукаємо всі елементи, що підходять під селектор
        const elements = findElements(sel);
        
        for (const el of elements) {
          // Перевіряємо чи є всередині потрібна картинка (або якщо сам елемент і є картинка)
          const img = (el.tagName === 'IMG' && el.getAttribute('src')?.includes(imgName)) 
            ? el 
            : el.querySelector('img[src*="' + imgName + '"]');

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
      })(${JSON.stringify({ sel: selector, imgName: fileName })})`
    ) as { x: number; y: number } | null;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    // Requirement 13.1: Log the error
    logger.error(`SearchIn evaluate failed for node ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)), { selector, imageName });
    logToClient(`❌ Помилка пошуку: ${errorMessage}`, 'error');
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
