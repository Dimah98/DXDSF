import { Logger } from '../logger';
import { NodeHandlerParams } from './types';

const logger = new Logger('VisualSearchNode');

export const visualSearchNodeHandler = async ({
  currentNode,
  activePage,
  ws,
  nodeTitle,
  takeDebugSnapshot,
  logToClient,
  context
}: NodeHandlerParams) => {
  let nodeResults: Record<string, unknown> = { data: context };
  const nodeData = currentNode.data as Record<string, unknown>;
  const imageName = (nodeData.imageName as string) || '';
  const selector = nodeData.selector as string | undefined;
  const searchMode = (nodeData.searchMode as string) || 'first';
  
  logger.info(`VisualSearchNode: imageName="${imageName}", selector="${selector}", searchMode="${searchMode}"`);
  
  if (!imageName) throw new Error('Назва картинки не вказана');
  
  // Розбиваємо на список назв (кожна з нового рядка)
  const imageNames = imageName.split('\n').map((n: string) => n.trim()).filter(Boolean);
  logger.info(`VisualSearchNode: imageNames=${JSON.stringify(imageNames)}`);
  if (imageNames.length === 0) throw new Error('Назва картинки не вказана');

  let domResults: { x: number, y: number }[] = [];
  let foundName = '';

  // Requirement 13.1: Wrap async operations in try-catch with logging
  try {
    // Виконуємо оптимізований пошук у DOM браузера через IIFE строковий скрипт
    const searchResult = await activePage.evaluate(
      `((args) => {
        const { names, selector, searchMode } = args;
        const roots = selector 
          ? (searchMode === 'all' 
              ? Array.from(document.querySelectorAll(selector)) 
              : [document.querySelector(selector)].filter(Boolean)) 
          : [document];
        
        if (roots.length === 0) return { foundName: '', items: [] };

        const scrollX = window.scrollX || window.pageXOffset || 0;
        const scrollY = window.scrollY || window.pageYOffset || 0;

        for (const name of names) {
          const foundCoords = [];
          const seen = new Set();

          function addCoord(el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              const x = Math.round(rect.left + scrollX + rect.width / 2);
              const y = Math.round(rect.top + scrollY + rect.height / 2);
              const key = x + ',' + y;
              if (!seen.has(key)) {
                seen.add(key);
                foundCoords.push({ x, y });
              }
            }
          }

          for (const root of roots) {
            if (!root) continue;
            // 1. Пряма перевірка чи сам root є шуканим <img>
            if (root.tagName === 'IMG' && root.src && root.src.includes(name)) {
              addCoord(root.parentElement || root);
            }

            // 2. Цільовий пошук усіх <img> нащадків за CSS селектором
            const matchedImgs = root.querySelectorAll('img[src*="' + name + '"]');
            for (let i = 0; i < matchedImgs.length; i++) {
              const img = matchedImgs[i];
              addCoord(img.parentElement || img);
            }

            // 3. Цільовий пошук елементів з inline style background
            const matchedStyles = root.querySelectorAll('[style*="' + name + '"]');
            for (let i = 0; i < matchedStyles.length; i++) {
              addCoord(matchedStyles[i]);
            }

            // 4. Якщо нічого не знайдено, швидка перевірка елементів з background-image
            if (foundCoords.length === 0) {
              const bgCandidates = root.querySelectorAll('[class*="image"], [class*="icon"], [class*="sprite"], [class*="crop"], [class*="item"], [class*="inventory"], [class*="tile"], [data-image]');
              for (let i = 0; i < bgCandidates.length; i++) {
                const el = bgCandidates[i];
                const bg = window.getComputedStyle(el).backgroundImage;
                if (bg && bg !== 'none' && bg.includes(name)) {
                  addCoord(el);
                }
              }
            }

            if (foundCoords.length > 0 && searchMode !== 'all') {
              break;
            }
          }

          if (foundCoords.length > 0) {
            return { foundName: name, items: foundCoords };
          }
        }

        return { foundName: '', items: [] };
      })(${JSON.stringify({ names: imageNames, selector, searchMode })})`
    ) as { foundName?: string; items?: { x: number; y: number }[] } | null | undefined;

    if (searchResult && Array.isArray(searchResult.items) && searchResult.items.length > 0) {
      domResults = searchResult.items;
      foundName = searchResult.foundName || '';
      logToClient(`✅ Знайдено зображення: ${foundName} (${domResults.length} об'єктів)`, 'success');
    } else {
      logToClient(`❌ Не знайдено жодного зображення зі списку`, 'error');
    }
  } catch (err: any) {
    logger.error(`VisualSearch evaluate failed for node ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)), { imageName });
    logToClient(`❌ Помилка пошуку зображення: ${err.message || String(err)}`, 'error');
    return { data: { ...context, count: 0, value: 0 }, nextHandle: ['not_found', 'count'] };
  }

  const count = domResults.length;
  nodeResults.data = { ...context, count, value: count };
  
  // Requirement 13.2: Wrap ws.send in try-catch
  try {
    ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { count } }));
  } catch (sendErr) {
    logger.warn(`Failed to send NODE_DATA_UPDATE for node ${currentNode.id}`, { error: String(sendErr) });
  }

  if (count > 0) {
    const first = domResults[0];
    await takeDebugSnapshot(currentNode.id, nodeTitle, first);
    nodeResults.data = { ...context, coords: first, foundImage: foundName };
    nodeResults.nextHandle = ['found', 'coords', 'count'];
    try {
      ws.send(JSON.stringify({ type: 'NODE_DISPLAY_DATA', nodeId: currentNode.id, value: `Знайдено: ${count} (${foundName})` }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DISPLAY_DATA for node ${currentNode.id}`, { error: String(sendErr) });
    }
    logToClient(`✅ Візуальний пошук завершено: ${foundName} (${count} об'єктів)`, 'success');
  } else {
    nodeResults.nextHandle = ['not_found', 'count'];
    try {
      ws.send(JSON.stringify({ type: 'NODE_DISPLAY_DATA', nodeId: currentNode.id, value: 'Не знайдено' }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DISPLAY_DATA for node ${currentNode.id}`, { error: String(sendErr) });
    }
    logToClient(`❌ Не знайдено жодного зображення зі списку`, 'error');
  }
  return nodeResults;
};
