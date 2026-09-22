import fs from 'fs';
import path from 'path';
import { WebSocket } from 'ws';
import { Logger } from '../logger';
import { PROJECTS_DIR } from '../constants';
import { RunLogger } from '../RunLogger';
import { BotEngine } from '../engine/BotEngine';
import { nodeHandlers } from '../nodes';
import {
  isSessionBrowserAlive,
  connectToBrowser,
  injectPicker,
  takeDebugSnapshot
} from '../browserManager';
import {
  ensureBrowserSettings,
  broadcastVariables,
  broadcastNodeExecuting,
  logToClient,
  smartSleep,
  executeNodeLogic,
  projectQueueManager,
  getQueueConfig,
  getRunningProjectsCount,
  stopProject
} from '../runner/ProjectRunner';
import { browserLifecycle, wsLifecycle } from '../services';
import { ProjectSession, ExtendedWebSocket } from '../types';

const logger = new Logger('WSHandlers');

export async function handleClientMessage(
  ws: WebSocket,
  message: string | Buffer,
  session: ProjectSession
): Promise<void> {
  const projectName = session.projectName;

  wsLifecycle.updateActivity(ws as any);
  
  (ws as any)._msgCount = ((ws as any)._msgCount || 0) + 1;
  if ((ws as any)._msgCount > 100) {
    return;
  }

  session.activeWs = ws as unknown as ExtendedWebSocket;

  let data: any;
  try {
    data = JSON.parse(message.toString());
  } catch (parseErr) {
    logger.warn('WS: Received invalid JSON message', { projectName, error: String(parseErr) });
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid JSON format' }));
    return;
  }
  
  if (!data || typeof data !== 'object' || !data.type) {
    logger.warn('WS: Received message without type field', { projectName });
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Message must have a type field' }));
    return;
  }

  if (data.type === 'OPEN_BROWSER') {
    const forceHeaded = data.forceHeaded === true || data.visible === true;
    try {
      await ensureBrowserSettings(projectName, session);
      await connectToBrowser(
        session,
        session.botSettings?.width || session.botSettings?.browserWidth || 1280,
        session.botSettings?.height || session.botSettings?.browserHeight || 720,
        session.botSettings?.profile,
        session.botSettings?.profileDir,
        session.botSettings?.proxy,
        forceHeaded
      );
      ws.send(JSON.stringify({ type: 'CONSOLE_LOG', message: `🌐 Браузер проекту [${projectName}] відкрито у ${forceHeaded ? 'видимому' : 'фоновому'} режимі!`, logType: 'success' }));
    } catch (e: any) {
      logger.error(`Failed to open browser via WS for project ${projectName}`, e instanceof Error ? e : new Error(String(e)));
      ws.send(JSON.stringify({ type: 'ERROR', message: `Помилка відкриття браузера: ${e.message || String(e)}` }));
    }
    return;
  }

  if (data.type === 'START_STREAM') {
    (ws as any).isStreaming = true;

    await ensureBrowserSettings(projectName, session);
    await connectToBrowser(
      session,
      session.botSettings?.width || session.botSettings?.browserWidth,
      session.botSettings?.height || session.botSettings?.browserHeight,
      session.botSettings?.profile,
      session.botSettings?.profileDir,
      session.botSettings?.proxy
    ).catch((e) => {
      logger.error(`Failed to connect to browser for stream in project ${projectName}`, e instanceof Error ? e : new Error(String(e)));
      (ws as any).isStreaming = false;
    });

    if (isSessionBrowserAlive(session) && session.page && session.context) {
      try {
        // Очищаємо попередню CDP Screencast сесію якщо існує
        if ((ws as any)._cdpScreencast) {
          try {
            await (ws as any)._cdpScreencast.send('Page.stopScreencast');
            await (ws as any)._cdpScreencast.detach();
          } catch (_) {}
          delete (ws as any)._cdpScreencast;
        }

        const cdp = await session.context.newCDPSession(session.page);
        (ws as any)._cdpScreencast = cdp;

        session.page.evaluate(() => window.devicePixelRatio || 1).then((dpr) => {
          (session as any)._cachedDpr = dpr;
        }).catch(() => {});

        cdp.on('Page.screencastFrame', async ({ data, sessionId, metadata }: { data: string; sessionId: number; metadata: any }) => {
          try {
            if (metadata) {
              if (metadata.deviceWidth) (session as any)._deviceWidth = metadata.deviceWidth;
              if (metadata.deviceHeight) (session as any)._deviceHeight = metadata.deviceHeight;
            }
            // Перевіряємо зворотний тиск буфера (Backpressure): якщо клієнт не встигає зчитувати,
            // пропускаємо проміжний кадр, щоб уникнути витоку RAM та затримки відеопотоку
            if ((ws as any).isStreaming && ws.readyState === 1 && ws.bufferedAmount < 256 * 1024) {
              ws.send(JSON.stringify({ 
                type: 'STREAM_FRAME', 
                frame: data,
                metadata: {
                  deviceWidth: metadata?.deviceWidth || (session as any)._deviceWidth || 1280,
                  deviceHeight: metadata?.deviceHeight || (session as any)._deviceHeight || 720,
                  pageScaleFactor: metadata?.pageScaleFactor || 1,
                  offsetTop: metadata?.offsetTop || 0
                }
              }));
            }
            await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
          } catch (frameErr) {
            logger.debug(`Error handling screencastFrame for ${projectName}`, { error: String(frameErr) });
          }
        });

        await cdp.send('Page.startScreencast', {
          format: 'jpeg',
          quality: (session.botSettings as any)?.streamQuality || 50,
          maxWidth: 960,
          maxHeight: 540,
          everyNthFrame: 1
        });
        logger.info(`CDP Screencast started for project ${projectName}`);
      } catch (screencastErr) {
        logger.warn(`Failed to start CDP screencast, falling back to interval for ${projectName}`, { error: String(screencastErr) });
        const sendFrame = async () => {
          if (!(ws as any).isStreaming) return;
          try {
            if (isSessionBrowserAlive(session) && session.page) {
              const vp = session.page.viewportSize() || { width: 1280, height: 720 };
              (session as any)._deviceWidth = vp.width;
              (session as any)._deviceHeight = vp.height;
              const screenshot = await session.page.screenshot({ type: 'jpeg', quality: 50 });
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ 
                  type: 'STREAM_FRAME', 
                  frame: screenshot.toString('base64'),
                  metadata: {
                    deviceWidth: vp.width,
                    deviceHeight: vp.height,
                    pageScaleFactor: 1,
                    offsetTop: 0
                  }
                }));
              }
            }
          } catch (e) { logger.warn(`Stream send error for ${projectName}`, { error: String(e) }); }
          if ((ws as any).isStreaming) {
            (ws as any)._streamTimer = setTimeout(sendFrame, 200);
          }
        };
        (ws as any)._streamTimer = setTimeout(sendFrame, 0);
      }
    }
  }

  if (data.type === 'STOP_STREAM') {
    (ws as any).isStreaming = false;
    if ((ws as any)._cdpScreencast) {
      try {
        (ws as any)._cdpScreencast.send('Page.stopScreencast').catch(() => {});
        (ws as any)._cdpScreencast.detach().catch(() => {});
      } catch (_) {}
      delete (ws as any)._cdpScreencast;
    }
    if ((ws as any)._streamTimer) {
      clearTimeout((ws as any)._streamTimer);
      delete (ws as any)._streamTimer;
    }
  }
  
  if (data.type === 'STOP_BOT') {
    (ws as any).isBotRunning = false;
    await stopProject(projectName).catch(err => {
      logger.error(`Error stopping project ${projectName} on STOP_BOT`, err instanceof Error ? err : new Error(String(err)));
    });
  }

  if (data.type === 'LAUNCH_BROWSER') {
    if (data.settings) {
      session.botSettings = { ...session.botSettings, ...data.settings };
      session.photoDebugEnabled = session.botSettings.photoDebug !== false;
    }
    const width = session.botSettings?.width || session.botSettings?.browserWidth || 1280;
    const height = session.botSettings?.height || session.botSettings?.browserHeight || 720;
    connectToBrowser(
      session,
      width,
      height,
      session.botSettings?.profile,
      session.botSettings?.profileDir,
      session.botSettings?.proxy
    ).then(() => {
      logToClient(session, 'Браузер успішно запущено', 'success');
    }).catch(e => {
      logger.error(`Failed to launch browser for ${projectName}`, e instanceof Error ? e : new Error(String(e)));
      logToClient(session, `Помилка запуску: ${e.message}`, 'error');
    });
  }

  if (data.type === 'CLOSE_BROWSER') {
    browserLifecycle.closeBrowser(session).then(() => {
      logToClient(session, 'Браузер закрито', 'info');
    }).catch(e => {
      logger.error(`Failed to close browser for ${projectName}`, e instanceof Error ? e : new Error(String(e)));
      logToClient(session, `Помилка закриття браузера: ${e.message}`, 'error');
    });
  }

  if (data.type === 'ACTIVATE_PICKER' || data.type === 'START_PICKER') {
    try {
      const targetPage = await connectToBrowser(
        session,
        session.botSettings?.width || session.botSettings?.browserWidth,
        session.botSettings?.height || session.botSettings?.browserHeight,
        session.botSettings?.profile,
        session.botSettings?.profileDir,
        session.botSettings?.proxy
      );
      await injectPicker(session, targetPage, data.nodeId, data.pickType);
    } catch (err: any) { logToClient(session, `❌ ${err.message}`, 'error'); }
  }

  if (data.type === 'INTERACT_BROWSER') {
    const { x, y, relX, relY, action, button = 'left', clickCount = 1, deltaX, deltaY, key, text, url, delay } = data;
    if (isSessionBrowserAlive(session) && session.page) {
      try {
        const targetWidth = (session as any)._deviceWidth || session.page.viewportSize()?.width || 1280;
        const targetHeight = (session as any)._deviceHeight || session.page.viewportSize()?.height || 720;

        let px: number;
        let py: number;

        if (typeof relX === 'number' && relX >= 0 && relX <= 1) {
          px = Math.round(relX * targetWidth);
        } else if (typeof x === 'number') {
          px = x;
        } else {
          px = 0;
        }

        if (typeof relY === 'number' && relY >= 0 && relY <= 1) {
          py = Math.round(relY * targetHeight);
        } else if (typeof y === 'number') {
          py = y;
        } else {
          py = 0;
        }

        switch (action) {
          case 'hover':
          case 'move':
          case 'mousemove':
            await session.page.mouse.move(px, py);
            break;
          case 'mousedown':
            await session.page.mouse.move(px, py);
            await session.page.mouse.down({ button: button === 'right' ? 'right' : button === 'middle' ? 'middle' : 'left' });
            break;
          case 'mouseup':
            await session.page.mouse.move(px, py);
            await session.page.mouse.up({ button: button === 'right' ? 'right' : button === 'middle' ? 'middle' : 'left' });
            break;
          case 'click':
            await session.page.mouse.click(px, py, { 
              button: button === 'right' ? 'right' : button === 'middle' ? 'middle' : 'left', 
              clickCount,
              delay: delay || 50
            });
            break;
          case 'double_click':
          case 'dblclick':
            await session.page.mouse.dblclick(px, py, { button: button === 'right' ? 'right' : 'left' });
            break;
          case 'right_click':
          case 'contextmenu':
            await session.page.mouse.click(px, py, { button: 'right' });
            break;
          case 'ctrl_click':
            await session.page.keyboard.down('Control');
            await session.page.mouse.click(px, py, { button: 'left', delay: 50 });
            await session.page.keyboard.up('Control');
            break;
          case 'shift_click':
            await session.page.keyboard.down('Shift');
            await session.page.mouse.click(px, py, { button: 'left', delay: 50 });
            await session.page.keyboard.up('Shift');
            break;
          case 'scroll':
          case 'wheel':
            await session.page.mouse.move(px, py);
            await session.page.mouse.wheel(deltaX ?? 0, deltaY ?? 0);
            break;
          case 'scroll_up':
            await session.page.mouse.wheel(0, -(data.delta || 500));
            break;
          case 'scroll_down':
            await session.page.mouse.wheel(0, (data.delta || 500));
            break;
          case 'keydown':
            if (key) await session.page.keyboard.down(key);
            break;
          case 'keyup':
            if (key) await session.page.keyboard.up(key);
            break;
          case 'keypress':
            if (key) await session.page.keyboard.press(key);
            break;
          case 'type_text':
            if (text) await session.page.keyboard.type(text, { delay: delay || 15 });
            break;
          case 'esc':
            await session.page.keyboard.press('Escape');
            break;
          case 'enter':
            await session.page.keyboard.press('Enter');
            break;
          case 'backspace':
            await session.page.keyboard.press('Backspace');
            break;
          case 'tab':
            await session.page.keyboard.press('Tab');
            break;
          case 'reload':
            await session.page.reload().catch(() => {});
            break;
          case 'navigate':
          case 'goto':
            if (url) {
              const targetUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
              await session.page.goto(targetUrl).catch(() => {});
            }
            break;
          case 'go_back':
            await session.page.goBack().catch(() => {});
            break;
          case 'go_forward':
            await session.page.goForward().catch(() => {});
            break;
          default:
            await session.page.mouse.click(px, py, { button: 'left', delay: 50 });
            break;
        }
      } catch (interactErr) {
        logger.warn(`INTERACT_BROWSER error for ${projectName}`, { action, error: String(interactErr) });
      }
    }
  }

  if (data.type === 'OPEN_DEVTOOLS' || data.type === 'GET_PAGE_SOURCE') {
    try {
      if (isSessionBrowserAlive(session) && session.page) {
        const html = await session.page.content();
        const url = session.page.url();
        const title = await session.page.title();

        let elements: any[] = [];
        try {
          elements = await session.page.evaluate(() => {
            (window as any).__name = (window as any).__name || ((f: any) => f);
            const items: { tag: string; id: string; className: string; text: string; selector: string }[] = [];
            const all = document.querySelectorAll('button, input, select, textarea, a, canvas, [role="button"], [data-testid], [aria-label]');
            all.forEach((el) => {
              const tag = el.tagName.toLowerCase();
              const className = typeof el.className === 'string' ? el.className.trim() : '';
              const text = (el.textContent || '').trim().slice(0, 60);
              let selector = tag;
              if (el.id) selector = `#${CSS.escape(el.id)}`;
              else if (el.getAttribute('data-testid')) selector = `${tag}[data-testid="${el.getAttribute('data-testid')}"]`;
              else if (el.getAttribute('aria-label')) selector = `${tag}[aria-label="${el.getAttribute('aria-label')}"]`;
              else if (className) selector = `${tag}.${className.split(/\s+/).filter(Boolean).slice(0, 2).map(c => CSS.escape(c)).join('.')}`;
              items.push({ tag, id: el.id, className, text, selector });
            });
            return items.slice(0, 150);
          });
        } catch (_) {}

        ws.send(JSON.stringify({
          type: 'PAGE_SOURCE_DATA',
          projectName,
          url,
          title,
          html,
          elements
        }));
      } else {
        logToClient(session, 'Браузер не запущено. Запустіть браузер або трансляцію.', 'info');
      }
    } catch (e) {
      logger.warn(`OPEN_DEVTOOLS error for ${projectName}`, { error: String(e) });
      logToClient(session, 'Помилка отримання коду сторінки.', 'error');
    }
  }

  if (data.type === 'PICK_SELECTOR_BY_COORDS') {
    const { x, y, relX, relY, nodeId, pickType, isSmart } = data;
    if (isSessionBrowserAlive(session) && session.page) {
      try {
        const targetWidth = (session as any)._deviceWidth || session.page.viewportSize()?.width || 1280;
        const targetHeight = (session as any)._deviceHeight || session.page.viewportSize()?.height || 720;

        let px: number;
        let py: number;

        if (typeof relX === 'number' && relX >= 0 && relX <= 1) {
          px = Math.round(relX * targetWidth);
        } else if (typeof x === 'number') {
          px = x;
        } else {
          px = 0;
        }

        if (typeof relY === 'number' && relY >= 0 && relY <= 1) {
          py = Math.round(relY * targetHeight);
        } else if (typeof y === 'number') {
          py = y;
        } else {
          py = 0;
        }
        
        const info = await session.page.evaluate(({ cx, cy, nId, pType, smart }) => {
          (window as any).__name = (window as any).__name || ((f: any) => f);
          const el = document.elementFromPoint(cx, cy) as HTMLElement;
          if (!el) return null;
          
          const buildSelector = (target: HTMLElement): string => {
            if (target.id) return '#' + CSS.escape(target.id);
            
            const dataAttrs = ['data-testid', 'data-id', 'data-name', 'data-type', 'data-action'];
            for (const attr of dataAttrs) {
              const val = target.getAttribute(attr);
              if (val) {
                const sel = `${target.tagName.toLowerCase()}[${attr}="${val}"]`;
                if (document.querySelectorAll(sel).length === 1) return sel;
              }
            }
            
            const ariaLabel = target.getAttribute('aria-label');
            if (ariaLabel) {
              const sel = `${target.tagName.toLowerCase()}[aria-label="${ariaLabel}"]`;
              if (document.querySelectorAll(sel).length === 1) return sel;
            }
            
            if (target.className && typeof target.className === 'string') {
              const allClasses = target.className.trim().split(/\s+/).filter((c: string) => 
                c && !c.includes(':') && !c.includes('[') && c.length < 40
              );
              if (allClasses.length > 0) {
                const fullSel = `${target.tagName.toLowerCase()}.${allClasses.map(c => CSS.escape(c)).join('.')}`;
                if (document.querySelectorAll(fullSel).length === 1) return fullSel;
                
                for (const cls of allClasses) {
                  const sel = `${target.tagName.toLowerCase()}.${CSS.escape(cls)}`;
                  if (document.querySelectorAll(sel).length === 1) return sel;
                }
              }
            }
            
            if (target.tagName === 'IMG') {
              const src = target.getAttribute('src');
              if (src) {
                const lastPart = src.split('/').pop()?.split('?')[0];
                if (lastPart) {
                  const sel = `img[src*="${lastPart}"]`;
                  if (document.querySelectorAll(sel).length === 1) return sel;
                }
              }
            }
            
            const parts: string[] = [];
            let current: HTMLElement | null = target;
            while (current && current !== document.body && current !== document.documentElement) {
              let tag = current.tagName.toLowerCase();
              
              if (current.id) {
                parts.unshift(`#${CSS.escape(current.id)}`);
                break;
              }
              
              const classes = (current.className && typeof current.className === 'string') 
                ? current.className.trim().split(/\s+/).filter((c: string) => 
                    c && !c.includes(':') && !c.includes('[') && c.length < 40
                  ).slice(0, 2)
                : [];
              
              if (classes.length > 0) {
                tag += '.' + classes.map(c => CSS.escape(c)).join('.');
              }
              
              const parent = current.parentElement;
              if (parent) {
                const siblings = Array.from(parent.children).filter(
                  s => s.tagName === current!.tagName
                );
                if (siblings.length > 1) {
                  const idx = siblings.indexOf(current) + 1;
                  tag += `:nth-child(${idx})`;
                }
              }
              
              parts.unshift(tag);
              current = current.parentElement;
              if (parts.length >= 5) break;
            }
            
            const finalSel = parts.join(' > ');
            try {
              const found = document.querySelector(finalSel);
              if (found === target) return finalSel;
            } catch {}
            
            return finalSel || target.tagName.toLowerCase();
          };

          const buildSmartSelector = (target: HTMLElement): string => {
            if (target.id) return '#' + CSS.escape(target.id);
            
            const semanticAttrs = ['name', 'data-testid', 'placeholder', 'aria-label', 'role', 'title', 'alt'];
            for (const attr of semanticAttrs) {
              const val = target.getAttribute(attr);
              if (val) {
                const sel = `${target.tagName.toLowerCase()}[${attr}="${val}"]`;
                if (document.querySelectorAll(sel).length === 1) return sel;
              }
            }
            
            if ((target.tagName === 'BUTTON' || target.getAttribute('role') === 'button') && target.textContent) {
              const text = target.textContent.trim().substring(0, 30);
              if (text) {
                return buildSelector(target);
              }
            }
            
            return buildSelector(target);
          };
          
          const selector = smart ? buildSmartSelector(el) : buildSelector(el);
          
          let matchCount = 0;
          try { matchCount = document.querySelectorAll(selector).length; } catch { matchCount = -1; }
          
          // Підсвічуємо елемент прямо у вікні браузера
          try {
            const oldH = document.getElementById('__sf_active_highlight');
            if (oldH) oldH.remove();
            const r = el.getBoundingClientRect();
            const h = document.createElement('div');
            h.id = '__sf_active_highlight';
            h.style.cssText = `
              position: fixed;
              top: ${r.top}px;
              left: ${r.left}px;
              width: ${r.width}px;
              height: ${r.height}px;
              border: 2px solid #00ffcc;
              background: rgba(0, 255, 204, 0.2);
              box-shadow: 0 0 15px #00ffcc, inset 0 0 10px rgba(0, 255, 204, 0.3);
              z-index: 2147483647;
              pointer-events: none;
              border-radius: 4px;
            `;
            document.body.appendChild(h);
          } catch (_) {}

          const parents: { tag: string; selector: string; text?: string }[] = [];
          let pCurr = el.parentElement;
          while (pCurr && pCurr !== document.body && pCurr !== document.documentElement && parents.length < 6) {
            parents.push({
              tag: pCurr.tagName.toLowerCase(),
              selector: buildSelector(pCurr),
              text: pCurr.innerText?.trim().slice(0, 35) || undefined
            });
            pCurr = pCurr.parentElement;
          }

          // ─── Вкладені елементи всередині вибраного блоку ───
          const children: { tag: string; selector: string; text?: string; id?: string; className?: string }[] = [];
          const allDescendants = Array.from(el.querySelectorAll('*')) as HTMLElement[];
          for (const c of allDescendants.slice(0, 30)) {
            const cTag = c.tagName.toLowerCase();
            const cText = (c.innerText || c.textContent || '').trim().slice(0, 40);
            children.push({
              tag: cTag,
              selector: buildSelector(c),
              text: cText || undefined,
              id: c.id || undefined,
              className: (typeof c.className === 'string' && c.className.trim()) ? c.className.trim() : undefined
            });
          }

          // ─── Виявлення зображень у вибраному елементі та його дітях ───
          const images: {
            name: string;
            src: string;
            alt?: string;
            tag: string;
            selector: string;
            width?: number;
            height?: number;
          }[] = [];

          const seenSources = new Set<string>();
          const extractImageName = (url: string, fallback?: string): string => {
            if (!url) return fallback || 'image';
            if (url.startsWith('data:')) {
              return fallback ? `data: ${fallback}` : 'inline_data_image';
            }
            try {
              const urlObj = new URL(url, window.location.href);
              const fileName = urlObj.pathname.split('/').pop()?.split('?')[0];
              if (fileName && fileName.trim()) return decodeURIComponent(fileName);
            } catch {
              const clean = url.split('/').pop()?.split('?')[0]?.split('#')[0];
              if (clean && clean.trim()) return decodeURIComponent(clean);
            }
            return fallback || 'image';
          };

          const elementsToCheck = [el, ...allDescendants];
          for (const item of elementsToCheck) {
            if (images.length >= 25) break;
            const itemTag = item.tagName.toLowerCase();

            // 1. Тег <img>
            if (itemTag === 'img') {
              const img = item as HTMLImageElement;
              const rawSrc = img.currentSrc || img.getAttribute('src') || img.src || '';
              const alt = img.getAttribute('alt') || img.getAttribute('title') || '';
              const imgName = extractImageName(rawSrc, alt);
              const sel = buildSelector(img);
              const key = rawSrc || sel;
              if (!seenSources.has(key)) {
                seenSources.add(key);
                images.push({
                  name: imgName,
                  src: rawSrc,
                  alt: alt || undefined,
                  tag: 'img',
                  selector: sel,
                  width: img.naturalWidth || img.width || undefined,
                  height: img.naturalHeight || img.height || undefined,
                });
              }
            }

            // 2. CSS background-image
            try {
              const bgImg = window.getComputedStyle(item).backgroundImage;
              if (bgImg && bgImg !== 'none' && bgImg.includes('url(')) {
                const match = bgImg.match(/url\(['"]?(.*?)['"]?\)/);
                if (match && match[1]) {
                  const bgUrl = match[1];
                  if (!seenSources.has(bgUrl)) {
                    seenSources.add(bgUrl);
                    images.push({
                      name: extractImageName(bgUrl),
                      src: bgUrl,
                      tag: itemTag,
                      selector: buildSelector(item),
                      width: item.offsetWidth || undefined,
                      height: item.offsetHeight || undefined,
                    });
                  }
                }
              }
            } catch (_) {}

            // 3. SVG елементи
            if (itemTag === 'svg') {
              const ariaLabel = item.getAttribute('aria-label') || item.getAttribute('data-icon') || item.id || '';
              const svgUse = item.querySelector('use');
              const href = svgUse?.getAttribute('href') || svgUse?.getAttribute('xlink:href') || '';
              const svgName = ariaLabel || (href ? href.split('#').pop() : '') || 'SVG Icon';
              const sel = buildSelector(item);
              if (!seenSources.has(sel)) {
                seenSources.add(sel);
                images.push({
                  name: svgName || 'svg-icon',
                  src: '',
                  alt: ariaLabel || undefined,
                  tag: 'svg',
                  selector: sel,
                  width: item.clientWidth || undefined,
                  height: item.clientHeight || undefined,
                });
              }
            }
          }

          const attrs = Array.from(el.attributes || []).map(a => ({ name: a.name, value: a.value }));
          
          return { 
            nodeId: nId, 
            pickType: pType, 
            selector, 
            text: el.innerText?.substring(0, 50),
            matchCount,
            tag: el.tagName.toLowerCase(),
            outerHTML: el.outerHTML ? el.outerHTML.slice(0, 2500) : '',
            attributes: attrs,
            parents,
            children,
            images
          };
        }, { cx: px, cy: py, nId: nodeId, pType: pickType, smart: isSmart });
        
        if (info) {
          ws.send(JSON.stringify({ type: 'SELECTOR_INFO_PICKED', ...info }));
          if (info.matchCount > 1) {
            logToClient(session, `⚠️ Селектор "${info.selector}" знайшов ${info.matchCount} елементів — може бути неточним`, 'info');
          } else {
            logToClient(session, `✅ Вибрано: ${info.selector} (${info.tag})`, 'success');
          }
        }
      } catch (pickErr) {
        logger.warn(`PICK_SELECTOR_BY_COORDS error for ${projectName}`, { error: String(pickErr) });
      }
    }
  }

  if (data.type === 'HIGHLIGHT_SELECTOR') {
    const { selector } = data;
    if (isSessionBrowserAlive(session) && session.page) {
      try {
        const info = await session.page.evaluate((sel) => {
          const oldH = document.getElementById('__sf_active_highlight');
          if (oldH) oldH.remove();
          if (!sel) return null;
          try {
            const el = document.querySelector(sel) as HTMLElement;
            if (el) {
              const r = el.getBoundingClientRect();
              const isVisible = r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
              if (!isVisible) {
                try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
              }

              const newR = el.getBoundingClientRect();
              const h = document.createElement('div');
              h.id = '__sf_active_highlight';
              h.style.cssText = `
                position: fixed;
                top: ${newR.top}px;
                left: ${newR.left}px;
                width: ${newR.width}px;
                height: ${newR.height}px;
                border: 2px solid #00ffcc;
                background: rgba(0, 255, 204, 0.25);
                box-shadow: 0 0 20px #00ffcc, inset 0 0 10px rgba(0, 255, 204, 0.4);
                z-index: 2147483647;
                pointer-events: none;
                border-radius: 4px;
              `;
              document.body.appendChild(h);

              const buildSelector = (target: HTMLElement): string => {
                if (target.id) return '#' + CSS.escape(target.id);
                const dataAttrs = ['data-testid', 'data-id', 'data-name', 'data-type', 'data-action'];
                for (const attr of dataAttrs) {
                  const val = target.getAttribute(attr);
                  if (val) {
                    const s = `${target.tagName.toLowerCase()}[${attr}="${val}"]`;
                    if (document.querySelectorAll(s).length === 1) return s;
                  }
                }
                const ariaLabel = target.getAttribute('aria-label');
                if (ariaLabel) {
                  const s = `${target.tagName.toLowerCase()}[aria-label="${ariaLabel}"]`;
                  if (document.querySelectorAll(s).length === 1) return s;
                }
                if (target.className && typeof target.className === 'string') {
                  const allClasses = target.className.trim().split(/\s+/).filter((c: string) => 
                    c && !c.includes(':') && !c.includes('[') && c.length < 40
                  );
                  if (allClasses.length > 0) {
                    const fullSel = `${target.tagName.toLowerCase()}.${allClasses.map(c => CSS.escape(c)).join('.')}`;
                    if (document.querySelectorAll(fullSel).length === 1) return fullSel;
                    for (const cls of allClasses) {
                      const s = `${target.tagName.toLowerCase()}.${CSS.escape(cls)}`;
                      if (document.querySelectorAll(s).length === 1) return s;
                    }
                  }
                }
                if (target.tagName === 'IMG') {
                  const src = target.getAttribute('src');
                  if (src) {
                    const lastPart = src.split('/').pop()?.split('?')[0];
                    if (lastPart) {
                      const s = `img[src*="${lastPart}"]`;
                      if (document.querySelectorAll(s).length === 1) return s;
                    }
                  }
                }
                const parts: string[] = [];
                let current: HTMLElement | null = target;
                while (current && current !== document.body && current !== document.documentElement) {
                  let tag = current.tagName.toLowerCase();
                  if (current.id) {
                    parts.unshift(`#${CSS.escape(current.id)}`);
                    break;
                  }
                  const classes = (current.className && typeof current.className === 'string') 
                    ? current.className.trim().split(/\s+/).filter((c: string) => 
                        c && !c.includes(':') && !c.includes('[') && c.length < 40
                      ).slice(0, 2)
                    : [];
                  if (classes.length > 0) {
                    tag += '.' + classes.map(c => CSS.escape(c)).join('.');
                  }
                  const parent = current.parentElement;
                  if (parent) {
                    const siblings = Array.from(parent.children).filter(s => s.tagName === current!.tagName);
                    if (siblings.length > 1) {
                      const idx = siblings.indexOf(current) + 1;
                      tag += `:nth-child(${idx})`;
                    }
                  }
                  parts.unshift(tag);
                  current = current.parentElement;
                  if (parts.length >= 5) break;
                }
                const finalSel = parts.join(' > ');
                return finalSel || target.tagName.toLowerCase();
              };

              const attrs = Array.from(el.attributes || []).map(a => ({ name: a.name, value: a.value }));
              const parents: { tag: string; selector: string; text?: string }[] = [];
              let pCurr = el.parentElement;
              while (pCurr && pCurr !== document.body && pCurr !== document.documentElement && parents.length < 6) {
                parents.push({
                  tag: pCurr.tagName.toLowerCase(),
                  selector: buildSelector(pCurr),
                  text: pCurr.innerText?.trim().slice(0, 35) || undefined
                });
                pCurr = pCurr.parentElement;
              }

              const children: { tag: string; selector: string; text?: string; id?: string; className?: string }[] = [];
              const allDescendants = Array.from(el.querySelectorAll('*')) as HTMLElement[];
              for (const c of allDescendants.slice(0, 30)) {
                const cTag = c.tagName.toLowerCase();
                const cText = (c.innerText || c.textContent || '').trim().slice(0, 40);
                children.push({
                  tag: cTag,
                  selector: buildSelector(c),
                  text: cText || undefined,
                  id: c.id || undefined,
                  className: (typeof c.className === 'string' && c.className.trim()) ? c.className.trim() : undefined
                });
              }

              const images: {
                name: string;
                src: string;
                alt?: string;
                tag: string;
                selector: string;
                width?: number;
                height?: number;
              }[] = [];

              const seenSources = new Set<string>();
              const extractImageName = (url: string, fallback?: string): string => {
                if (!url) return fallback || 'image';
                if (url.startsWith('data:')) return fallback ? `data: ${fallback}` : 'inline_data_image';
                try {
                  const urlObj = new URL(url, window.location.href);
                  const fileName = urlObj.pathname.split('/').pop()?.split('?')[0];
                  if (fileName && fileName.trim()) return decodeURIComponent(fileName);
                } catch {
                  const clean = url.split('/').pop()?.split('?')[0]?.split('#')[0];
                  if (clean && clean.trim()) return decodeURIComponent(clean);
                }
                return fallback || 'image';
              };

              const elementsToCheck = [el, ...allDescendants];
              for (const item of elementsToCheck) {
                if (images.length >= 25) break;
                const itemTag = item.tagName.toLowerCase();
                if (itemTag === 'img') {
                  const img = item as HTMLImageElement;
                  const rawSrc = img.currentSrc || img.getAttribute('src') || img.src || '';
                  const alt = img.getAttribute('alt') || img.getAttribute('title') || '';
                  const imgName = extractImageName(rawSrc, alt);
                  const s = buildSelector(img);
                  const key = rawSrc || s;
                  if (!seenSources.has(key)) {
                    seenSources.add(key);
                    images.push({
                      name: imgName,
                      src: rawSrc,
                      alt: alt || undefined,
                      tag: 'img',
                      selector: s,
                      width: img.naturalWidth || img.width || undefined,
                      height: img.naturalHeight || img.height || undefined,
                    });
                  }
                }
                try {
                  const bgImg = window.getComputedStyle(item).backgroundImage;
                  if (bgImg && bgImg !== 'none' && bgImg.includes('url(')) {
                    const match = bgImg.match(/url\(['"]?(.*?)['"]?\)/);
                    if (match && match[1]) {
                      const bgUrl = match[1];
                      if (!seenSources.has(bgUrl)) {
                        seenSources.add(bgUrl);
                        images.push({
                          name: extractImageName(bgUrl),
                          src: bgUrl,
                          tag: itemTag,
                          selector: buildSelector(item),
                          width: item.offsetWidth || undefined,
                          height: item.offsetHeight || undefined,
                        });
                      }
                    }
                  }
                } catch (_) {}
                if (itemTag === 'svg') {
                  const ariaLabel = item.getAttribute('aria-label') || item.getAttribute('data-icon') || item.id || '';
                  const svgUse = item.querySelector('use');
                  const href = svgUse?.getAttribute('href') || svgUse?.getAttribute('xlink:href') || '';
                  const svgName = ariaLabel || (href ? href.split('#').pop() : '') || 'SVG Icon';
                  const s = buildSelector(item);
                  if (!seenSources.has(s)) {
                    seenSources.add(s);
                    images.push({
                      name: svgName || 'svg-icon',
                      src: '',
                      alt: ariaLabel || undefined,
                      tag: 'svg',
                      selector: s,
                      width: item.clientWidth || undefined,
                      height: item.clientHeight || undefined,
                    });
                  }
                }
              }

              let matchCount = 0;
              try { matchCount = document.querySelectorAll(sel).length; } catch { matchCount = -1; }

              return {
                selector: sel,
                tag: el.tagName.toLowerCase(),
                text: el.innerText?.substring(0, 50),
                matchCount,
                outerHTML: el.outerHTML ? el.outerHTML.slice(0, 2500) : '',
                attributes: attrs,
                parents,
                children,
                images
              };
            }
          } catch (_) {}
          return null;
        }, selector);

        if (info) {
          ws.send(JSON.stringify({ type: 'SELECTOR_INFO_PICKED', ...info }));
        }
      } catch (err) {
        logger.warn(`HIGHLIGHT_SELECTOR error for ${projectName}`, { selector, error: String(err) });
      }
    }
  }

  if (data.type === 'CLEAR_HIGHLIGHT') {
    if (isSessionBrowserAlive(session) && session.page) {
      try {
        await session.page.evaluate(() => {
          const oldH = document.getElementById('__sf_active_highlight');
          if (oldH) oldH.remove();
        });
      } catch (_) {}
    }
  }

  if (data.type === 'UPDATE_VARIABLE') {
    const { name, value } = data;
    if (name) {
      if (value === undefined || value === null) {
        delete session.globalVariables[name];
        logToClient(session, `🗑️ Змінна [${name}] видалена`, 'debug');
      } else {
        session.globalVariables[name] = value;
      }
      broadcastVariables(session);
    }
  }

  if (data.type === 'RUN_SINGLE_NODE' || data.type === 'RUN_BOT' || data.type === 'RUN_GROUP') {
    if (data.type === 'RUN_BOT' || data.type === 'RUN_GROUP') {
      if (session.isBotRunning) {
        logToClient(session, '❌ Бот вже працює! Зупиніть його перед новим запуском.', 'error');
        return;
      }

      // Перевірка режиму черги та ліміту паралельних проектів
      const { queueMode, maxParallel } = getQueueConfig();
      const currentRunning = getRunningProjectsCount();

      if (queueMode && currentRunning >= maxParallel) {
        const queuePos = projectQueueManager.getQueueLength() + 1;
        logToClient(session, `⏳ Режим черги: Досягнуто ліміт (${currentRunning}/${maxParallel} працюючих). Проект додано в чергу (позиція #${queuePos})...`, 'info');
        
        projectQueueManager.enqueue(
          projectName, 
          data.type === 'RUN_GROUP' ? [data.node?.id || data.node?.data?.title] : undefined,
          () => {
            logToClient(session, `▶️ Черга дійшла: запуск проекту ${projectName}...`, 'info');
          }
        );

        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ 
            type: 'BOT_QUEUED', 
            projectName, 
            queuePosition: queuePos, 
            maxParallel 
          }));
        }
        return;
      }

      session.isBotRunning = true;
      ws.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: true }));
    }

    const { node, settings } = data;
    let nodes = data.nodes;
    let edges = data.edges;
    if (!nodes || !edges || (nodes.length === 0 && data.type === 'RUN_BOT')) {
      try {
        const projPath = path.join(PROJECTS_DIR, `${projectName}.json`);
        const projContent = await fs.promises.readFile(projPath, 'utf-8');
        const projData = JSON.parse(projContent);
        if (!nodes || nodes.length === 0) nodes = projData.nodes || [];
        if (!edges || edges.length === 0) edges = projData.edges || [];
      } catch (loadProjErr) {
        logger.warn(`Failed to load nodes/edges from project file for ${projectName}`, { error: String(loadProjErr) });
        nodes = nodes || [];
        edges = edges || [];
      }
    }
    if (settings) {
      session.botSettings = { ...session.botSettings, ...settings };
      session.photoDebugEnabled = session.botSettings.photoDebug !== false;
    }
    try {
      const width = settings?.width || settings?.browserWidth || 1280;
      const height = settings?.height || settings?.browserHeight || 720;
      
      await ensureBrowserSettings(projectName, session);
      const activePage = await connectToBrowser(
        session,
        width,
        height,
        session.botSettings?.profile,
        session.botSettings?.profileDir,
        session.botSettings?.proxy
      );
      
      if (data.type === 'RUN_SINGLE_NODE') {
        (ws as any).isSingleNodeRun = true;
        (ws as any).isBotRunning = true;
        ws.send(JSON.stringify({ type: 'NODE_EXECUTING', nodeId: node.id }));
        try {
          await executeNodeLogic(node, activePage, ws, {}, nodes, edges);
        } catch (nodeErr: any) {
          logger.error(`executeNodeLogic failed for node ${node.id} in project ${projectName}`, nodeErr instanceof Error ? nodeErr : new Error(String(nodeErr)));
          logToClient(session, `❌ Помилка виконання ноди: ${nodeErr.message || nodeErr}`, 'error');
        }
        (ws as any).isBotRunning = false;
        (ws as any).isSingleNodeRun = false;
        ws.send(JSON.stringify({ type: 'BOT_FINISHED' }));
      } else {
        try {
          const projectPath = path.join(PROJECTS_DIR, `${projectName}.json`);
          const fileContent = await fs.promises.readFile(projectPath, 'utf-8');
          const saved = JSON.parse(fileContent);
          if (saved.variables) {
            session.globalVariables = { ...saved.variables };
            logToClient(session, '📂 Змінні завантажено з проекту', 'debug');
          }
        } catch (loadErr) {
          logger.warn(`Failed to load project variables for ${projectName}`, { error: String(loadErr) });
        }

        session.isBotRunning = true;

        const runId = RunLogger.createRun(projectName);
        session.currentRunId = runId;

        logToClient(session, data.type === 'RUN_GROUP' ? '🚀 Запуск контейнера...' : '🚀 Запуск сценарію...', 'success');
        
        nodes.forEach((n: any) => {
          if (n.type === 'gateNode' && n.data) {
            n.data.currentCount = 0;
          }
        });

        const startNode = data.type === 'RUN_GROUP'
          ? nodes.find((n: any) => n.type === 'subEntryNode')
          : nodes.find((n: any) => n.type === 'startNode');
        if (startNode) {
          const engine = new BotEngine({
            nodes, edges, activePage: session.page, ws,
            globalVariables: session.globalVariables,
            projectName,
            broadcastVariables: () => broadcastVariables(session),
            logToClient: (msg, type, logData) => logToClient(session, msg, type, logData), 
            takeDebugSnapshot: (nodeId, nodeTitle, highlight) => takeDebugSnapshot(session, nodeId, nodeTitle, highlight), 
            smartSleep, 
            nodeRuntimeState: session.nodeRuntimeState,
            checkRunning: () => session.isBotRunning,
            verboseLogs: session.botSettings?.verboseLogs !== false,
            nodeHandlers,
            onNodeDisplayUpdate: (nodeId, data) => {
              const msg = JSON.stringify({ type: 'UPDATE_NODE_DATA', nodeId, newData: data });
              if (session.activeWs && session.activeWs.readyState === 1) {
                session.activeWs.send(msg);
              }
            },
            onNodeExecuting: (nodeId, nodeTitle) => broadcastNodeExecuting(session, nodeId, nodeTitle),
            onFinished: (status, errorMessage) => {
              const finalStatus = status || 'success';
              if (finalStatus === 'success') {
                logToClient(session, '✅ Завершено', 'success');
              } else if (finalStatus === 'stopped') {
                logToClient(session, '🛑 Зупинено', 'info');
              } else {
                logToClient(session, `❌ Завершено з помилкою: ${errorMessage || 'невідома помилка'}`, 'error');
              }

              if (session.currentRunId) {
                RunLogger.finishRun(projectName, session.currentRunId, finalStatus, errorMessage, session.globalVariables);
                session.currentRunId = undefined;
              }
              session.isBotRunning = false;
              session.lastActiveNodeId = null;
              session.lastActiveNodeTitle = null;

              try {
                const statPath = path.join(PROJECTS_DIR, `${projectName}_stats.json`);
                fs.promises.readFile(statPath, 'utf-8')
                  .then(raw => {
                    try { return JSON.parse(raw); } catch { return []; }
                  })
                  .catch(() => [])
                  .then(stats => {
                    stats.push({ 
                      timestamp: Date.now(), 
                      status: finalStatus,
                      error: errorMessage,
                      snapshot: JSON.parse(JSON.stringify(session.globalVariables)) 
                    });
                    return fs.promises.writeFile(statPath, JSON.stringify(stats, null, 2));
                  })
                  .catch(writeErr => {
                    logger.error(`Failed to write stats for ${projectName}`, writeErr instanceof Error ? writeErr : new Error(String(writeErr)));
                  });
              } catch (err) { 
                logger.error(`Error saving stats for ${projectName}`, err instanceof Error ? err : new Error(String(err))); 
              }

              if (session.activeWs && session.activeWs.readyState === 1) {
                session.activeWs.send(JSON.stringify({ type: 'BOT_FINISHED', status: finalStatus, error: errorMessage }));
                session.activeWs.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: false }));
              }
              projectQueueManager.processNext();
            }
          });
          
          (ws as any).isSingleNodeRun = false;
          engine.run(startNode.id).catch(err => {
            logger.error(`Engine run error for ${projectName}`, err instanceof Error ? err : new Error(String(err)));
            logToClient(session, `❌ Критична помилка двигуна: ${err.message}`, 'error');
            if (session.currentRunId) {
              RunLogger.finishRun(projectName, session.currentRunId, 'error', err.message || String(err));
              session.currentRunId = undefined;
            }
            session.isBotRunning = false;
            session.lastActiveNodeId = null;
            session.lastActiveNodeTitle = null;
            if (session.activeWs && session.activeWs.readyState === 1) {
              session.activeWs.send(JSON.stringify({ type: 'BOT_FINISHED', status: 'error', error: err.message || String(err) }));
              session.activeWs.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: false }));
            }
            projectQueueManager.processNext();
          });
        } else {
           if (session.currentRunId) {
             RunLogger.finishRun(projectName, session.currentRunId, 'error', 'Стартову ноду не знайдено');
             session.currentRunId = undefined;
           }
           logToClient(session, data.type === 'RUN_GROUP'
             ? '❌ Помилка: у контейнері не знайдено вхідної ноди (subEntryNode)'
             : '❌ Помилка: ноду "Start" не знайдено', 'error');
           session.isBotRunning = false;
           session.lastActiveNodeId = null;
           session.lastActiveNodeTitle = null;
           ws.send(JSON.stringify({ type: 'BOT_FINISHED', status: 'error', error: 'Стартову ноду не знайдено' }));
           ws.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: false }));
           projectQueueManager.processNext();
        }
      }
    } catch (err: any) {
      logToClient(session, `❌ Помилка запуску: ${err.message}`, 'error');
      session.isBotRunning = false;
      ws.send(JSON.stringify({ type: 'BOT_FINISHED' }));
      projectQueueManager.processNext();
    }
  }
}
