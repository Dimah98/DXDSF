import { Logger } from '../logger';
import { NodeHandlerParams, NodeResult } from './types';
import { getOrCreateSession } from '../browserManager';

const logger = new Logger('BrowserResizeNode');

export const browserResizeNodeHandler = async ({
  currentNode,
  activePage,
  logToClient,
  context,
  projectName,
}: NodeHandlerParams): Promise<NodeResult> => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const {
    sizePreset = 'keep',
    width = 1280,
    height = 720,
    windowState = 'keep',
    zoomPercent = 100,
    zoomMode = 'both',
    waitDelay = 500,
  } = nodeData;

  const targetZoom = Number(zoomPercent) || 100;
  const targetW = Number(width) || 1280;
  const targetH = Number(height) || 720;
  const delayMs = Number(waitDelay) >= 0 ? Number(waitDelay) : 500;

  logToClient(
    `🖥️ Налаштування вікна [Розмір: ${sizePreset !== 'keep' ? `${targetW}×${targetH}` : 'без змін'}, Стан: ${windowState}, Зум: ${targetZoom}%]...`,
    'info'
  );

  try {
    const session = getOrCreateSession(projectName);

    // ── 1. Керування розміром та станом вікна через CDP ────────────────────
    if (session.context && (sizePreset !== 'keep' || windowState !== 'keep')) {
      const cdp = await session.context.newCDPSession(activePage);
      try {
        const { windowId } = await cdp.send('Browser.getWindowForTarget');

        if (windowState === 'maximized') {
          await cdp.send('Browser.setWindowBounds', {
            windowId,
            bounds: { windowState: 'maximized' },
          });
          logToClient(`🪟 Вікно розгорнуто (Maximized)`, 'success');
        } else if (windowState === 'fullscreen') {
          await cdp.send('Browser.setWindowBounds', {
            windowId,
            bounds: { windowState: 'fullscreen' },
          });
          logToClient(`📺 Вікно переведено у повний екран (Fullscreen)`, 'success');
        } else if (sizePreset !== 'keep') {
          // Якщо вікно було розгорнуто — спочатку скидаємо в normal
          await cdp.send('Browser.setWindowBounds', {
            windowId,
            bounds: { windowState: 'normal' },
          });

          // Отримуємо поточні межі та розмір viewport для компенсації заголовка/рамок
          const { bounds: currentBounds } = await cdp.send('Browser.getWindowBounds', { windowId });
          const innerSize = await activePage.evaluate(() => ({
            w: window.innerWidth,
            h: window.innerHeight,
          }));

          const chromeWidth = Math.max(0, (currentBounds.width || 0) - innerSize.w);
          const chromeHeight = Math.max(0, (currentBounds.height || 0) - innerSize.h);

          await cdp.send('Browser.setWindowBounds', {
            windowId,
            bounds: {
              width: targetW + chromeWidth,
              height: targetH + chromeHeight,
              windowState: 'normal',
            },
          });
          logToClient(`📐 Встановлено розмір вікна: ${targetW} × ${targetH} px`, 'success');
        }
      } catch (windowErr: any) {
        logger.warn('Failed to resize window via CDP', { error: String(windowErr) });
        logToClient(`⚠️ Не вдалося змінити межі вікна: ${windowErr.message}`, 'debug');
      } finally {
        await cdp.detach().catch(() => {});
      }
    }

    // ── 2. Керування збільшенням / масштабом (Zoom) ────────────────────────
    if (!isNaN(targetZoom) && targetZoom > 0) {
      const scaleFactor = targetZoom / 100;

      // Якщо явно обрано 'cdp' — використовуємо CDP setPageScaleFactor
      if (zoomMode === 'cdp') {
        if (session.context) {
          const cdp = await session.context.newCDPSession(activePage);
          try {
            await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: scaleFactor });
            logToClient(`🔍 CDP Page Scale Factor: ${scaleFactor}`, 'debug');
          } catch (cdpErr: any) {
            logger.debug('CDP setPageScaleFactor error', { error: String(cdpErr) });
          } finally {
            await cdp.detach().catch(() => {});
          }
        }
      } else {
        // Для режимів 'css' та 'both' (за замовчуванням):
        // 1. Нормалізуємо CDP scaleFactor до 1.0, щоб Playwright screenshot() НЕ конфліктував
        // і не скидав масштаб сторінки назад до 100% під час зчитування кадрів!
        if (session.context) {
          try {
            const cdp = await session.context.newCDPSession(activePage);
            await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.0 });
            await cdp.detach().catch(() => {});
          } catch (_) {}
        }

        // 2. Встановлюємо надійний CSS Zoom на documentElement та body
        await activePage.evaluate((zoom) => {
          const zoomStr = `${zoom}%`;
          if (document.documentElement) {
            (document.documentElement.style as any).zoom = zoomStr;
          }
          if (document.body) {
            (document.body.style as any).zoom = zoomStr;
          }
          // Сповіщаємо Phaser / Canvas про оновлення розмірів екрана
          window.dispatchEvent(new Event('resize'));
        }, targetZoom);
      }

      logToClient(`🔍 Збільшення браузера встановлено: ${targetZoom}%`, 'success');
    }

    // ── 3. Затримка на перемальовування гри ────────────────────────────────
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    return {
      data: {
        ...context,
        browserWidth: targetW,
        browserHeight: targetH,
        browserZoom: targetZoom,
      },
      nextHandle: [null, undefined, 'success'],
    };
  } catch (err: any) {
    logger.error('BrowserResizeNode failed', err);
    logToClient(`❌ Помилка налаштування вікна: ${err.message}`, 'error');
    return { data: context, nextHandle: ['error'] };
  }
};
