import { NodeHandlerParams } from './types';
import { inputValidator } from '../validation/InputValidator';
import { Logger } from '../logger';

const logger = new Logger('ActionNode');

export const actionNodeHandler = async ({
  currentNode,
  activePage,
  ws,
  context,
  nodeTitle,
  takeDebugSnapshot,
  logToClient,
  smartSleep
}: NodeHandlerParams) => {
  // Отримуємо налаштування: селектор, тип дії, чи клікати всі копії, та прапорець швидкого кліку
  const { selector, actionType = 'click', clickAll = false, quick = false } = currentNode.data as Record<string, unknown>;

  logToClient(`⚙️ ДІЯ: ${actionType} ${selector ? `на ${selector}` : 'по координатах'}`, 'debug');

  // ── Клік по координатах (якщо контекст містить coords від InfoNode і НЕМАЄ свого селектора) ────────
  // Додаємо також перевірку на потрійний клік (actionType === 'triple_click')
  if (context.coords && !selector && !currentNode.data.ignoreContextCoords && (actionType === 'click' || actionType === 'double_click' || actionType === 'triple_click')) {
    let { x, y } = context.coords;

    const currentScroll = await activePage.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    const vSize = activePage.viewportSize() || { width: 960, height: 540 };

    let finalX = x - currentScroll.x;
    let finalY = y - currentScroll.y;

    // Якщо координати поза viewport — перетягуємо карту (окрім статичних UI елементів)
    if (!currentNode.data.isUIElement && (finalX < 50 || finalX > (vSize.width - 50) || finalY < 50 || finalY > (vSize.height - 50))) {
      const centerX = vSize.width / 2;
      const centerY = vSize.height / 2;
      const deltaX = centerX - finalX;
      const deltaY = centerY - finalY;

      logToClient(`🚜 Тягну карту: (${centerX}, ${centerY}) -> (${centerX + deltaX}, ${centerY + deltaY})`, 'debug');

      await activePage.mouse.move(centerX, centerY);
      await activePage.mouse.down();
      await activePage.mouse.move(centerX + deltaX, centerY + deltaY, { steps: 25 });
      await activePage.mouse.up();
      await smartSleep(400, ws);
      await activePage.keyboard.press('Escape');

      finalX = centerX;
      finalY = centerY;
      await smartSleep(400, ws);
    }

    try {
      // Робимо скріншот дебагу перед виконанням кліку
      await takeDebugSnapshot(currentNode.id, nodeTitle, { x: finalX, y: finalY });
      // Визначаємо кількість кліків: 1 для звичайного, 2 для подвійного, 3 для потрійного
      if (actionType === 'triple_click') {
        await activePage.mouse.click(finalX, finalY);
        await activePage.waitForTimeout(200); // Таймінг між кліками
        await activePage.mouse.click(finalX, finalY);
        await activePage.waitForTimeout(200);
        await activePage.mouse.click(finalX, finalY);
      } else if (actionType === 'double_click') {
        await activePage.mouse.dblclick(finalX, finalY);
      } else {
        await activePage.mouse.click(finalX, finalY);
      }
      // Повідомляємо клієнта про успішний клік
      logToClient(`✅ Клік (${actionType}) виконано в (${finalX}, ${finalY})`, 'success');
    } catch (err: any) {
      logToClient(`❌ Помилка кліку по координатах: ${err.message}`, 'error');
      return { data: context, nextHandle: ['error'] };
    }

  } else if (selector) {
    // ── Дії по CSS-селектору ─────────────────────────────────────────────────
    
    // Requirement 4: Validate CSS selector before Playwright operations
    const selectorValidation = inputValidator.validateSelector(String(selector));
    if (!selectorValidation.isValid) {
      logger.warn(`Action node ${currentNode.id}: selector validation failed`, { selector, error: selectorValidation.error });
      logToClient(`❌ Невалідний селектор: ${selectorValidation.error}`, 'error');
      return { data: context, nextHandle: ['error'] };
    }

    // ── Хелпер виконання скрипта по всіх фреймах (включаючи iFrame) ───────────
    const runInAllFrames = async (script: string): Promise<{ count: number; error: string | null }> => {
      const frames = activePage.frames();
      for (const frame of frames) {
        try {
          const res = (await frame.evaluate(script)) as { count: number; error: string | null };
          if (res && typeof res.count === 'number' && res.count > 0) {
            return res;
          }
        } catch (e) {}
      }
      return { count: 0, error: 'Елемент не знайдено в жодному з фреймів' };
    };

    // ── js_click: обхід антибот через element.click() у JS-контексті ────────
    if (actionType === 'js_click') {
      try {
        const selValue = selector as string;
        const allValue = clickAll as boolean;
        const jsClickScript = `
          (function(sel, all) {
            try {
              var universalFindElements = function(s) {
                if (!s) return [];
                s = s.trim();
                try {
                  var res = Array.from(document.querySelectorAll(s));
                  if (res && res.length > 0) return res;
                } catch (e) {}

                var searchText = "";
                var targetTag = "*";

                var hasTextMatch = s.match(/^(.+?):has-text\\((['"]?)(.*?)\\2\\)$/i);
                if (hasTextMatch) {
                  targetTag = hasTextMatch[1].trim();
                  searchText = hasTextMatch[3].trim();
                } else {
                  var textMatch = s.match(/^(?:text=|:text\\()(['"]?)(.*?)\\1\\)?$/i);
                  if (textMatch) {
                    searchText = textMatch[2].trim();
                  } else if (s.indexOf('<') === -1 && s.indexOf('>') === -1 && s.indexOf('.') === -1 && s.indexOf('#') === -1) {
                    searchText = s;
                  }
                }

                if (searchText) {
                  var normSearch = searchText.toLowerCase();
                  var selectorToQuery = (targetTag !== '*' && targetTag !== '') ? targetTag : 'button, [role="button"], a, div.cursor-pointer, div';
                  var candidates = [];
                  try {
                    candidates = Array.from(document.querySelectorAll(selectorToQuery));
                  } catch (err) {
                    candidates = Array.from(document.querySelectorAll('button, [role="button"], a, div'));
                  }

                  var exact = candidates.filter(function(el) {
                    return el.textContent && el.textContent.trim().toLowerCase() === normSearch;
                  });
                  if (exact.length > 0) return exact;

                  var partial = candidates.filter(function(el) {
                    return el.textContent && el.textContent.toLowerCase().indexOf(normSearch) !== -1;
                  });
                  if (partial.length > 0) return partial;
                }

                if (s.startsWith('//') || s.startsWith('(//')) {
                  try {
                    var results = [];
                    var query = document.evaluate(s, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                    for (var i = 0; i < query.snapshotLength; i++) {
                      var node = query.snapshotItem(i);
                      if (node instanceof Element) results.push(node);
                    }
                    if (results.length > 0) return results;
                  } catch (e) {}
                }

                return [];
              };

              var elements = universalFindElements(sel);
              if (!elements || elements.length === 0) return { count: 0, error: 'Елемент не знайдено' };

              var targets = all ? elements : [elements[0]];
              for (var i = 0; i < targets.length; i++) {
                try { targets[i].scrollIntoView({ block: 'center', inline: 'center' }); } catch(_) {}
                targets[i].click();
              }

              return { count: targets.length, error: null };
            } catch (err) {
              return { count: 0, error: String(err && err.message ? err.message : err) };
            }
          })(${JSON.stringify(selValue)}, ${allValue})
        `;
        const result = await runInAllFrames(jsClickScript);

        if (!result || result.error || result.count === 0) {
          logToClient(`⚠️ JS Click: ${result?.error || 'Елемент не знайдено'} (${String(selector)})`, 'error');
          return { data: context, nextHandle: ['error'] };
        }

        logToClient(`✅ JS Click виконано (${result.count} елементів)`, 'success');
      } catch (err: any) {
        logToClient(`❌ js_click провалився: ${err.message}`, 'error');
        return { data: context, nextHandle: ['error'] };
      }
      return { data: context, nextHandle: [null, undefined, 'success'] };
    }

    // ── dispatch_click: повна симуляція миші через dispatchEvent ─────────
    if (actionType === 'dispatch_click') {
      try {
        const selValue = selector as string;
        const allValue = clickAll as boolean;
        const dispatchScript = `
          (function(sel, all) {
            try {
              var universalFindElements = function(s) {
                if (!s) return [];
                s = s.trim();
                try {
                  var res = Array.from(document.querySelectorAll(s));
                  if (res && res.length > 0) return res;
                } catch (e) {}

                var searchText = "";
                var targetTag = "*";

                var hasTextMatch = s.match(/^(.+?):has-text\\((['"]?)(.*?)\\2\\)$/i);
                if (hasTextMatch) {
                  targetTag = hasTextMatch[1].trim();
                  searchText = hasTextMatch[3].trim();
                } else {
                  var textMatch = s.match(/^(?:text=|:text\\()(['"]?)(.*?)\\1\\)?$/i);
                  if (textMatch) {
                    searchText = textMatch[2].trim();
                  } else if (s.indexOf('<') === -1 && s.indexOf('>') === -1 && s.indexOf('.') === -1 && s.indexOf('#') === -1) {
                    searchText = s;
                  }
                }

                if (searchText) {
                  var normSearch = searchText.toLowerCase();
                  var selectorToQuery = (targetTag !== '*' && targetTag !== '') ? targetTag : 'button, [role="button"], a, div.cursor-pointer, div';
                  var candidates = [];
                  try {
                    candidates = Array.from(document.querySelectorAll(selectorToQuery));
                  } catch (err) {
                    candidates = Array.from(document.querySelectorAll('button, [role="button"], a, div'));
                  }

                  var exact = candidates.filter(function(el) {
                    return el.textContent && el.textContent.trim().toLowerCase() === normSearch;
                  });
                  if (exact.length > 0) return exact;

                  var partial = candidates.filter(function(el) {
                    return el.textContent && el.textContent.toLowerCase().indexOf(normSearch) !== -1;
                  });
                  if (partial.length > 0) return partial;
                }

                if (s.startsWith('//') || s.startsWith('(//')) {
                  try {
                    var results = [];
                    var query = document.evaluate(s, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                    for (var i = 0; i < query.snapshotLength; i++) {
                      var node = query.snapshotItem(i);
                      if (node instanceof Element) results.push(node);
                    }
                    if (results.length > 0) return results;
                  } catch (e) {}
                }

                return [];
              };

              var elements = universalFindElements(sel);
              if (!elements || elements.length === 0) return { count: 0, error: 'Елемент не знайдено' };

              var targets = all ? elements : [elements[0]];
              var clickedCount = 0;

              for (var k = 0; k < targets.length; k++) {
                var el = targets[k];
                try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch(_) {}
                var rect = el.getBoundingClientRect();
                var cx = rect.left + rect.width / 2;
                var cy = rect.top + rect.height / 2;

                var eventInit = {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  clientX: cx,
                  clientY: cy,
                  screenX: cx,
                  screenY: cy,
                  button: 0,
                  buttons: 1
                };

                el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({}, eventInit, { pointerId: 1 })));
                el.dispatchEvent(new MouseEvent('mousedown', eventInit));
                el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, eventInit, { pointerId: 1 })));
                el.dispatchEvent(new MouseEvent('mouseup', eventInit));
                el.dispatchEvent(new MouseEvent('click', eventInit));
                try { el.click(); } catch (_) {}
                clickedCount++;
              }

              return { count: clickedCount, error: null };
            } catch (err) {
              return { count: 0, error: String(err && err.message ? err.message : err) };
            }
          })(${JSON.stringify(selValue)}, ${allValue})
        `;
        const result = await runInAllFrames(dispatchScript);

        if (result.error || result.count === 0) {
          logToClient(`❌ dispatch_click: ${result.error || 'Елемент не знайдено'}`, 'error');
          return { data: context, nextHandle: ['error'] };
        }

        logToClient(`✅ Dispatch Click виконано (${result.count} елементів)`, 'success');
      } catch (err: any) {
        logToClient(`❌ dispatch_click провалився: ${err.message}`, 'error');
        return { data: context, nextHandle: ['error'] };
      }
      return { data: context, nextHandle: [null, undefined, 'success'] };
    }

    // ── force_click / click з пошуком по фреймах та універсальним фолбеком ───────────────
    try {
      await takeDebugSnapshot(currentNode.id, nodeTitle, { selector });
      const rawTimeout = currentNode.data?.timeout;
      const timeout = typeof rawTimeout === 'number' && rawTimeout > 0 
        ? Number(rawTimeout) 
        : (quick ? 100 : 1500);

      const shouldClickAll = Boolean(currentNode.data?.clickAll || currentNode.data?.clickAllCopies);

      // Шукаємо локатор в основній сторінці та у фреймах
      let targetLoc: any = null;
      for (const frame of activePage.frames()) {
        try {
          const loc = frame.locator(String(selector));
          if (await loc.count() > 0) {
            targetLoc = loc;
            break;
          }
        } catch (e) {}
      }
      if (!targetLoc) {
        targetLoc = activePage.locator(String(selector));
      }

      const count = await targetLoc.count();
      if (count > 0) {
        const clickLimit = shouldClickAll ? count : 1;
        const clickLast = Boolean(currentNode.data?.clickLast);
        
        // Ітеруємося з кінця до початку, щоб при видаленні елементів з DOM індекси тих, що залишилися, не зсувалися
        for (let i = clickLimit - 1; i >= 0; i--) {
          const index = (clickLimit === 1 && clickLast) ? count - 1 : i;
          const el = targetLoc.nth(index);
          await el.waitFor({ state: 'attached', timeout }).catch(() => {});
          
          if (actionType === 'double_click') {
            await el.dblclick({ force: true, timeout });
          } else if (actionType === 'triple_click') {
            await el.scrollIntoViewIfNeeded({ timeout }).catch(() => {});
            const box = await el.boundingBox();
            if (box) {
              const cx = box.x + box.width / 2;
              const cy = box.y + box.height / 2;
              await activePage.mouse.click(cx, cy);
              await activePage.waitForTimeout(200);
              await activePage.mouse.click(cx, cy);
              await activePage.waitForTimeout(200);
              await activePage.mouse.click(cx, cy);
            } else {
              await el.click({ force: true, timeout });
              await activePage.waitForTimeout(200);
              await el.click({ force: true, timeout });
              await activePage.waitForTimeout(200);
              await el.click({ force: true, timeout });
            }
          } else if (actionType === 'hover') {
            await el.hover({ timeout });
          } else if (actionType === 'scroll') {
            await el.scrollIntoViewIfNeeded({ timeout });
          } else if (actionType === 'scroll_center') {
            await el.evaluate((node: HTMLElement | SVGElement) => node.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => {});
          } else {
            await el.click({ force: true, timeout });
          }

          if (shouldClickAll && i > 0) {
             await activePage.waitForTimeout(400); // Затримка між кліками по копіях
          }
        }
        logToClient(`✅ Дія ${actionType} виконана для ${clickLimit} елементів: ${String(selector)}`, 'success');
        return { data: context, nextHandle: [null, undefined, 'success'] };
      }
      throw new Error('Елемент не знайдено');
    } catch (err: any) {
      // Автоматичний фолбек: якщо Playwright локатор не знайшов елемент, запускаємо універсальний JS-клік по всіх фреймах
      const selValue = String(selector);
      const shouldClickAll = Boolean(currentNode.data?.clickAll || currentNode.data?.clickAllCopies);
      const clickLast = Boolean(currentNode.data?.clickLast);
      const fallbackScript = `
        (function(sel, all, last, action) {
          var universalFindElements = function(s) {
            if (!s) return [];
            s = s.trim();
            try {
              var res = Array.from(document.querySelectorAll(s));
              if (res && res.length > 0) return res;
            } catch (e) {}

            var searchText = "";
            var targetTag = "*";

            var hasTextMatch = s.match(/^(.+?):has-text\\((['"]?)(.*?)\\2\\)$/i);
            if (hasTextMatch) {
              targetTag = hasTextMatch[1].trim();
              searchText = hasTextMatch[3].trim();
            } else {
              var textMatch = s.match(/^(?:text=|:text\\()(['"]?)(.*?)\\1\\)?$/i);
              if (textMatch) {
                searchText = textMatch[2].trim();
              } else if (s.indexOf('<') === -1 && s.indexOf('>') === -1 && s.indexOf('.') === -1 && s.indexOf('#') === -1) {
                searchText = s;
              }
            }

            if (searchText) {
              var normSearch = searchText.toLowerCase();
              var selectorToQuery = (targetTag !== '*' && targetTag !== '') ? targetTag : 'button, [role="button"], a, div.cursor-pointer, div';
              var candidates = [];
              try {
                candidates = Array.from(document.querySelectorAll(selectorToQuery));
              } catch (err) {
                candidates = Array.from(document.querySelectorAll('button, [role="button"], a, div'));
              }

              var exact = candidates.filter(function(el) {
                return el.textContent && el.textContent.trim().toLowerCase() === normSearch;
              });
              if (exact.length > 0) return exact;

              var partial = candidates.filter(function(el) {
                return el.textContent && el.textContent.toLowerCase().indexOf(normSearch) !== -1;
              });
              if (partial.length > 0) return partial;
            }

            if (s.startsWith('//') || s.startsWith('(//')) {
              try {
                var results = [];
                var query = document.evaluate(s, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                for (var i = 0; i < query.snapshotLength; i++) {
                  var node = query.snapshotItem(i);
                  if (node instanceof Element) results.push(node);
                }
                if (results.length > 0) return results;
              } catch (e) {}
            }

            return [];
          };

          var elements = universalFindElements(sel);
          if (!elements || elements.length === 0) return { count: 0, error: 'Не знайдено' };
          var targets = all ? elements : [last ? elements[elements.length - 1] : elements[0]];
          for (var i = 0; i < targets.length; i++) {
            var el = targets[i];
            try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch(_) {}
            
            if (action !== 'scroll' && action !== 'scroll_center' && action !== 'hover') {
              var rect = el.getBoundingClientRect();
              var cx = rect.left + rect.width / 2;
              var cy = rect.top + rect.height / 2;
              var eventInit = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 };
              el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({}, eventInit, { pointerId: 1 })));
              el.dispatchEvent(new MouseEvent('mousedown', eventInit));
              el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, eventInit, { pointerId: 1 })));
              el.dispatchEvent(new MouseEvent('mouseup', eventInit));
              el.dispatchEvent(new MouseEvent('click', eventInit));
              try { el.click(); } catch(_) {}
            }
          }
          return { count: targets.length, error: null };
        })(${JSON.stringify(selValue)}, ${shouldClickAll}, ${clickLast}, ${JSON.stringify(actionType)})
      `;

      const fallbackResult = await runInAllFrames(fallbackScript);
      if (fallbackResult && fallbackResult.count > 0) {
        logToClient(`✅ Клік виконано успішно через універсальний JS-обробник у iFrame!`, 'success');
      } else {
        logToClient(`❌ Елемент не знайдено за селектором/текстом у жодному з фреймів: ${String(selector)}`, 'error');
        return { data: context, nextHandle: ['error'] };
      }
    }
  }

  return { data: context, nextHandle: [null, undefined, 'success'] };
};
