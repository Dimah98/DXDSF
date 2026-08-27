// Нода «Гра Послідовність» (SequenceMemoryNode)
// Автоматичне проходження міні-ігор на пам'ять спалахів (Simon Says)
// Комп'ютерний зір без page.evaluate: фіксація базового стану, детекція спалахів на 9 предметах,
// відстеження індикатора помилки та індикатора перемоги, послідовне відтворення кліків.

import { NodeHandlerParams } from './types';
import { Logger } from '../logger';
import { Page } from 'playwright';
import type WebSocket from 'ws';
import { parsePng, encodePng, PngData } from '../utils/pngParser';

const logger = new Logger('SequenceMemoryNode');

export interface TargetRegionConfig {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface IndicatorConfig extends TargetRegionConfig {
  enabled: boolean;
}

export interface RegionStats {
  meanR: number;
  meanG: number;
  meanB: number;
  meanL: number;
  pixelCount: number;
}

const DEFAULT_9_ITEMS: TargetRegionConfig[] = [
  { x: 100, y: 100, w: 80, h: 80 }, // 1 (0,0)
  { x: 220, y: 100, w: 80, h: 80 }, // 2 (0,1)
  { x: 340, y: 100, w: 80, h: 80 }, // 3 (0,2)
  { x: 100, y: 220, w: 80, h: 80 }, // 4 (1,0)
  { x: 220, y: 220, w: 80, h: 80 }, // 5 (1,1)
  { x: 340, y: 220, w: 80, h: 80 }, // 6 (1,2)
  { x: 100, y: 340, w: 80, h: 80 }, // 7 (2,0)
  { x: 220, y: 340, w: 80, h: 80 }, // 8 (2,1)
  { x: 340, y: 340, w: 80, h: 80 }, // 9 (2,2)
];

const DEFAULT_ERROR_INDICATOR: IndicatorConfig = {
  enabled: true,
  x: 50,
  y: 50,
  w: 40,
  h: 40,
};

const DEFAULT_SUCCESS_INDICATOR: IndicatorConfig = {
  enabled: true,
  x: 420,
  y: 50,
  w: 40,
  h: 40,
};

// ─── Допоміжні функції малювання для Фотодебагу ─────────────────────────────

function drawRect(
  pixels: Buffer,
  W: number,
  H: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number,
  thickness = 2
) {
  const minX = Math.max(0, Math.min(x0, x1));
  const maxX = Math.min(W - 1, Math.max(x0, x1));
  const minY = Math.max(0, Math.min(y0, y1));
  const maxY = Math.min(H - 1, Math.max(y0, y1));

  for (let t = 0; t < thickness; t++) {
    for (let x = minX; x <= maxX; x++) {
      if (minY + t < H) {
        const i1 = ((minY + t) * W + x) * 4;
        pixels[i1] = r; pixels[i1 + 1] = g; pixels[i1 + 2] = b; pixels[i1 + 3] = 255;
      }
      if (maxY - t >= 0) {
        const i2 = ((maxY - t) * W + x) * 4;
        pixels[i2] = r; pixels[i2 + 1] = g; pixels[i2 + 2] = b; pixels[i2 + 3] = 255;
      }
    }
    for (let y = minY; y <= maxY; y++) {
      if (minX + t < W) {
        const i1 = (y * W + (minX + t)) * 4;
        pixels[i1] = r; pixels[i1 + 1] = g; pixels[i1 + 2] = b; pixels[i1 + 3] = 255;
      }
      if (maxX - t >= 0) {
        const i2 = (y * W + (maxX - t)) * 4;
        pixels[i2] = r; pixels[i2 + 1] = g; pixels[i2 + 2] = b; pixels[i2 + 3] = 255;
      }
    }
  }
}

function drawDot(
  pixels: Buffer,
  W: number,
  H: number,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number
) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x < W && y >= 0 && y < H) {
        const i = (y * W + x) * 4;
        pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
      }
    }
  }
}

function drawCrosshair(
  pixels: Buffer,
  W: number,
  H: number,
  cx: number,
  cy: number,
  size: number,
  r: number,
  g: number,
  b: number,
  thickness = 2
) {
  for (let t = -Math.floor(thickness / 2); t <= Math.floor(thickness / 2); t++) {
    for (let dx = -size; dx <= size; dx++) {
      const x = cx + dx;
      const y = cy + t;
      if (x >= 0 && x < W && y >= 0 && y < H) {
        const i = (y * W + x) * 4;
        pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
      }
    }
    for (let dy = -size; dy <= size; dy++) {
      const x = cx + t;
      const y = cy + dy;
      if (x >= 0 && x < W && y >= 0 && y < H) {
        const i = (y * W + x) * 4;
        pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
      }
    }
  }
}

async function screenshotWithRetry(page: Page, options: any, retries = 3, delay = 800): Promise<Buffer> {
  for (let i = 0; i < retries; i++) {
    try {
      return await page.screenshot(options);
    } catch (err: any) {
      if (i < retries - 1) {
        logger.warn(`Screenshot retry (${i + 1}/${retries}): ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
      } else throw err;
    }
  }
  throw new Error('screenshotWithRetry: вичерпано спроби');
}

async function sendDebugPhoto(ws: WebSocket, label: string, nodeId: string, buf: Buffer): Promise<void> {
  if (!ws || (ws as any).readyState !== 1) return;
  try {
    const base64 = `data:image/png;base64,${buf.toString('base64')}`;
    (ws as any).send(JSON.stringify({
      type: 'DEBUG_SNAPSHOT',
      nodeId,
      nodeTitle: label,
      image: base64,
      timestamp: Date.now()
    }));
  } catch (e) {
    logger.warn('sendDebugPhoto failed', { error: String(e) });
  }
}

// ─── Комп'ютерний зір: обчислення показників області ────────────────────────

export function computeRegionStats(
  png: PngData,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): RegionStats {
  const startX = Math.max(0, Math.min(png.width - 1, rx));
  const startY = Math.max(0, Math.min(png.height - 1, ry));
  const endX = Math.min(png.width, startX + rw);
  const endY = Math.min(png.height, startY + rh);

  let sumR = 0, sumG = 0, sumB = 0, sumL = 0, count = 0;
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = (y * png.width + x) * 4;
      const r = png.pixels[idx];
      const g = png.pixels[idx + 1];
      const b = png.pixels[idx + 2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      sumR += r;
      sumG += g;
      sumB += b;
      sumL += l;
      count++;
    }
  }

  if (count === 0) {
    return { meanR: 0, meanG: 0, meanB: 0, meanL: 0, pixelCount: 0 };
  }

  return {
    meanR: sumR / count,
    meanG: sumG / count,
    meanB: sumB / count,
    meanL: sumL / count,
    pixelCount: count,
  };
}

// Перевірка чи область перебуває в активному стані (спалах)
export function isRegionLit(
  base: RegionStats,
  curr: RegionStats,
  thresholdFraction: number
): { lit: boolean; diffL: number; relL: number; colorDist: number } {
  const diffL = curr.meanL - base.meanL;
  const relL = diffL / Math.max(25, base.meanL);
  const dr = curr.meanR - base.meanR;
  const dg = curr.meanG - base.meanG;
  const db = curr.meanB - base.meanB;
  const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);

  const lit =
    relL >= thresholdFraction ||
    (diffL >= 30 && curr.meanL >= 70) ||
    colorDist >= 55;

  return { lit, diffL, relL, colorDist };
}

// ─── Головний обробник ноди ──────────────────────────────────────────────────

export const sequenceMemoryNodeHandler = async ({
  currentNode,
  activePage,
  ws,
  context,
  logToClient,
  smartSleep,
  checkRunning,
}: NodeHandlerParams) => {

  const nodeData = currentNode.data as Record<string, unknown>;
  const {
    items = DEFAULT_9_ITEMS,
    errorIndicator = DEFAULT_ERROR_INDICATOR,
    successIndicator = DEFAULT_SUCCESS_INDICATOR,
    flashThreshold = 0.25,        // Поріг спалаху (25% відхилення)
    flashSilenceTimeout = 1200,   // Час тиші для початку ходу гравця (мс)
    clickDelay = 200,             // Затримка між кліками послідовності (мс)
    checkInterval = 70,           // Інтервал опитування кадрів (мс)
    maxDuration = 120000,         // Максимальний час (мс)
    onErrorAction = 'reset',      // Дія при індикаторі помилки ('reset' або 'fail')
  } = nodeData;

  const threshold = typeof flashThreshold === 'number' ? flashThreshold : 0.25;
  const silenceTimeout = typeof flashSilenceTimeout === 'number' ? flashSilenceTimeout : 1200;
  const delayBetweenClicks = typeof clickDelay === 'number' ? clickDelay : 200;
  const intervalMs = typeof checkInterval === 'number' ? checkInterval : 70;
  const maxTimeMs = typeof maxDuration === 'number' ? maxDuration : 120000;

  // Отримуємо 9 предметів
  const activeItems: TargetRegionConfig[] = Array.isArray(items) && items.length === 9
    ? (items as TargetRegionConfig[])
    : DEFAULT_9_ITEMS;

  const errInd: IndicatorConfig = (errorIndicator as IndicatorConfig) || DEFAULT_ERROR_INDICATOR;
  const succInd: IndicatorConfig = (successIndicator as IndicatorConfig) || DEFAULT_SUCCESS_INDICATOR;

  logToClient(`✨ Гра «Послідовність»: старт калібрування...`, 'info');

  try {
    const dpr = await activePage.evaluate(() => window.devicePixelRatio || 1).catch(() => 1);
    logger.info(`SequenceMemory: DPR=${dpr}`);

    // Збираємо всі активні області для розрахунку загального прямокутника охоплення
    const allRegions: TargetRegionConfig[] = [...activeItems];
    if (errInd.enabled) allRegions.push(errInd);
    if (succInd.enabled) allRegions.push(succInd);

    const minClipX = Math.max(0, Math.min(...allRegions.map(r => r.x)));
    const minClipY = Math.max(0, Math.min(...allRegions.map(r => r.y)));
    const maxClipX = Math.max(...allRegions.map(r => r.x + r.w));
    const maxClipY = Math.max(...allRegions.map(r => r.y + r.h));
    const clipW = Math.max(20, maxClipX - minClipX);
    const clipH = Math.max(20, maxClipY - minClipY);

    const shotOptions = {
      type: 'png',
      clip: { x: minClipX, y: minClipY, width: clipW, height: clipH }
    };

    // ── Початковий знімок та калібрування Baseline ─────────────────────────
    const baseBuf = await screenshotWithRetry(activePage, shotOptions);
    const basePng = await parsePng(baseBuf);

    if (!basePng) {
      logToClient(`❌ Не вдалося розпарсити стартовий знімок поля`, 'error');
      return { data: context, nextHandle: ['error'] };
    }

    // Базові стани предметів
    const baseStatsItems: RegionStats[] = activeItems.map((item) => {
      const rx = Math.max(0, Math.round((item.x - minClipX) * dpr));
      const ry = Math.max(0, Math.round((item.y - minClipY) * dpr));
      const rw = Math.max(5, Math.min(basePng.width - rx, Math.round(item.w * dpr)));
      const rh = Math.max(5, Math.min(basePng.height - ry, Math.round(item.h * dpr)));
      return computeRegionStats(basePng, rx, ry, rw, rh);
    });

    // Базові стани індикаторів
    let baseStatsErr: RegionStats = { meanR: 0, meanG: 0, meanB: 0, meanL: 0, pixelCount: 0 };
    if (errInd.enabled) {
      const rx = Math.max(0, Math.round((errInd.x - minClipX) * dpr));
      const ry = Math.max(0, Math.round((errInd.y - minClipY) * dpr));
      const rw = Math.max(5, Math.min(basePng.width - rx, Math.round(errInd.w * dpr)));
      const rh = Math.max(5, Math.min(basePng.height - ry, Math.round(errInd.h * dpr)));
      baseStatsErr = computeRegionStats(basePng, rx, ry, rw, rh);
    }

    let baseStatsSucc: RegionStats = { meanR: 0, meanG: 0, meanB: 0, meanL: 0, pixelCount: 0 };
    if (succInd.enabled) {
      const rx = Math.max(0, Math.round((succInd.x - minClipX) * dpr));
      const ry = Math.max(0, Math.round((succInd.y - minClipY) * dpr));
      const rw = Math.max(5, Math.min(basePng.width - rx, Math.round(succInd.w * dpr)));
      const rh = Math.max(5, Math.min(basePng.height - ry, Math.round(succInd.h * dpr)));
      baseStatsSucc = computeRegionStats(basePng, rx, ry, rw, rh);
    }

    // Надсилаємо розмітку зон у Фотодебаг
    if (ws) {
      try {
        const gridPx = Buffer.from(basePng.pixels);
        // Малюємо 9 предметів (помаранчеві рамки з жовтими точками)
        for (let i = 0; i < activeItems.length; i++) {
          const item = activeItems[i];
          const x0 = Math.max(0, Math.round((item.x - minClipX) * dpr));
          const y0 = Math.max(0, Math.round((item.y - minClipY) * dpr));
          const x1 = Math.min(basePng.width - 1, Math.round((item.x + item.w - minClipX) * dpr) - 1);
          const y1 = Math.min(basePng.height - 1, Math.round((item.y + item.h - minClipY) * dpr) - 1);
          const cx = Math.round(x0 + (x1 - x0) / 2);
          const cy = Math.round(y0 + (y1 - y0) / 2);

          drawRect(gridPx, basePng.width, basePng.height, x0, y0, x1, y1, 245, 158, 11, 2);
          drawDot(gridPx, basePng.width, basePng.height, cx, cy, 3, 255, 255, 0);
        }

        // Малюємо Індикатор помилки (червона рамка)
        if (errInd.enabled) {
          const x0 = Math.max(0, Math.round((errInd.x - minClipX) * dpr));
          const y0 = Math.max(0, Math.round((errInd.y - minClipY) * dpr));
          const x1 = Math.min(basePng.width - 1, Math.round((errInd.x + errInd.w - minClipX) * dpr) - 1);
          const y1 = Math.min(basePng.height - 1, Math.round((errInd.y + errInd.h - minClipY) * dpr) - 1);
          drawRect(gridPx, basePng.width, basePng.height, x0, y0, x1, y1, 239, 68, 68, 2);
        }

        // Малюємо Індикатор перемоги (зелена рамка)
        if (succInd.enabled) {
          const x0 = Math.max(0, Math.round((succInd.x - minClipX) * dpr));
          const y0 = Math.max(0, Math.round((succInd.y - minClipY) * dpr));
          const x1 = Math.min(basePng.width - 1, Math.round((succInd.x + succInd.w - minClipX) * dpr) - 1);
          const y1 = Math.min(basePng.height - 1, Math.round((succInd.y + succInd.h - minClipY) * dpr) - 1);
          drawRect(gridPx, basePng.width, basePng.height, x0, y0, x1, y1, 34, 197, 94, 2);
        }

        const gridBuf = encodePng({ width: basePng.width, height: basePng.height, pixels: gridPx });
        await sendDebugPhoto(ws, '🎯 Розмітка: 9 предметів + 2 індикатори', currentNode.id, gridBuf);
      } catch (dbgErr) {
        logger.warn('Failed to send markup debug photo', { error: String(dbgErr) });
      }
    }

    logToClient(`✅ Калібрування завершено. Очікую послідовність спалахів...`, 'success');

    // ── Основний ігровий цикл ─────────────────────────────────────────────

    const startTime = Date.now();
    let currentSequence: number[] = []; // Записана послідовність (індекси 0..8)
    let lastFlashTime = 0;              // Час останнього виявленого спалаху
    let isLitState: boolean[] = new Array(9).fill(false); // Чи горить зараз предмет
    let totalCompletedRounds = 0;

    while (Date.now() - startTime < maxTimeMs && checkRunning()) {
      if (!checkRunning()) break;

      let frameBuf: Buffer;
      try {
        frameBuf = await screenshotWithRetry(activePage, shotOptions);
      } catch (e) {
        await smartSleep(intervalMs, ws);
        continue;
      }

      const framePng = await parsePng(frameBuf);
      if (!framePng) {
        await smartSleep(intervalMs, ws);
        continue;
      }

      // ── 1. Перевірка Індикатора Перемоги ─────────────────────────────────
      if (succInd.enabled) {
        const rx = Math.max(0, Math.round((succInd.x - minClipX) * dpr));
        const ry = Math.max(0, Math.round((succInd.y - minClipY) * dpr));
        const rw = Math.max(5, Math.min(framePng.width - rx, Math.round(succInd.w * dpr)));
        const rh = Math.max(5, Math.min(framePng.height - ry, Math.round(succInd.h * dpr)));
        const currSucc = computeRegionStats(framePng, rx, ry, rw, rh);
        const checkSucc = isRegionLit(baseStatsSucc, currSucc, threshold);

        if (checkSucc.lit) {
          logToClient(`🏆 Індикатор ПЕРЕМОГИ спалахнув! Міні-гру успішно пройдено!`, 'success');
          if (ws) {
            try {
              const winPx = Buffer.from(framePng.pixels);
              drawRect(winPx, framePng.width, framePng.height, rx, ry, rx + rw - 1, ry + rh - 1, 34, 197, 94, 3);
              const winBuf = encodePng({ width: framePng.width, height: framePng.height, pixels: winPx });
              await sendDebugPhoto(ws, '🏆 Фінал: Перемога!', currentNode.id, winBuf);
            } catch {}
          }
          return {
            data: { ...context, completedRounds: totalCompletedRounds + 1, value: totalCompletedRounds + 1 },
            nextHandle: [null, undefined, 'success'],
          };
        }
      }

      // ── 2. Перевірка Індикатора Помилки ──────────────────────────────────
      if (errInd.enabled) {
        const rx = Math.max(0, Math.round((errInd.x - minClipX) * dpr));
        const ry = Math.max(0, Math.round((errInd.y - minClipY) * dpr));
        const rw = Math.max(5, Math.min(framePng.width - rx, Math.round(errInd.w * dpr)));
        const rh = Math.max(5, Math.min(framePng.height - ry, Math.round(errInd.h * dpr)));
        const currErr = computeRegionStats(framePng, rx, ry, rw, rh);
        const checkErr = isRegionLit(baseStatsErr, currErr, threshold);

        if (checkErr.lit) {
          logToClient(`⚠️ Індикатор ПОМИЛКИ спалахнув!`, 'error');
          if (ws) {
            try {
              const errPx = Buffer.from(framePng.pixels);
              drawRect(errPx, framePng.width, framePng.height, rx, ry, rx + rw - 1, ry + rh - 1, 239, 68, 68, 3);
              const errDebugBuf = encodePng({ width: framePng.width, height: framePng.height, pixels: errPx });
              await sendDebugPhoto(ws, '⚠️ Помилка вводу!', currentNode.id, errDebugBuf);
            } catch {}
          }

          if (onErrorAction === 'fail') {
            return { data: context, nextHandle: ['error'] };
          } else {
            currentSequence = [];
            lastFlashTime = 0;
            isLitState.fill(false);
            await smartSleep(1000, ws);
            continue;
          }
        }
      }

      // ── 3. Сканування 9 предметів на спалахи ─────────────────────────────
      for (let i = 0; i < activeItems.length; i++) {
        const item = activeItems[i];
        const rx = Math.max(0, Math.round((item.x - minClipX) * dpr));
        const ry = Math.max(0, Math.round((item.y - minClipY) * dpr));
        const rw = Math.max(5, Math.min(framePng.width - rx, Math.round(item.w * dpr)));
        const rh = Math.max(5, Math.min(framePng.height - ry, Math.round(item.h * dpr)));

        const currStats = computeRegionStats(framePng, rx, ry, rw, rh);
        const { lit, diffL, relL } = isRegionLit(baseStatsItems[i], currStats, threshold);

        if (lit) {
          if (!isLitState[i]) {
            // Новий спалах предмета!
            isLitState[i] = true;
            currentSequence.push(i);
            lastFlashTime = Date.now();

            logToClient(
              `✨ Спалах: Предмет #${i + 1} (крок ${currentSequence.length}, +${Math.round(relL * 100)}% яскр., ΔL=${Math.round(diffL)})`,
              'info'
            );

            // Надсилаємо фото спалаху в Фотодебаг
            if (ws) {
              try {
                const flashPx = Buffer.from(framePng.pixels);
                // Яскрава неонова рамка
                drawRect(flashPx, framePng.width, framePng.height, rx, ry, rx + rw - 1, ry + rh - 1, 56, 189, 248, 3);
                const cx = Math.round(rx + rw / 2);
                const cy = Math.round(ry + rh / 2);
                drawCrosshair(flashPx, framePng.width, framePng.height, cx, cy, 8, 245, 158, 11, 2);

                const flashBuf = encodePng({ width: framePng.width, height: framePng.height, pixels: flashPx });
                await sendDebugPhoto(
                  ws,
                  `✨ Спалах: Предмет #${i + 1} (крок ${currentSequence.length})`,
                  currentNode.id,
                  flashBuf
                );
              } catch {}
            }
          }
        } else {
          // Предмет згас
          isLitState[i] = false;
        }
      }

      // ── 4. Перевірка настання тиші (хід гравця) ──────────────────────────
      const isCurrentlyAnyoneLit = isLitState.some(s => s === true);

      if (
        currentSequence.length > 0 &&
        !isCurrentlyAnyoneLit &&
        Date.now() - lastFlashTime >= silenceTimeout
      ) {
        // Демонстрація закінчилась! Час відтворювати кліки
        const seqCopy = [...currentSequence];
        logToClient(
          `🎯 Демонстрація завершена (${seqCopy.length} кроків): [${seqCopy.map(idx => `#${idx + 1}`).join(' ➔ ')}]`,
          'success'
        );
        logToClient(`▶️ Починаю відтворення послідовності...`, 'info');

        for (let step = 0; step < seqCopy.length; step++) {
          if (!checkRunning()) break;

          const itemIdx = seqCopy[step];
          const item = activeItems[itemIdx];
          const clickX = item.x + Math.round(item.w / 2);
          const clickY = item.y + Math.round(item.h / 2);

          logToClient(
            `👆 Клік [${step + 1}/${seqCopy.length}]: Предмет #${itemIdx + 1} (${clickX}, ${clickY})`,
            'info'
          );

          // Клікаємо по предмету
          await activePage.mouse.click(clickX, clickY);
          await smartSleep(delayBetweenClicks, ws);
        }

        totalCompletedRounds++;
        logToClient(`✅ Раунд #${totalCompletedRounds} введено! Очікую результат / наступний раунд...`, 'success');

        // Очищуємо послідовність для наступного раунду
        currentSequence = [];
        lastFlashTime = 0;
        isLitState.fill(false);

        // Коротка пауза для реакції гри
        await smartSleep(600, ws);
      }

      await smartSleep(intervalMs, ws);
    }

    // ── Час вийшов ────────────────────────────────────────────────────────
    logToClient(`⏱️ Завершено по таймауту (${maxTimeMs / 1000}с). Пройдено раундів: ${totalCompletedRounds}`, 'info');

    if (totalCompletedRounds > 0) {
      return {
        data: { ...context, completedRounds: totalCompletedRounds, value: totalCompletedRounds },
        nextHandle: [null, undefined, 'success'],
      };
    } else {
      return { data: context, nextHandle: ['error'] };
    }

  } catch (err: any) {
    logger.error(`SequenceMemory failed: ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)));
    logToClient(`❌ Помилка гри: ${err.message}`, 'error');
    return { data: context, nextHandle: ['error'] };
  }
};
