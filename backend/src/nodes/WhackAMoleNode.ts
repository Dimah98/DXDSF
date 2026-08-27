// Нода «Вдарь Крота» — автоматичне проходження міні-гри Whack-a-Mole
// Поле 3×3. Порівнює кожну клітинку зі зразками з папки mine/
// Весь аналіз зображень виконується в Node.js без page.evaluate

import { NodeHandlerParams } from './types'; // Типи параметрів обробника
import { Logger } from '../logger';           // Логер
import { Page } from 'playwright';            // Тип сторінки Playwright
import * as fs from 'fs';                     // Файлова система
import * as path from 'path';                 // Шляхи
import type WebSocket from 'ws';              // Тип WebSocket
import { parsePng, encodePng, PngData } from '../utils/pngParser';

const logger = new Logger('WhackAMoleNode'); // Ініціалізація логера

// Один завантажений шаблон крота з передпідрахованими непрозорими пікселями
interface OpaquePixel {
  tx: number;
  ty: number;
  g: number;
  r: number;
  g_val: number;
  b: number;
}

interface MoleTemplate {
  name: string;
  data: PngData;
  opaque: OpaquePixel[];
  n: number;
  meanT: number;
  stdT: number;
  sampled: OpaquePixel[];
  sn: number;
  sMeanT: number;
  sStdT: number;
}

// ─── Допоміжні функції малювання для Фотодебагу ─────────────────────────────

// Малює прямокутну рамку на RGBA пікселях
function drawRect(pixels: Buffer, W: number, H: number, x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, thickness = 2) {
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

// Малює заповнену точку на RGBA пікселях
function drawDot(pixels: Buffer, W: number, H: number, cx: number, cy: number, radius: number, r: number, g: number, b: number) {
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

// Малює приціл / хрестик на RGBA пікселях
function drawCrosshair(pixels: Buffer, W: number, H: number, cx: number, cy: number, size: number, r: number, g: number, b: number, thickness = 2) {
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

// ─── Допоміжні функції ───────────────────────────────────────────────────────

// Скріншот з повторними спробами при падінні контексту
async function screenshotWithRetry(page: Page, options: any, retries = 3, delay = 800): Promise<Buffer> {
  for (let i = 0; i < retries; i++) {
    try {
      return await page.screenshot(options); // Знімаємо екран
    } catch (err: any) {
      if (i < retries - 1) {
        logger.warn(`Screenshot failed (спроба ${i + 1}/${retries}): ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
      } else throw err;
    }
  }
  throw new Error('screenshotWithRetry: спроби вичерпані');
}

// Надсилає фото напряму у фотодебаг через WebSocket (без збереження у файл)
async function sendDebugPhoto(ws: WebSocket, label: string, nodeId: string, buf: Buffer): Promise<void> {
  if (!ws || (ws as any).readyState !== 1) return; // Перевіряємо з'єднання
  try {
    const base64 = `data:image/png;base64,${buf.toString('base64')}`; // Data URL
    (ws as any).send(JSON.stringify({ // Надсилаємо WebSocket повідомлення
      type: 'DEBUG_SNAPSHOT', // Тип для фотодебагу
      nodeId,                 // ID ноди
      nodeTitle: label,       // Підпис для відображення
      image: base64,          // Base64 зображення
      timestamp: Date.now()   // Мітка часу
    }));
  } catch (e) {
    logger.warn('sendDebugPhoto failed', { error: String(e) });
  }
}

// Вирізає прямокутник з RGBA пікселів та повертає новий PngData
function cropRegion(src: PngData, rx: number, ry: number, rw: number, rh: number): PngData {
  const clampX = Math.max(0, Math.min(src.width - 1, rx));
  const clampY = Math.max(0, Math.min(src.height - 1, ry));
  const clampW = Math.max(1, Math.min(src.width - clampX, rw));
  const clampH = Math.max(1, Math.min(src.height - clampY, rh));

  const pixels = Buffer.alloc(clampW * clampH * 4);
  for (let y = 0; y < clampH; y++) {
    for (let x = 0; x < clampW; x++) {
      const si = ((clampY + y) * src.width + (clampX + x)) * 4;
      const di = (y * clampW + x) * 4;
      pixels[di] = src.pixels[si];
      pixels[di + 1] = src.pixels[si + 1];
      pixels[di + 2] = src.pixels[si + 2];
      pixels[di + 3] = src.pixels[si + 3];
    }
  }
  return { width: clampW, height: clampH, pixels };
}

// Завантажує всі PNG шаблони з вказаної папки з виділенням непрозорих точок
async function loadTemplates(templateDir: string): Promise<MoleTemplate[]> {
  const templates: MoleTemplate[] = [];

  let files: string[] = [];
  try {
    const dirFiles = await fs.promises.readdir(templateDir);
    files = dirFiles.filter(f => f.toLowerCase().endsWith('.png')).sort();
  } catch {
    logger.warn(`Папка шаблонів не знайдена: ${templateDir}`);
    return templates;
  }

  for (const file of files) {
    const fullPath = path.join(templateDir, file);
    try {
      const buf = await fs.promises.readFile(fullPath);
      const data = await parsePng(buf);
      if (data && data.width > 0 && data.height > 0) {
        const opaque: OpaquePixel[] = [];
        let sumT = 0, sumTT = 0;

        for (let ty = 0; ty < data.height; ty++) {
          for (let tx = 0; tx < data.width; tx++) {
            const idx = (ty * data.width + tx) * 4;
            const a = data.pixels[idx + 3];
            if (a > 128) {
              const r = data.pixels[idx];
              const g_val = data.pixels[idx + 1];
              const b = data.pixels[idx + 2];
              const g = r * 0.299 + g_val * 0.587 + b * 0.114;
              opaque.push({ tx, ty, g, r, g_val, b });
              sumT += g;
              sumTT += g * g;
            }
          }
        }

        const n = opaque.length;
        if (n === 0) continue;

        const meanT = sumT / n;
        const stdT = Math.sqrt(sumTT / n - meanT * meanT);

        // Швидка вибірка точок (близько 25 точок) для попереднього швидкого проходу
        const stepSample = Math.max(1, Math.floor(n / 25));
        const sampled: OpaquePixel[] = [];
        let sSumT = 0, sSumTT = 0;
        for (let i = 0; i < n; i += stepSample) {
          sampled.push(opaque[i]);
          sSumT += opaque[i].g;
          sSumTT += opaque[i].g * opaque[i].g;
        }
        const sn = sampled.length;
        const sMeanT = sSumT / sn;
        const sStdT = Math.sqrt(sSumTT / sn - sMeanT * sMeanT);

        templates.push({ name: file, data, opaque, n, meanT, stdT, sampled, sn, sMeanT, sStdT });
        logger.info(`Завантажено шаблон: ${file} (${data.width}×${data.height}, непрозорих точок: ${n})`);
      }
    } catch (e) {
      logger.warn(`Не вдалося завантажити шаблон: ${file}`);
    }
  }

  return templates;
}

// Результат знайденого збігу крота
interface SearchMatch {
  templateName: string;
  score: number;
  relX: number;
  relY: number;
  w: number;
  h: number;
  centerX: number;
  centerY: number;
  row?: number;
  col?: number;
}

// 2D ковзний пошук шаблонів з урахуванням прозорості та ієрархічним прискоренням
function searchRegionForMoles(
  src: PngData,
  startX: number,
  startY: number,
  searchW: number,
  searchH: number,
  templates: MoleTemplate[],
  threshold: number,
  coarseStep = 3
): { matches: SearchMatch[]; bestCandidate: { name: string; score: number; x: number; y: number } } {
  const { width: W, pixels: canvas } = src;
  const matches: SearchMatch[] = [];
  let bestCandidate = { name: '', score: 0, x: 0, y: 0 };

  for (const tmpl of templates) {
    const { sampled, sn, sMeanT, sStdT, opaque, n, meanT, stdT, data } = tmpl;
    const tW = data.width, tH = data.height;
    if (tW > searchW || tH > searchH) continue;

    const maxY = startY + searchH - tH;
    const maxX = startX + searchW - tW;

    for (let y = startY; y <= maxY; y += coarseStep) {
      for (let x = startX; x <= maxX; x += coarseStep) {
        // Швидка оцінка по вибірці точок
        let sSumI = 0, sSumII = 0, sSumIT = 0;
        for (let i = 0; i < sn; i++) {
          const pt = sampled[i];
          const ci = ((y + pt.ty) * W + (x + pt.tx)) * 4;
          const g = canvas[ci] * 0.299 + canvas[ci + 1] * 0.587 + canvas[ci + 2] * 0.114;
          sSumI += g;
          sSumII += g * g;
          sSumIT += g * pt.g;
        }
        const sMeanI = sSumI / sn;
        const sStdI = Math.sqrt(sSumII / sn - sMeanI * sMeanI);
        if (sStdI > 1e-5 && sStdT > 1e-5) {
          const coarseNcc = (sSumIT / sn - sMeanI * sMeanT) / (sStdI * sStdT);
          if (coarseNcc > bestCandidate.score) {
            bestCandidate = { name: tmpl.name, score: coarseNcc, x, y };
          }

          // Якщо вибірка показує потенційний збіг — робимо точний прохід по всіх точках
          if (coarseNcc >= Math.max(0.45, threshold - 0.15)) {
            for (let ry = Math.max(startY, y - coarseStep + 1); ry <= Math.min(maxY, y + coarseStep - 1); ry++) {
              for (let rx = Math.max(startX, x - coarseStep + 1); rx <= Math.min(maxX, x + coarseStep - 1); rx++) {
                let sumI = 0, sumII = 0, sumIT = 0;
                for (let i = 0; i < n; i++) {
                  const pt = opaque[i];
                  const ci = ((ry + pt.ty) * W + (rx + pt.tx)) * 4;
                  const g = canvas[ci] * 0.299 + canvas[ci + 1] * 0.587 + canvas[ci + 2] * 0.114;
                  sumI += g;
                  sumII += g * g;
                  sumIT += g * pt.g;
                }
                const meanI = sumI / n;
                const stdI = Math.sqrt(sumII / n - meanI * meanI);
                if (stdI > 1e-5 && stdT > 1e-5) {
                  const ncc = (sumIT / n - meanI * meanT) / (stdI * stdT);
                  if (ncc > bestCandidate.score) {
                    bestCandidate = { name: tmpl.name, score: ncc, x: rx, y: ry };
                  }
                  if (ncc >= threshold) {
                    const cx = rx + Math.floor(tW / 2);
                    const cy = ry + Math.floor(tH / 2);
                    const isDup = matches.some(m => Math.hypot(m.centerX - cx, m.centerY - cy) < Math.min(tW, tH) * 0.8);
                    if (!isDup) {
                      matches.push({
                        templateName: tmpl.name,
                        score: ncc,
                        relX: rx,
                        relY: ry,
                        w: tW,
                        h: tH,
                        centerX: cx,
                        centerY: cy
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return { matches, bestCandidate };
}

// Перевіряє чи кнопки завершення присутні на сторінці або в iframe
async function checkExitButtons(
  activePage: Page,
  exitTexts: string[],
  logFn: (message: string, type?: 'info' | 'error' | 'success' | 'debug', data?: any) => void,
  verbose = false
): Promise<string | null> {
  if (exitTexts.length === 0) return null; // Список порожній — пропускаємо

  const isCssSelector = (s: string) => /[:.[\[#(>~+]/.test(s); // CSS-селектор?

  // Пошук в основній сторінці та всіх фреймах
  const findInPageAndFrames = async (
    fn: (ctx: { locator: (s: string) => any; getByText: (t: string, o?: any) => any; getByRole: (r: any, o?: any) => any }) => Promise<number>
  ): Promise<number> => {
    try { const c = await fn({ locator: s => activePage.locator(s), getByText: (t, o) => activePage.getByText(t, o), getByRole: (r, o) => activePage.getByRole(r, o) }); if (c > 0) return c; } catch {}
    for (const frame of activePage.frames()) {
      if (frame === activePage.mainFrame()) continue;
      try { const c = await fn({ locator: s => frame.locator(s), getByText: (t, o) => frame.getByText(t, o), getByRole: (r, o) => frame.getByRole(r, o) }); if (c > 0) return c; } catch {}
    }
    return 0;
  };

  for (const entry of exitTexts) { // Перевіряємо кожен варіант
    try {
      let count = 0;
      if (isCssSelector(entry)) { // CSS-селектор
        count = await findInPageAndFrames(async ({ locator }) => await locator(entry).count());
        if (verbose) logFn(`🔍 Селектор "${entry}": ${count} елем.`, 'debug');
      } else { // Текст
        const re = new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        count = await findInPageAndFrames(async ({ locator }) =>
          await locator('button, a, [role="button"], input[type="button"], input[type="submit"]').filter({ hasText: re }).count()
        );
        if (count === 0) count = await findInPageAndFrames(async ({ getByRole }) => await getByRole('button', { name: re }).count());
        if (count === 0) count = await findInPageAndFrames(async ({ getByText }) => await getByText(entry, { exact: false }).count());
        if (verbose) logFn(`🔍 Текст "${entry}": ${count} елем.`, 'debug');
      }
      if (count > 0) return entry; // Знайдено!
    } catch (err: any) {
      if (verbose) logFn(`⚠️ Помилка пошуку "${entry}": ${err.message}`, 'debug');
    }
  }
  return null; // Не знайдено
}

// ─── Головний обробник ноди ──────────────────────────────────────────────────

export interface MoleCellConfig {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_CELLS: MoleCellConfig[] = [
  { x: 100, y: 100, w: 100, h: 100 }, // 1 (0,0)
  { x: 220, y: 100, w: 100, h: 100 }, // 2 (0,1)
  { x: 340, y: 100, w: 100, h: 100 }, // 3 (0,2)
  { x: 100, y: 220, w: 100, h: 100 }, // 4 (1,0)
  { x: 220, y: 220, w: 100, h: 100 }, // 5 (1,1)
  { x: 340, y: 220, w: 100, h: 100 }, // 6 (1,2)
  { x: 100, y: 340, w: 100, h: 100 }, // 7 (2,0)
  { x: 220, y: 340, w: 100, h: 100 }, // 8 (2,1)
  { x: 340, y: 340, w: 100, h: 100 }, // 9 (2,2)
];

export const whackAMoleNodeHandler = async ({
  currentNode,    // Поточна нода з налаштуваннями
  activePage,     // Активна сторінка Playwright
  ws,             // WebSocket з'єднання
  context,        // Вхідний контекст
  logToClient,    // Функція логування на клієнт
  smartSleep,     // Пауза з підтримкою стопу
  checkRunning,   // Функція перевірки чи працює бот (для зупинки циклу)
}: NodeHandlerParams) => {

  // Зчитуємо налаштування ноди
  const nodeData = currentNode.data as Record<string, unknown>;
  const {
    checkInterval = 400,       // Інтервал перевірки поля (мс)
    clickDelay = 150,          // Затримка після кліку (мс)
    matchThreshold = 0.72,     // Поріг схожості NCC для визнання крота
    maxDuration = 60000,       // Максимальний час роботи (мс)
    exitButtonTexts = '',      // Тексти кнопок завершення
    templateDir = '',          // Папка шаблонів (порожнє = авто mine/)
  } = nodeData;

  const threshold = typeof matchThreshold === 'number' ? matchThreshold : 0.72;

  // Отримуємо конфігурацію 9 комірок
  let activeCells: MoleCellConfig[] = [];
  if (Array.isArray(nodeData.cells) && nodeData.cells.length === 9) {
    activeCells = nodeData.cells as MoleCellConfig[];
  } else if (nodeData.cropW && nodeData.cropH) {
    const cW = Math.floor((nodeData.cropW as number) / 3);
    const cH = Math.floor((nodeData.cropH as number) / 3);
    const cX = (nodeData.cropX as number) || 0;
    const cY = (nodeData.cropY as number) || 0;
    activeCells = [
      { x: cX, y: cY, w: cW, h: cH },
      { x: cX + cW, y: cY, w: cW, h: cH },
      { x: cX + cW * 2, y: cY, w: cW, h: cH },
      { x: cX, y: cY + cH, w: cW, h: cH },
      { x: cX + cW, y: cY + cH, w: cW, h: cH },
      { x: cX + cW * 2, y: cY + cH, w: cW, h: cH },
      { x: cX, y: cY + cH * 2, w: cW, h: cH },
      { x: cX + cW, y: cY + cH * 2, w: cW, h: cH },
      { x: cX + cW * 2, y: cY + cH * 2, w: cW, h: cH },
    ];
  } else {
    activeCells = DEFAULT_CELLS;
  }

  // Парсимо тексти кнопок завершення
  const exitTexts: string[] = String(exitButtonTexts)
    .split(/\n/).map(s => s.trim()).filter(Boolean);

  // Визначаємо папку шаблонів (за замовчуванням — mine/ у корені проєкту)
  const resolvedTemplateDir = (templateDir as string)
    ? path.resolve(templateDir as string)
    : path.resolve(process.cwd(), '..', 'mine');

  logToClient(`🔨 Вдарь Крота: старт...`, 'info');
  logToClient(`📁 Папка шаблонів: ${resolvedTemplateDir}`, 'debug');

  try {
    // ── Отримуємо Device Pixel Ratio ──────────────────────────────────────
    const dpr = await activePage.evaluate(() => window.devicePixelRatio || 1).catch(() => 1);
    logger.info(`WhackAMole: DPR=${dpr}`);

    // ── Завантаження шаблонів ─────────────────────────────────────────────
    const templates = await loadTemplates(resolvedTemplateDir);

    if (templates.length === 0) {
      logToClient(`❌ Шаблони крота не знайдено в: ${resolvedTemplateDir}`, 'error');
      return { data: context, nextHandle: ['error'] };
    }

    logToClient(`✅ Завантажено ${templates.length} шаблон(ів) крота (поріг NCC: ${Math.round(threshold * 100)}%)`, 'success');

    // Відправляємо завантажені шаблони крота у Фотодебаг
    if (ws) {
      for (const tmpl of templates) {
        try {
          const tmplBuf = encodePng(tmpl.data);
          await sendDebugPhoto(ws, `📁 Шаблон: ${tmpl.name} (${tmpl.data.width}×${tmpl.data.height})`, currentNode.id, tmplBuf);
        } catch {}
      }
    }

    // ── Перша перевірка кнопок завершення ────────────────────────────────
    if (exitTexts.length > 0) {
      logToClient(`🔍 Перевіряю кнопки завершення (${exitTexts.length} варіантів, ${activePage.frames().length} фреймів)...`, 'debug');
    }
    const earlyExit = await checkExitButtons(activePage, exitTexts, logToClient, true);
    if (earlyExit) {
      logToClient(`🏁 Кнопка "${earlyExit}" вже на екрані — завершення`, 'success');
      return { data: { ...context, value: 0 }, nextHandle: [null, undefined, 'success'] };
    }

    // ── Діагностичний скріншот та розмітка 9 комірок ──────────────────────
    try {
      const diagBuf = await screenshotWithRetry(activePage, { type: 'png' });
      await sendDebugPhoto(ws, '🔍 Стартовий скріншот вікна', currentNode.id, diagBuf);

      const diagPng = await parsePng(diagBuf);
      if (diagPng) {
        const gridPx = Buffer.from(diagPng.pixels);
        for (let i = 0; i < activeCells.length; i++) {
          const c = activeCells[i];
          const pxX0 = Math.max(0, Math.round(c.x * dpr));
          const pxY0 = Math.max(0, Math.round(c.y * dpr));
          const pxX1 = Math.min(diagPng.width - 1, Math.round((c.x + c.w) * dpr) - 1);
          const pxY1 = Math.min(diagPng.height - 1, Math.round((c.y + c.h) * dpr) - 1);
          const cx = Math.max(0, Math.min(diagPng.width - 1, Math.round((c.x + c.w / 2) * dpr)));
          const cy = Math.max(0, Math.min(diagPng.height - 1, Math.round((c.y + c.h / 2) * dpr)));

          drawRect(gridPx, diagPng.width, diagPng.height, pxX0, pxY0, pxX1, pxY1, 245, 158, 11, 2);
          drawDot(gridPx, diagPng.width, diagPng.height, cx, cy, 3, 0, 255, 255);
        }
        const gridBuf = encodePng({ width: diagPng.width, height: diagPng.height, pixels: gridPx });
        await sendDebugPhoto(ws, '🎯 Розмітка 9 комірок (3×3)', currentNode.id, gridBuf);
      }
    } catch (e) { logToClient(`⚠️ Діагностичний скріншот не вдався`, 'debug'); }

    // ── Розрахунок спільної області (bounding box) для захоплення ──────────
    const minClipX = Math.max(0, Math.min(...activeCells.map(c => c.x)));
    const minClipY = Math.max(0, Math.min(...activeCells.map(c => c.y)));
    const maxClipX = Math.max(...activeCells.map(c => c.x + c.w));
    const maxClipY = Math.max(...activeCells.map(c => c.y + c.h));
    const clipW = Math.max(20, maxClipX - minClipX);
    const clipH = Math.max(20, maxClipY - minClipY);

    // ── Основний ігровий цикл ─────────────────────────────────────────────

    const startTime = Date.now();
    let totalClicks = 0;
    let frameCount = 0;

    while (Date.now() - startTime < (maxDuration as number) && checkRunning()) {
      if (!checkRunning()) break;
      frameCount++;

      // Знімаємо скріншот області з 9 комірками
      const shotOptions = {
        type: 'png',
        clip: { x: minClipX, y: minClipY, width: clipW, height: clipH }
      };

      let fieldBuf: Buffer;
      try {
        fieldBuf = await screenshotWithRetry(activePage, shotOptions);
      } catch (e) {
        logToClient(`⚠️ Не вдалося зробити скріншот поля`, 'debug');
        await smartSleep(checkInterval as number, ws);
        continue;
      }

      // Розпарсуємо PNG в Node.js
      const fieldPng = await parsePng(fieldBuf);
      if (!fieldPng) {
        await smartSleep(checkInterval as number, ws);
        continue;
      }

      // ── Пошук кротів у кожній з 9 комірок окремо ────────────────────────
      let matches: Array<SearchMatch & { cellIndex: number }> = [];
      let bestCandidate = { name: '', score: 0, x: 0, y: 0 };

      for (let i = 0; i < activeCells.length; i++) {
        const cell = activeCells[i];
        const row = Math.floor(i / 3);
        const col = i % 3;

        // Координати комірки відносно знятого фрагмента (у пікселях зображення)
        const relCellX = Math.max(0, Math.round((cell.x - minClipX) * dpr));
        const relCellY = Math.max(0, Math.round((cell.y - minClipY) * dpr));
        const relCellW = Math.max(10, Math.min(fieldPng.width - relCellX, Math.round(cell.w * dpr)));
        const relCellH = Math.max(10, Math.min(fieldPng.height - relCellY, Math.round(cell.h * dpr)));

        const res = searchRegionForMoles(fieldPng, relCellX, relCellY, relCellW, relCellH, templates, threshold, 2);
        if (res.bestCandidate.score > bestCandidate.score) {
          bestCandidate = res.bestCandidate;
        }

        for (const m of res.matches) {
          matches.push({
            ...m,
            row,
            col,
            cellIndex: i
          });
        }
      }

      let clicksThisFrame = 0;

      // ── Клікаємо по всіх знайдених кротах ───────────────────────────────
      for (const mole of matches) {
        const cell = activeCells[mole.cellIndex];

        // Розраховуємо випадкову точку в межах всієї площі комірки (з відступом 10% від країв)
        const marginX = Math.max(2, Math.floor(cell.w * 0.1));
        const marginY = Math.max(2, Math.floor(cell.h * 0.1));
        const usableW = Math.max(1, cell.w - 2 * marginX);
        const usableH = Math.max(1, cell.h - 2 * marginY);
        const randOffsetX = marginX + Math.floor(Math.random() * usableW);
        const randOffsetY = marginY + Math.floor(Math.random() * usableH);

        // Екранні координати кліку у CSS пікселях viewport
        const vpClickX = cell.x + randOffsetX;
        const vpClickY = cell.y + randOffsetY;

        logToClient(
          `🔨 Крот у комірці #${mole.cellIndex + 1} (${mole.row},${mole.col}) шаблон="${mole.templateName}" NCC=${Math.round(mole.score * 100)}% → клік (${vpClickX},${vpClickY}) [зсув +${randOffsetX},+${randOffsetY}]`,
          'success'
        );

        // Відправляємо фото удару в Фотодебаг
        if (ws) {
          try {
            const hitPx = Buffer.from(fieldPng.pixels);
            // Зелена рамка навколо виявленого крота
            drawRect(hitPx, fieldPng.width, fieldPng.height, mole.relX, mole.relY, mole.relX + mole.w - 1, mole.relY + mole.h - 1, 0, 255, 128, 3);

            // Янтарна рамка всієї комірки
            const cellRelX = Math.max(0, Math.round((cell.x - minClipX) * dpr));
            const cellRelY = Math.max(0, Math.round((cell.y - minClipY) * dpr));
            const cellRelW = Math.round(cell.w * dpr);
            const cellRelH = Math.round(cell.h * dpr);
            drawRect(hitPx, fieldPng.width, fieldPng.height, cellRelX, cellRelY, cellRelX + cellRelW - 1, cellRelY + cellRelH - 1, 245, 158, 11, 1);

            // Червоний приціл точно в місці фактичного кліку
            const hitPixelX = Math.max(0, Math.min(fieldPng.width - 1, Math.round((vpClickX - minClipX) * dpr)));
            const hitPixelY = Math.max(0, Math.min(fieldPng.height - 1, Math.round((vpClickY - minClipY) * dpr)));
            drawCrosshair(hitPx, fieldPng.width, fieldPng.height, hitPixelX, hitPixelY, 10, 255, 50, 50, 2);

            const hitDebugBuf = encodePng({ width: fieldPng.width, height: fieldPng.height, pixels: hitPx });
            await sendDebugPhoto(
              ws,
              `🔨 Удар: Комірка #${mole.cellIndex + 1} (${mole.row},${mole.col}) • ${mole.templateName} (${Math.round(mole.score * 100)}%)`,
              currentNode.id,
              hitDebugBuf
            );

            // Окремий виріз самого крота
            const moleCrop = cropRegion(
              fieldPng,
              Math.max(0, mole.relX - 5),
              Math.max(0, mole.relY - 5),
              Math.min(fieldPng.width - mole.relX, mole.w + 10),
              Math.min(fieldPng.height - mole.relY, mole.h + 10)
            );
            const moleCropBuf = encodePng(moleCrop);
            await sendDebugPhoto(
              ws,
              `🦔 Крот #${mole.cellIndex + 1} (${mole.row},${mole.col}) • ${mole.templateName}`,
              currentNode.id,
              moleCropBuf
            );
          } catch (dbgErr) {
            logger.warn('Failed to send mole hit debug photo', { error: String(dbgErr) });
          }
        }

        await activePage.mouse.click(vpClickX, vpClickY);
        await smartSleep(clickDelay as number, ws);
        totalClicks++;
        clicksThisFrame++;
      }

      // Періодичний лог прогресу та контрольний знімок
      if (frameCount % 10 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        logToClient(
          `📊 Прогрес: ${totalClicks} кротів за ${elapsed}с (${frameCount} кадрів, макс. збіг: ${Math.round(bestCandidate.score * 100)}% [${bestCandidate.name || '-'}])`,
          'info'
        );

        if (ws && clicksThisFrame === 0) {
          try {
            await sendDebugPhoto(
              ws,
              `👀 Сканування 9 комірок (кадр ${frameCount} • макс. ${Math.round(bestCandidate.score * 100)}% [${bestCandidate.name || '-'}])`,
              currentNode.id,
              fieldBuf
            );
          } catch {}
        }
      }

      // Перевіряємо кнопки завершення після кожної ітерації
      const exitFound = await checkExitButtons(activePage, exitTexts, logToClient, frameCount <= 3);
      if (exitFound) {
        logToClient(`🏁 Виявлено кнопку завершення "${exitFound}" після ${totalClicks} кліків`, 'success');
        if (ws) {
          try {
            const exitBuf = await screenshotWithRetry(activePage, { type: 'png' });
            await sendDebugPhoto(ws, `🏁 Фінал гри: "${exitFound}" (${totalClicks} кліків)`, currentNode.id, exitBuf);
          } catch {}
        }
        return {
          data: { ...context, totalClicks, frameCount, value: totalClicks },
          nextHandle: [null, undefined, 'success'], // Зелений порт
        };
      }

      await smartSleep(checkInterval as number, ws);
    }

    // ── Час вийшов ────────────────────────────────────────────────────────
    logToClient(`⏱️ Час вийшов (${(maxDuration as number) / 1000}с). Всього кліків: ${totalClicks}`, 'info');

    if (totalClicks > 0) {
      return {
        data: { ...context, totalClicks, frameCount, value: totalClicks },
        nextHandle: [null, undefined, 'success'],
      };
    } else {
      return { data: context, nextHandle: ['error'] };
    }

  } catch (err: any) {
    logger.error(`WhackAMole failed: ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)));
    logToClient(`❌ Помилка гри: ${err.message}`, 'error');
    return { data: context, nextHandle: ['error'] };
  }
};
