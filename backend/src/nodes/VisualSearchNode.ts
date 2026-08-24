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
    // Перебираємо зображення по черзі, поки не знайдемо
    for (const name of imageNames) {
      logToClient(`🔍 Шукаємо: ${name}`, 'info');
      
      const results = await activePage.evaluate(({ name, selector, searchMode }: { name: string; selector: string | undefined; searchMode: string }) => {
        console.log('DEBUG: Starting evaluate with:', { name, selector, searchMode });
        
        const roots = selector 
          ? (searchMode === 'all' ? Array.from(document.querySelectorAll(selector)) : [document.querySelector(selector)].filter((r): r is Element => r !== null)) 
          : [document];
        
        console.log('DEBUG: Roots found:', roots.length);
        if (roots.length === 0) return [];
        
        // Debug: log all images on page
        const allImgs = Array.from(document.querySelectorAll('img'));
        const imgSrcs = allImgs.map(img => img.src).filter(Boolean);
        console.log('DEBUG: All image srcs:', imgSrcs);
        console.log('DEBUG: Searching for name:', name);
        console.log('DEBUG: Name includes check:', imgSrcs.some(src => src.includes(name)));
        
        // Also check background images
        const allElements = Array.from(document.querySelectorAll('*'));
        const bgImages = allElements.map(el => window.getComputedStyle(el).backgroundImage).filter(bg => bg && bg !== 'none');
        console.log('DEBUG: All background images:', bgImages);
        console.log('DEBUG: Background includes check:', bgImages.some(bg => bg.includes(name)));
        
        const found: { x: number, y: number }[] = [];
        
        roots.forEach((root) => {
          // Якщо root — це document (nodeType=9), обробляємо його окремо:
          // одразу шукаємо нащадків без перевірки nodeType та без звернення до .tagName
          if (root.nodeType !== 1) {
            // Це document — шукаємо серед всіх img та елементів з фоном
            if (root.querySelectorAll) {
              // Пошук по тегу img
              const imgs = root.querySelectorAll(`img[src*="${name}"]`) as NodeListOf<HTMLImageElement>;
              imgs.forEach((img) => {
                const targetEl = img.parentElement || img;
                const rect = (targetEl as HTMLElement).getBoundingClientRect();
                // Беремо тільки видимі елементи (розмір > 0)
                if (rect.width > 0 || rect.height > 0) {
                  found.push({ x: rect.left + window.scrollX + rect.width / 2, y: rect.top + window.scrollY + rect.height / 2 });
                }
              });
              // Пошук по background-image
              const all = Array.from(root.querySelectorAll('*')) as HTMLElement[];
              for (const el of all) {
                const bg = window.getComputedStyle(el).backgroundImage;
                if (bg && bg !== 'none' && bg.includes(name)) {
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 0 || rect.height > 0) {
                    found.push({ x: rect.left + window.scrollX + rect.width / 2, y: rect.top + window.scrollY + rect.height / 2 });
                  }
                }
              }
            }
            return; // document оброблено — пропускаємо логіку для Element
          }

          // Звичайний Element (nodeType === 1)
          const element = root as Element;
          let foundInRoot = false;
          const targetCoords: { x: number, y: number }[] = [];

          // Якщо сам root є зображенням, яке шукаємо
          if (element.tagName === 'IMG' && (element as HTMLImageElement).src && (element as HTMLImageElement).src.includes(name)) {
            foundInRoot = true;
            if (!selector) {
              const targetEl = element.parentElement || element;
              const rect = targetEl.getBoundingClientRect();
              targetCoords.push({ x: rect.left + window.scrollX + rect.width / 2, y: rect.top + window.scrollY + rect.height / 2 });
            }
          }
          
          // Або якщо element має потрібний фон
          if (!foundInRoot) {
             const bg = window.getComputedStyle(element).backgroundImage;
             if (bg && bg.includes(name)) {
                foundInRoot = true;
                if (!selector) {
                  const rect = element.getBoundingClientRect();
                  targetCoords.push({ x: rect.left + window.scrollX + rect.width / 2, y: rect.top + window.scrollY + rect.height / 2 });
                }
             }
          }

          // Перевірка нащадків
          if (element.querySelectorAll) {
            const imgs = element.querySelectorAll(`img[src*="${name}"]`);
            if (imgs.length > 0) {
              foundInRoot = true;
              if (!selector) {
                imgs.forEach((img: Element) => {
                  const targetEl = img.parentElement || img;
                  const rect = (targetEl as HTMLElement).getBoundingClientRect();
                  targetCoords.push({ x: rect.left + window.scrollX + rect.width / 2, y: rect.top + window.scrollY + rect.height / 2 });
                });
              }
            }

            const all = Array.from(element.querySelectorAll('*')) as HTMLElement[];
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
              const rect = element.getBoundingClientRect();
              found.push({ x: rect.left + window.scrollX + rect.width / 2, y: rect.top + window.scrollY + rect.height / 2 });
            } else {
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
      }, { name, selector, searchMode });

      if (results.length > 0) {
        domResults = results;
        foundName = name;
        logToClient(`✅ Знайдено зображення: ${name} (${results.length} об'єктів)`, 'success');
        break; // Знайшли — зупиняємося
      } else {
        logToClient(`❌ Не знайдено: ${name}`, 'error');
      }
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
