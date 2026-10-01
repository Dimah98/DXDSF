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
        : (quick ? 1000 : 3000);

      const shouldClickAll = Boolean(currentNode.data?.clickAll || currentNode.data?.clickAllCopies);

      // Шукаємо локатор в основній сторінці та у фреймах з очікуванням появи (запобігає осічкам під час оновлення DOM у циклі)
      const startTime = Date.now();
      let targetLoc: any = null;
      let targetFrame: any = null;
      let count = 0;

      while (Date.now() - startTime < timeout) {
        for (const frame of activePage.frames()) {
          try {
            const loc = frame.locator(String(selector));
            const c = await loc.count();
            if (c > 0) {
              targetLoc = loc;
              targetFrame = frame;
              count = c;
              break;
            }
          } catch (e) {}
        }
        if (targetLoc && count > 0) break;
        await activePage.waitForTimeout(250);
      }

      if (!targetLoc) {
        targetLoc = activePage.locator(String(selector));
        count = await targetLoc.count();
      }

      if (count > 0) {
        const clickLast = Boolean(currentNode.data?.clickLast);
        const currentFrame = targetFrame || activePage;
        const markerAttr = `data-sf-clicked-${Date.now()}`;
        let executedClicks = 0;
        const maxPasses = shouldClickAll ? 5 : 1;
        const delayBetweenClicks = quick ? 80 : 150;

        try {
          for (let pass = 0; pass < maxPasses; pass++) {
            // Отримуємо стабільні хендли ElementHandle для всіх знайдених елементів
            let allHandles = await currentFrame.$$(String(selector));
            if (allHandles.length === 0 && currentFrame !== activePage) {
              allHandles = await activePage.$$(String(selector));
            }

            if (allHandles.length === 0) {
              if (executedClicks === 0 && pass === 0) {
                throw new Error('Елемент не знайдено');
              }
              break;
            }

            // Фільтруємо лише елементи, які ще НЕ клікалися в цьому виклику ноди
            const unclickedHandles: any[] = [];
            for (const h of allHandles) {
              let isMarked = false;
              try {
                isMarked = await h.evaluate((node: Element, m: string) => {
                  return node.hasAttribute(m) || (node as any).__sf_clicked === true;
                }, markerAttr);
              } catch (_) {
                isMarked = false;
              }

              if (!isMarked) {
                unclickedHandles.push(h);
              } else {
                try { await h.dispose(); } catch (_) {}
              }
            }

            if (unclickedHandles.length === 0) {
              break; // Усі доступні копії вже оброблені
            }

            // Якщо режим одного кліку — беремо тільки один елемент (перший або останній)
            let targets: any[] = [];
            if (!shouldClickAll) {
              targets = [clickLast ? unclickedHandles[unclickedHandles.length - 1] : unclickedHandles[0]];
              // Звільняємо невикористані хендли
              for (const h of unclickedHandles) {
                if (h !== targets[0]) {
                  try { await h.dispose(); } catch (_) {}
                }
              }
            } else {
              targets = clickLast ? unclickedHandles.reverse() : unclickedHandles;
            }

            let clickedInThisPass = 0;

            for (let i = 0; i < targets.length; i++) {
              const handle = targets[i];
              try {
                // Перевіряємо, що елемент досі прикріплений до DOM
                let isAttached = false;
                try {
                  isAttached = await handle.evaluate((n: Element) => n.isConnected);
                } catch (_) {
                  isAttached = false;
                }
                if (!isAttached) {
                  try { await handle.dispose(); } catch (_) {}
                  continue;
                }

                // Позначаємо елемент як опрацьований одразу, щоб уникнути повторних кліків
                if (shouldClickAll) {
                  try {
                    await handle.evaluate((node: Element, m: string) => {
                      node.setAttribute(m, '1');
                      try { (node as any).__sf_clicked = true; } catch (_) {}
                    }, markerAttr);
                  } catch (_) {}
                }

                // Скролимо елемент у видиму область (якщо не scroll_center)
                if (actionType !== 'scroll_center') {
                  try { await handle.scrollIntoViewIfNeeded({ timeout: 500 }); } catch (_) {}
                }

                if (actionType === 'double_click') {
                  await handle.dblclick({ force: true, timeout: Math.max(timeout, 1000) });
                } else if (actionType === 'triple_click') {
                  let box: any = null;
                  try { box = await handle.boundingBox(); } catch (_) {}
                  if (!box) {
                    try { await handle.scrollIntoViewIfNeeded({ timeout: 300 }); } catch (_) {}
                    try { box = await handle.boundingBox(); } catch (_) {}
                  }
                  if (box) {
                    const cx = box.x + box.width / 2;
                    const cy = box.y + box.height / 2;
                    await activePage.mouse.click(cx, cy);
                    await activePage.waitForTimeout(100);
                    await activePage.mouse.click(cx, cy);
                    await activePage.waitForTimeout(100);
                    await activePage.mouse.click(cx, cy);
                  } else {
                    try { await handle.click({ force: true, timeout: 1000 }); } catch (_) {}
                    await activePage.waitForTimeout(100);
                    try { await handle.click({ force: true, timeout: 1000 }); } catch (_) {}
                    await activePage.waitForTimeout(100);
                    try { await handle.click({ force: true, timeout: 1000 }); } catch (_) {}
                  }
                } else if (actionType === 'hover') {
                  await handle.hover({ timeout: 1000 });
                } else if (actionType === 'scroll') {
                  await handle.scrollIntoViewIfNeeded({ timeout: 1000 });
                } else if (actionType === 'scroll_center') {
                  try {
                    await handle.evaluate((node: HTMLElement | SVGElement) => node.scrollIntoView({ block: 'center', inline: 'center' }));
                  } catch (_) {}
                } else {
                  // Звичайний клік / force_click: надійна обробка з фолбеком для SVG/img
                  try {
                    await handle.click({ force: true, timeout: Math.max(timeout, 1000) });
                  } catch (clickErr) {
                    // Фолбек: якщо елемент заблокований pointer-events: none, клікаємо по координатах через сторінку
                    let box: any = null;
                    try { box = await handle.boundingBox(); } catch (_) {}
                    if (box) {
                      const cx = box.x + box.width / 2;
                      const cy = box.y + box.height / 2;
                      try { await activePage.mouse.click(cx, cy); } catch (_) {}
                    } else {
                      // Другий фолбек: пряма диспетчеризація MouseEvent у DOM
                      try {
                        await handle.evaluate((el: HTMLElement) => {
                          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                          try { el.click(); } catch (_) {}
                        });
                      } catch (_) {}
                    }
                  }
                }

                executedClicks++;
                clickedInThisPass++;

                if (!shouldClickAll) break;

                // Затримка між кліками для оновлення гри та запобігання втраті кліків
                if (i < targets.length - 1) {
                  await activePage.waitForTimeout(delayBetweenClicks);
                }
              } catch (err: any) {
                logger.debug(`ActionNode: error handling element ${i}: ${err?.message}`);
              } finally {
                try { await handle.dispose(); } catch (_) {}
              }
            }

            if (!shouldClickAll || clickedInThisPass === 0) {
              break;
            }

            // Невелика пауза перед наступним проходом (якщо є залишок)
            await activePage.waitForTimeout(delayBetweenClicks);
          }
        } finally {
          // Очищаємо тимчасові маркери опрацьованих елементів
          if (shouldClickAll) {
            try {
              await currentFrame.evaluate((m: string) => {
                document.querySelectorAll(`[${m}]`).forEach(e => {
                  e.removeAttribute(m);
                  try { delete (e as any).__sf_clicked; } catch (_) {}
                });
              }, markerAttr);
            } catch (_) {}
          }
        }

        logToClient(`✅ Дія ${actionType} виконана для ${executedClicks} елементів: ${String(selector)}`, 'success');
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

              // Якщо елемент має pointer-events: none (наприклад, img у Sunflower Land),
              // шукаємо реальний інтерактивний батьківський елемент або елемент по координатах
              var clickTarget = el;
              if (window.getComputedStyle(el).pointerEvents === 'none' || el.classList.contains('pointer-events-none')) {
                var fromPoint = document.elementFromPoint(cx, cy);
                var parentClickable = el.closest('.cursor-pointer, [role="button"], button, [onclick], [data-map-placement]');
                clickTarget = fromPoint || parentClickable || el.parentElement || el;
              }

              var eventInit = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 };
              clickTarget.dispatchEvent(new PointerEvent('pointerdown', Object.assign({}, eventInit, { pointerId: 1 })));
              clickTarget.dispatchEvent(new MouseEvent('mousedown', eventInit));
              clickTarget.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, eventInit, { pointerId: 1 })));
              clickTarget.dispatchEvent(new MouseEvent('mouseup', eventInit));
              clickTarget.dispatchEvent(new MouseEvent('click', eventInit));
              try { clickTarget.click(); } catch(_) {}

              if (action === 'double_click') {
                clickTarget.dispatchEvent(new PointerEvent('pointerdown', Object.assign({}, eventInit, { pointerId: 1 })));
                clickTarget.dispatchEvent(new MouseEvent('mousedown', eventInit));
                clickTarget.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, eventInit, { pointerId: 1 })));
                clickTarget.dispatchEvent(new MouseEvent('mouseup', eventInit));
                clickTarget.dispatchEvent(new MouseEvent('click', eventInit));
                clickTarget.dispatchEvent(new MouseEvent('dblclick', eventInit));
              } else if (action === 'triple_click') {
                for (var tc = 0; tc < 2; tc++) {
                  clickTarget.dispatchEvent(new PointerEvent('pointerdown', Object.assign({}, eventInit, { pointerId: 1 })));
                  clickTarget.dispatchEvent(new MouseEvent('mousedown', eventInit));
                  clickTarget.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, eventInit, { pointerId: 1 })));
                  clickTarget.dispatchEvent(new MouseEvent('mouseup', eventInit));
                  clickTarget.dispatchEvent(new MouseEvent('click', eventInit));
                }
              }
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

  return { data: context, nextHandle: ['success', 'out', 'next'] };
};
