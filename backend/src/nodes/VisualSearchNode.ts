import { Logger } from '../logger';
import { NodeHandlerParams } from './types';
import path from 'path';
import fs from 'fs';

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
  let nodeResults: Record<string, any> = { data: context };
  let { imageName, threshold = 0.8, selector, searchMode = 'first' } = currentNode.data;
  
  if (!imageName) throw new Error('Назва картинки не вказана');
  const fileName = imageName;

  // Requirement 13.1: Wrap async operations in try-catch with logging
  let domResults: any[] = [];
  try {
    // 1. Пошук в DOM (всі входження)
    domResults = await activePage.evaluate(({ name, selector, searchMode }: any) => {
    const roots = selector 
      ? (searchMode === 'all' ? Array.from(document.querySelectorAll(selector)) : [document.querySelector(selector)].filter(Boolean)) 
      : [document];
    
    if (roots.length === 0) return [];
    
    const found: any[] = [];
    
    roots.forEach((root: any) => {
      let foundInRoot = false;
      const targetCoords: any[] = []; // Зберігаємо координати картинок для випадку без селектора

      // Якщо сам root є зображенням, яке шукаємо
      if (root.tagName === 'IMG' && root.src && root.src.includes(name)) {
        foundInRoot = true;
        if (!selector) {
          const targetEl = root.parentElement || root;
          const rect = targetEl.getBoundingClientRect();
          targetCoords.push({ x: rect.left + window.scrollX + rect.width / 2, y: rect.top + window.scrollY + rect.height / 2 });
        }
      }
      
      // Або якщо root має потрібний фон
      if (root.nodeType === 1 && !foundInRoot) { // ELEMENT_NODE
         const bg = window.getComputedStyle(root).backgroundImage;
         if (bg && bg.includes(name)) {
            foundInRoot = true;
            if (!selector) {
              const rect = root.getBoundingClientRect();
              targetCoords.push({ x: rect.left + window.scrollX + rect.width / 2, y: rect.top + window.scrollY + rect.height / 2 });
            }
         }
      }

      // Перевірка нащадків
      if (root.querySelectorAll) {
        const imgs = root.querySelectorAll(`img[src*="${name}"]`);
        if (imgs.length > 0) {
          foundInRoot = true;
          if (!selector) {
            imgs.forEach((img: any) => {
              const targetEl = img.parentElement || img;
              const rect = targetEl.getBoundingClientRect();
              targetCoords.push({ x: rect.left + window.scrollX + rect.width / 2, y: rect.top + window.scrollY + rect.height / 2 });
            });
          }
        }

        const all = Array.from(root.querySelectorAll('*')) as HTMLElement[];
        for (const el of all) {
          const bg = window.getComputedStyle(el).backgroundImage;
          if (bg && bg.includes(name)) {
            foundInRoot = true;
            if (!selector) {
              const rect = el.getBoundingClientRect();
              targetCoords.push({ x: rect.left + window.scrollX + rect.width / 2, y: rect.top + window.scrollY + rect.height / 2 });
            }
          }
        }
      }

      // Визначаємо що повертати
      if (foundInRoot) {
        if (selector) {
          // Якщо шукали всередині селектора, повертаємо координати САМОГО селектора
          const rect = root.getBoundingClientRect();
          found.push({ x: rect.left + window.scrollX + rect.width / 2, y: rect.top + window.scrollY + rect.height / 2 });
        } else {
          // Інакше повертаємо точні координати знайдених зображень
          found.push(...targetCoords);
        }
      }
    });

    // Видалення дублікатів
    const unique = [];
    const seen = new Set();
    for (const item of found) {
       const key = `${Math.round(item.x)},${Math.round(item.y)}`;
       if (!seen.has(key)) {
           seen.add(key);
           unique.push(item);
       }
    }
    return unique;
  }, { name: fileName, selector, searchMode });
  } catch (err: any) {
    // Requirement 13.1: Log the error
    logger.error(`VisualSearch evaluate failed for node ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)), { imageName });
    logToClient(`❌ Помилка пошуку зображення: ${err.message || String(err)}`, 'error');
    // Requirement 13.5: Continue execution through error handle path
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
    nodeResults.data.coords = first;
    nodeResults.nextHandle = ['found', 'coords', 'count'];
    try {
      ws.send(JSON.stringify({ type: 'NODE_DISPLAY_DATA', nodeId: currentNode.id, value: `Знайдено: ${count}` }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DISPLAY_DATA for node ${currentNode.id}`, { error: String(sendErr) });
    }
    logToClient(`✅ Знайдено ${count} об'єктів: ${fileName}`, 'success');
  } else {
    nodeResults.nextHandle = ['not_found', 'count'];
    try {
      ws.send(JSON.stringify({ type: 'NODE_DISPLAY_DATA', nodeId: currentNode.id, value: 'Не знайдено' }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DISPLAY_DATA for node ${currentNode.id}`, { error: String(sendErr) });
    }
    logToClient(`❌ Не знайдено візуально: ${fileName}`, 'error');
  }
  return nodeResults;
};
