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

  return null;
}

// ─── Phaser Hook для гри Вдарь Крота (Direct Memory / Event Whacking) ────────

/**
 * Знаходить фрейм з активним екземпляром Phaser гри Whack-a-Mole (mine-whack)
 */
export async function findMolePhaserFrame(page: Page): Promise<{ targetFrame: any } | null> {
  const pages = (typeof (page as any).context === 'function' && page.context()) ? page.context().pages() : [page];

  for (const p of pages) {
    const frames = typeof p.frames === 'function' ? p.frames() : [p];
    const sorted = [...frames].sort((a, b) => {
      const aUrl = typeof a.url === 'function' ? a.url() : '';
      const bUrl = typeof b.url === 'function' ? b.url() : '';
      return (bUrl.includes('mine-whack') || bUrl.includes('mole') ? 1 : 0) -
             (aUrl.includes('mine-whack') || aUrl.includes('mole') ? 1 : 0);
    });

    for (const f of sorted) {
      try {
        const hasPhaser = await Promise.resolve(
          f.evaluate(`(() => {
            const win = window;
            let game = win.__PHASER_GAME__;
            if (!game && win.Phaser && Array.isArray(win.Phaser.GAMES) && win.Phaser.GAMES.length > 0) game = win.Phaser.GAMES[0];
            if (!game && win.game && win.game.scene) game = win.game;
            if (!game) {
              try {
                const rootEl = document.getElementById('root') || document.body.firstElementChild;
                if (rootEl) {
                  const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactContainer'));
                  if (fiberKey) {
                    const queue = [{ fiber: rootEl[fiberKey], depth: 0 }];
                    while (queue.length > 0) {
                      const item = queue.shift();
                      if (!item || item.depth > 30) continue;
                      const curr = item.fiber;
                      let s = curr.memoizedState;
                      while (s) {
                        if (s.memoizedState && s.memoizedState.current && s.memoizedState.current.scene) { game = s.memoizedState.current; break; }
                        if (s.memoizedState && s.memoizedState.scene) { game = s.memoizedState; break; }
                        s = s.next;
                      }
                      if (game) break;
                      if (curr.child) queue.push({ fiber: curr.child, depth: item.depth + 1 });
                      if (curr.sibling) queue.push({ fiber: curr.sibling, depth: item.depth });
                    }
                  }
                }
              } catch (_) {}
            }
            if (game) {
              win.__PHASER_GAME__ = game;
              let sc = null;
              if (game.scene && typeof game.scene.getScene === 'function') {
                sc = game.scene.getScene('mine-whack') || game.scene.getScene('whack-a-mole');
              }
              if (!sc && game.scene && Array.isArray(game.scene.scenes)) {
                for (let i = 0; i < game.scene.scenes.length; i++) {
                  const s = game.scene.scenes[i];
                  if (s && (s.sceneId === 'mine-whack' || s.sys?.settings?.key === 'mine-whack')) {
                    sc = s;
                    break;
                  }
                }
              }
              if (sc) return true;
            }
            return false;
          })()`)
        ).catch(() => false);

        if (hasPhaser) return { targetFrame: f };
      } catch (_) {}
    }
  }
  return null;
}

export interface PhaserMoleSolveResult {
  success: boolean;
  score: number;
  streak: number;
  whacked: number;
  rocks: number;
  irons: number;
  golds: number;
  bunniesAvoided: number;
  whiteHits?: number;
  targetWhiteHits?: number;
  screenTargetScore?: number;
  effectiveTargetScore?: number;
  error?: string;
}

/**
 * Автоматичне проходження гри Вдарь Крота через Phaser Hook безпосередньо у фреймі гри.
 * Розпізнає появу виключно корисних кротів (rock, iron, gold) та ігнорує зайців і порожні лунки.
 */
export async function solveWhackAMoleWithPhaserHook(
  targetFrame: any,
  logToClient: (msg: string, level?: 'info' | 'error' | 'success' | 'debug') => void,
  smartSleep: (ms: number, ws?: any) => Promise<void>,
  checkRunning: () => boolean,
  ws: any,
  targetScore = 0,
  reactionDelay = 50,
  maxDuration = 60000,
  autoStart = true
): Promise<PhaserMoleSolveResult> {
  const startTime = Date.now();

  logToClient(`⏳ Очікування завантаження сцени гри Вдарь Крота у Phaser...`, 'debug');

  // 1. Очікуємо готовності 9 лунок
  let isReady = false;
  while (Date.now() - startTime < Math.min(maxDuration, 15000)) {
    if (!checkRunning()) {
      return { success: false, score: 0, streak: 0, whacked: 0, rocks: 0, irons: 0, golds: 0, bunniesAvoided: 0, error: 'зупинено користувачем' };
    }

    const readyCheck: any = await Promise.resolve(
      targetFrame.evaluate(`(() => {
        const win = window;
        const game = win.__PHASER_GAME__;
        let sc = null;
        if (game && game.scene && typeof game.scene.getScene === 'function') {
          sc = game.scene.getScene('mine-whack') || game.scene.getScene('whack-a-mole');
        }
        if (!sc && game && game.scene && Array.isArray(game.scene.scenes)) {
          for (let i = 0; i < game.scene.scenes.length; i++) {
            const s = game.scene.scenes[i];
            if (s && (s.sceneId === 'mine-whack' || s.sys?.settings?.key === 'mine-whack')) {
              sc = s;
              break;
            }
          }
        }
        if (!sc) return { status: 'no_scene' };
        if (!Array.isArray(sc.holes) || sc.holes.length !== 9) return { status: 'waiting_holes' };
        return { status: 'ready', portalState: sc.portalService?.state?.value };
      })()`)
    ).catch(() => ({ status: 'error' }));

    if (readyCheck?.status === 'ready') {
      isReady = true;
      break;
    }
    await smartSleep(300, ws);
  }

  if (!isReady) {
    return { success: false, score: 0, streak: 0, whacked: 0, rocks: 0, irons: 0, golds: 0, bunniesAvoided: 0, error: 'сцена або 9 лунок не знайдені в Phaser' };
  }

  if (!checkRunning()) {
    return { success: false, score: 0, streak: 0, whacked: 0, rocks: 0, irons: 0, golds: 0, bunniesAvoided: 0, error: 'зупинено користувачем' };
  }

  // 2. Якщо гра ще в стані "introduction" або після поразки ("loser" / "winner" / "gameOver"), запускаємо гру
  if (autoStart) {
    const started = await Promise.resolve(
      targetFrame.evaluate(`(() => {
        const win = window;
        const game = win.__PHASER_GAME__;
        let sc = null;
        if (game && game.scene && typeof game.scene.getScene === 'function') {
          sc = game.scene.getScene('mine-whack') || game.scene.getScene('whack-a-mole');
        }
        if (!sc && game && game.scene && Array.isArray(game.scene.scenes)) {
          for (let i = 0; i < game.scene.scenes.length; i++) {
            const s = game.scene.scenes[i];
            if (s && (s.sceneId === 'mine-whack' || s.sys?.settings?.key === 'mine-whack')) {
              sc = s;
              break;
            }
          }
        }
        const ps = sc?.portalService;
        const pVal = ps?.state?.value;

        if (pVal === 'introduction') {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim().toLowerCase() === 'start');
          if (btn) {
            btn.click();
            return 'button_clicked';
          }
          try {
            ps.send('START', { duration: 6e4 });
            return 'event_sent';
          } catch (_) {}
        } else if (pVal === 'loser' || pVal === 'winner' || pVal === 'gameOver') {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim().toLowerCase().includes('play again'));
          if (btn) {
            btn.click();
            return 'retry_clicked';
          }
          try {
            if (ps && ps.state && ps.state.nextEvents && ps.state.nextEvents.includes('RETRY')) {
              ps.send('RETRY');
              return 'retry_event_sent';
            }
          } catch (_) {}
        }
        return 'already_started: ' + pVal;
      })()`)
    ).catch(() => 'error');

    if (started === 'button_clicked' || started === 'event_sent' || started === 'retry_clicked' || started === 'retry_event_sent') {
      const isRetry = String(started).includes('retry');
      logToClient(`▶️ Натиснуто кнопку запуску гри ("${isRetry ? 'Play Again' : 'Start'}"), очікую початку гри...`, 'info');
      await smartSleep(1000, ws);
    }
  }

  // 3. Інсталюємо автопілот безпосередньо у фрейм
  logToClient(`🧠 Phaser Hook: Запуск автопілоту (затримка реакції: ${reactionDelay}мс, ліміт: ${Math.round(maxDuration / 1000)}с)...`, 'success');

  const safeDelay = Number(reactionDelay) || 50;
  const configuredTarget = Number(targetScore) || 0;

  await Promise.resolve(
    targetFrame.evaluate(`(() => {
      const delayMs = ${safeDelay};
      const configuredTargetScore = ${configuredTarget};
      const win = window;
      const game = win.__PHASER_GAME__;
      let sc = null;
      if (game && game.scene && typeof game.scene.getScene === 'function') {
        sc = game.scene.getScene('mine-whack') || game.scene.getScene('whack-a-mole');
      }
      if (!sc && game && game.scene && Array.isArray(game.scene.scenes)) {
        for (let i = 0; i < game.scene.scenes.length; i++) {
          const s = game.scene.scenes[i];
          if (s && (s.sceneId === 'mine-whack' || s.sys?.settings?.key === 'mine-whack')) {
            sc = s;
            break;
          }
        }
      }

      if (win.__MOLE_AUTOPILOT__ && win.__MOLE_AUTOPILOT__.timer) {
        clearInterval(win.__MOLE_AUTOPILOT__.timer);
      }

      function detectScreenTargetScore() {
        try {
          const ps = sc?.portalService;
          const ctx = ps?.state?.context;
          if (ctx) {
            if (typeof ctx.targetScore === 'number' && ctx.targetScore > 0) return ctx.targetScore;
            if (typeof ctx.scoreToBeat === 'number' && ctx.scoreToBeat > 0) return ctx.scoreToBeat;
            if (typeof ctx.goalScore === 'number' && ctx.goalScore > 0) return ctx.goalScore;
            if (typeof ctx.minScore === 'number' && ctx.minScore > 0) return ctx.minScore;
          }
          if (typeof sc?.targetScore === 'number' && sc.targetScore > 0) return sc.targetScore;
          if (typeof sc?.scoreToBeat === 'number' && sc.scoreToBeat > 0) return sc.scoreToBeat;
        } catch (_) {}

        try {
          if (sc?.children?.list) {
            for (let i = 0; i < sc.children.list.length; i++) {
              const obj = sc.children.list[i];
              const txt = obj.text || (typeof obj.getText === 'function' ? obj.getText() : '');
              if (typeof txt === 'string' && /target\s*score/i.test(txt)) {
                const match = txt.match(/target\s*score\s*[:=]?\s*([\d,]+)/i);
                if (match) {
                  const val = parseInt(match[1].replace(/,/g, ''), 10);
                  if (!isNaN(val) && val > 0) return val;
                }
              }
              if (obj.list && Array.isArray(obj.list)) {
                for (let j = 0; j < obj.list.length; j++) {
                  const child = obj.list[j];
                  const childTxt = child.text || (typeof child.getText === 'function' ? child.getText() : '');
                  if (typeof childTxt === 'string' && /target\s*score/i.test(childTxt)) {
                    const match = childTxt.match(/target\s*score\s*[:=]?\s*([\d,]+)/i);
                    if (match) {
                      const val = parseInt(match[1].replace(/,/g, ''), 10);
                      if (!isNaN(val) && val > 0) return val;
                    }
                  }
                }
              }
            }
          }
        } catch (_) {}

        try {
          const docText = (win.document && win.document.body && win.document.body.innerText) || '';
          const m = docText.match(/target\s*score\s*[:=]?\s*([\d,]+)/i);
          if (m) {
            const val = parseInt(m[1].replace(/,/g, ''), 10);
            if (!isNaN(val) && val > 0) return val;
          }
        } catch (_) {}

        return 0;
      }

      const initialScreenTarget = detectScreenTargetScore();
      // Визначаємо випадкову кількість ударів по білому зайцю: 1 або 2 рази
      const targetWhiteHits = Math.floor(Math.random() * 2) + 1;

      const state = {
        whacked: 0,
        rocks: 0,
        irons: 0,
        golds: 0,
        bunniesAvoided: 0,
        whiteHits: 0,
        targetWhiteHits: targetWhiteHits,
        screenTargetScore: initialScreenTarget,
        effectiveTargetScore: initialScreenTarget > 0 ? (initialScreenTarget + 300) : (configuredTargetScore > 0 ? configuredTargetScore : 0),
        targetReached: false,
        score: 0,
        streak: 0,
        lives: 3,
        hasStartedPlaying: false,
        isPlaying: false,
        isGameOver: false,
        error: null
      };

      const emergedMap = new Map();

      const timer = setInterval(() => {
        try {
          if (!sc) return;
          const ps = sc.portalService;
          state.score = ps?.state?.context?.score || 0;
          state.streak = ps?.state?.context?.streak || 0;
          state.lives = ps?.state?.context?.lives ?? 3;
          const pVal = ps?.state?.value;

          if (sc.isGamePlaying || pVal === 'playing') {
            state.hasStartedPlaying = true;
            state.isPlaying = true;
          }

          if (state.hasStartedPlaying) {
            if (pVal === 'gameOver' || pVal === 'winner' || pVal === 'loser' || pVal === 'complete' || (sc.isGamePlaying === false && pVal !== 'playing')) {
              state.isGameOver = true;
              state.isPlaying = false;
            }
          }

          // Оновлюємо значення цільового рахунку з екрана, якщо з'явився пізніше
          if (state.screenTargetScore === 0) {
            const dynamicTarget = detectScreenTargetScore();
            if (dynamicTarget > 0) {
              state.screenTargetScore = dynamicTarget;
              state.effectiveTargetScore = dynamicTarget + 300;
            }
          }

          // Перевірка досягнення цілі (екран + 300)
          if (state.effectiveTargetScore > 0 && state.score >= state.effectiveTargetScore) {
            state.targetReached = true;
          }

          // Якщо ціль досягнуто або гра завершилася — припиняємо удари, даємо таймеру завершитись
          if (state.targetReached || state.isGameOver || !state.isPlaying) {
            emergedMap.clear();
            return;
          }

          const holes = sc.holes || [];
          const now = Date.now();

          for (let i = 0; i < holes.length; i++) {
            const h = holes[i];
            if (!h) continue;
            const st = h.getState ? h.getState() : h._state;
            const mole = h._mole;

            if (st === 'show' || st === 'idle' || st === 'hide') {
              if (mole === 'rock' || mole === 'iron' || mole === 'gold') {
                let firstSeen = emergedMap.get(i);
                if (!firstSeen) {
                  firstSeen = now;
                  emergedMap.set(i, firstSeen);
                }

                if (now - firstSeen >= delayMs) {
                  try {
                    if (h._hole && typeof h._hole.emit === 'function') {
                      h._hole.emit('pointerup');
                      state.whacked++;
                      if (mole === 'rock') state.rocks++;
                      if (mole === 'iron') state.irons++;
                      if (mole === 'gold') state.golds++;
                    }
                  } catch (_) {}
                  emergedMap.delete(i);
                }
              } else if (mole === 'white') {
                // Випадковий клік по білому зайцю 1-2 рази за гру (лише якщо є запас життів > 1 та очок >= 300)
                const canHitWhite = state.whiteHits < state.targetWhiteHits &&
                                    state.score >= 300 &&
                                    state.lives > 1;
                if (canHitWhite && Math.random() < 0.45) {
                  try {
                    if (h._hole && typeof h._hole.emit === 'function') {
                      h._hole.emit('pointerup');
                      state.whiteHits++;
                      state.whacked++;
                    }
                  } catch (_) {}
                  emergedMap.delete(i);
                } else {
                  state.bunniesAvoided++;
                  emergedMap.delete(i);
                }
              } else if (mole === 'orange') {
                // Помаранчевих зайців ніколи не чіпаємо
                state.bunniesAvoided++;
                emergedMap.delete(i);
              }
            } else {
              emergedMap.delete(i);
            }
          }
        } catch (err) {
          state.error = err.message;
        }
      }, 16);

      win.__MOLE_AUTOPILOT__ = { timer, state, sc };
      return { ok: true };
    })()`)
  ).catch(() => null);

  // 4. Основний цикл моніторингу в Node.js
  let lastScoreLogged = -1;
  let lastWhiteHitsLogged = 0;
  let targetReachedLogged = false;
  let finalState: any = { score: 0, streak: 0, whacked: 0, rocks: 0, irons: 0, golds: 0, bunniesAvoided: 0, whiteHits: 0, targetWhiteHits: 1 };

  try {
    while (Date.now() - startTime < maxDuration && checkRunning()) {
      if (!checkRunning()) break;

      await smartSleep(350, ws);

      const pollRes: any = await Promise.resolve(
        targetFrame.evaluate(`(() => {
          const win = window;
          return win.__MOLE_AUTOPILOT__ ? win.__MOLE_AUTOPILOT__.state : null;
        })()`)
      ).catch(() => null);

      if (pollRes) {
        finalState = pollRes;

        // Логуємо прогрес якщо рахунок збільшився
        if (pollRes.score !== lastScoreLogged && pollRes.score > 0) {
          lastScoreLogged = pollRes.score;
          const targetStr = pollRes.effectiveTargetScore > 0 ? ` (Ціль: ${pollRes.effectiveTargetScore})` : '';
          logToClient(`🔨 Очки: ${pollRes.score}${targetStr} (x${pollRes.streak} 🔥), Кроти: ${pollRes.whacked} [🪨:${pollRes.rocks} ⚙️:${pollRes.irons} 🪙:${pollRes.golds}], зайців оминуто: ${pollRes.bunniesAvoided}`, 'info');
        }

        // Логуємо клік по білому зайцю
        if (pollRes.whiteHits > lastWhiteHitsLogged) {
          lastWhiteHitsLogged = pollRes.whiteHits;
          logToClient(`🐰 [Людська поведінка] Випадковий клік по білому зайцю (${pollRes.whiteHits}/${pollRes.targetWhiteHits || 1})! Життів: ${pollRes.lives}`, 'info');
        }

        // Логуємо досягнення цілі
        if (pollRes.targetReached && !targetReachedLogged) {
          targetReachedLogged = true;
          const detail = pollRes.screenTargetScore > 0
            ? `екран: ${pollRes.screenTargetScore} + 300 = ${pollRes.effectiveTargetScore}`
            : `${pollRes.effectiveTargetScore}`;
          logToClient(`🎯 Цільовий рахунок досягнуто! (${pollRes.score} >= ${detail}). Удари припинено, очікую завершення раунду...`, 'success');
        }

        // Перевірка завершення гри
        if (pollRes.isGameOver) {
          logToClient(`🏁 Гру завершено рушієм`, 'success');
          break;
        }

        // Якщо вказано ручний targetScore без екранного і він досягнутий
        if (targetScore > 0 && pollRes.score >= targetScore && !pollRes.screenTargetScore) {
          logToClient(`🎯 Цільовий рахунок ${targetScore} досягнуто! Поточний: ${pollRes.score}`, 'success');
          break;
        }
      }
    }
  } finally {
    // Зупиняємо автопілот у сторінці
    await Promise.resolve(
      targetFrame.evaluate(`(() => {
        const win = window;
        if (win.__MOLE_AUTOPILOT__ && win.__MOLE_AUTOPILOT__.timer) {
          clearInterval(win.__MOLE_AUTOPILOT__.timer);
        }
      })()`)
    ).catch(() => null);
  }

  logToClient(`🎉 Підсумок: ${finalState.score} очок, ${finalState.whacked} кротів вдарено, ${finalState.whiteHits || 0} зайців зачеплено, ${finalState.bunniesAvoided} зайців оминуто!`, 'success');

  return {
    success: true,
    score: finalState.score,
    streak: finalState.streak,
    whacked: finalState.whacked,
    rocks: finalState.rocks,
    irons: finalState.irons,
    golds: finalState.golds,
    whiteHits: finalState.whiteHits || 0,
    targetWhiteHits: finalState.targetWhiteHits || 1,
    screenTargetScore: finalState.screenTargetScore || 0,
    effectiveTargetScore: finalState.effectiveTargetScore || 0,
    bunniesAvoided: finalState.bunniesAvoided
  };
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
    engineMode = 'auto',       // 'auto' | 'phaser' | 'vision'
    reactionDelay = 50,        // Затримка реакції Phaser Hook (мс)
    targetScore = 0,           // Цільовий рахунок (0 = до завершення гри)
    autoStart = true,          // Автоматично тиснути Start
    checkInterval = 400,       // Інтервал перевірки поля (мс)
    clickDelay = 150,          // Затримка після кліку (мс)
    matchThreshold = 0.72,     // Поріг схожості NCC для визнання крота
    maxDuration = 60000,       // Максимальний час роботи (мс)
    exitButtonTexts = '',      // Тексти кнопок завершення
    templateDir = '',          // Папка шаблонів (порожнє = авто mine/)
    photoDebug = false,        // 1. включити / виключити фото дебаг
    cellCooldown = 800,        // 2. кулдаун на комірки (мс)
    clickType = 'human',       // 3. вибір типу кліку ('human' | 'touch' | 'pointer' | 'fast')
  } = nodeData;

  const threshold = typeof matchThreshold === 'number' ? matchThreshold : 0.72;
  const isPhotoDebug = photoDebug === true;
  const cellCooldownMs = typeof cellCooldown === 'number' ? cellCooldown : 800;
  const selectedClickType = typeof clickType === 'string' ? clickType : 'human';

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

  logToClient(
    `🔨 Вдарь Крота: старт [Режим: ${
      engineMode === 'phaser' ? '🎮 Phaser Hook' : engineMode === 'vision' ? '👁️ Pixel Vision' : '⚡ Авто'
    }]...`,
    'info'
  );

  try {
    // ── Перша перевірка кнопок завершення ────────────────────────────────
    if (exitTexts.length > 0) {
      logToClient(`🔍 Перевіряю кнопки завершення (${exitTexts.length} варіантів, ${activePage.frames().length} фреймів)...`, 'debug');
    }
    const earlyExit = await checkExitButtons(activePage, exitTexts, logToClient, true);
    if (earlyExit) {
      logToClient(`🏁 Кнопка "${earlyExit}" вже на екрані — завершення`, 'success');
      return { data: { ...context, value: 0 }, nextHandle: [null, undefined, 'success'] };
    }

    // ── РЕЖИМ PHASER HOOK (Швидкий доступ через стан рушія Phaser) ────────────
    if (engineMode !== 'vision') {
      logToClient(`🔍 [Phaser Hook] Пошук рушія гри Вдарь Крота у фреймах...`, 'debug');
      let phaserInfo = await findMolePhaserFrame(activePage);

      // Якщо відразу не знайдено, даємо декілька спроб (до ~3 секунд) на появу фрейму гри
      if (!phaserInfo) {
        for (let attempt = 0; attempt < 6 && !phaserInfo && checkRunning(); attempt++) {
          await smartSleep(500, ws);
          phaserInfo = await findMolePhaserFrame(activePage);
        }
      }

      if (phaserInfo) {
        logToClient(`⚡ Знайдено рушій Phaser гри Вдарь Крота! Запуск швидкісного режиму Phaser Hook...`, 'success');
        const phaserRes = await solveWhackAMoleWithPhaserHook(
          phaserInfo.targetFrame,
          logToClient,
          smartSleep,
          checkRunning,
          ws,
          Number(targetScore) || 0,
          Number(reactionDelay) ?? 50,
          Number(maxDuration) || 60000,
          autoStart !== false
        );

        if (phaserRes.success) {
          logToClient(
            `🎉 Phaser Hook: успішно пройдено! Рахунок: ${phaserRes.score} (x${phaserRes.streak}), кротів: ${phaserRes.whacked} [🪨:${phaserRes.rocks} ⚙️:${phaserRes.irons} 🪙:${phaserRes.golds}], зайців оминуто: ${phaserRes.bunniesAvoided}`,
            'success'
          );

          // Пауза перед перевіркою кнопок завершення
          await smartSleep(1000, ws);
          const finalExit = await checkExitButtons(activePage, exitTexts, logToClient, true);
          if (finalExit) {
            logToClient(`🏁 Виявлено кнопку завершення "${finalExit}"`, 'success');
          }

          return {
            data: {
              ...context,
              score: phaserRes.score,
              streak: phaserRes.streak,
              totalClicks: phaserRes.whacked,
              whacked: phaserRes.whacked,
              rocks: phaserRes.rocks,
              irons: phaserRes.irons,
              golds: phaserRes.golds,
              whiteHits: phaserRes.whiteHits,
              screenTargetScore: phaserRes.screenTargetScore,
              bunniesAvoided: phaserRes.bunniesAvoided,
              value: phaserRes.score
            },
            nextHandle: [null, undefined, 'success'],
          };
        } else {
          // Якщо зупинено користувачем
          if (!checkRunning()) {
            return { data: context, nextHandle: ['error'] };
          }

          // Якщо вибрано суворо phaser режим
          if (engineMode === 'phaser') {
            logToClient(`❌ Помилка режиму Phaser Hook: ${phaserRes.error}`, 'error');
            return { data: context, nextHandle: ['error'] };
          }

          // Якщо auto — повертаємося до комп'ютерного зору
          logToClient(`⚠️ Phaser Hook не зміг завершити гру (${phaserRes.error}). Перемикаюсь на Pixel Vision...`, 'info');
        }
      } else {
        if (engineMode === 'phaser') {
          logToClient(`❌ Режим "Phaser Hook" увімкнено, але екземпляр гри Phaser не знайдено у відкритих сторінках/фреймах!`, 'error');
          return { data: context, nextHandle: ['error'] };
        }
        logToClient(`ℹ️ Phaser не знайдено (можливо інша версія або завантаження). Перемикаюсь на Pixel Vision...`, 'debug');
      }
    }

    // ── РЕЖИМ КОМП'ЮТЕРНОГО ЗОРУ (PIXEL VISION) ───────────────────────────
    logToClient(`📁 Папка шаблонів: ${resolvedTemplateDir}`, 'debug');

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

    // Відправляємо завантажені шаблони крота у Фотодебаг (тільки якщо увімкнено)
    if (isPhotoDebug && ws) {
      for (const tmpl of templates) {
        try {
          const tmplBuf = await encodePng(tmpl.data);
          await sendDebugPhoto(ws, `📁 Шаблон: ${tmpl.name} (${tmpl.data.width}×${tmpl.data.height})`, currentNode.id, tmplBuf);
        } catch {}
      }
    }

    // ── Діагностичний скріншот та розмітка 9 комірок (тільки якщо увімкнено фото-дебаг) ──
    if (isPhotoDebug && ws) {
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
          const gridBuf = await encodePng({ width: diagPng.width, height: diagPng.height, pixels: gridPx });
          await sendDebugPhoto(ws, '🎯 Розмітка 9 комірок (3×3)', currentNode.id, gridBuf);
        }
      } catch (e) { logToClient(`⚠️ Діагностичний скріншот не вдався`, 'debug'); }
    }

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
    // Карта для відстеження кулдауну кожної з 9 комірок
    const cellLastHitTimes = new Map<number, number>();

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
        // Перевіряємо кулдаун для комірки: якщо кріт тут уже був вдарений, не шукаємо знову поки анімація не завершиться
        const lastHit = cellLastHitTimes.get(i) || 0;
        if (Date.now() - lastHit < cellCooldownMs) {
          continue;
        }

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
        // Додаткова перевірка кулдауну комірки (щоб не бити двічі за один кадр)
        const lastHit = cellLastHitTimes.get(mole.cellIndex) || 0;
        if (Date.now() - lastHit < cellCooldownMs) {
          continue;
        }
        cellLastHitTimes.set(mole.cellIndex, Date.now());

        const cell = activeCells[mole.cellIndex];

        // Точні екранні координати центру виявленого крота у CSS-пікселях viewport
        const moleVpCenterX = minClipX + mole.centerX / dpr;
        const moleVpCenterY = minClipY + mole.centerY / dpr;

        // Природне невелике відхилення (±3 пікселі)
        const randJitterX = Math.round((Math.random() - 0.5) * 6);
        const randJitterY = Math.round((Math.random() - 0.5) * 6);
        const vpClickX = Math.round(moleVpCenterX + randJitterX);
        const vpClickY = Math.round(moleVpCenterY + randJitterY);

        logToClient(
          `🔨 [${selectedClickType.toUpperCase()}] Крот у комірці #${mole.cellIndex + 1} (${mole.row},${mole.col}) "${mole.templateName}" NCC=${Math.round(mole.score * 100)}% → клік (${vpClickX},${vpClickY})`,
          'success'
        );

        // ── 1. ВИКОНАННЯ КЛІКУ СПОЧАТКУ (БЕЗ ЖОДНИХ ЗАТРИМОК НА ФОТО-ДЕБАГ) ────
        if (selectedClickType === 'human') {
          // Природна затримка реакції людини (70-130 мс)
          await smartSleep(70 + Math.floor(Math.random() * 60), ws);

          // Плавне переміщення курсору до крота (5-8 кроків)
          await activePage.mouse.move(vpClickX, vpClickY, {
            steps: 5 + Math.floor(Math.random() * 4)
          });

          // Природне утримання натискання кнопки миші (50-80 мс)
          await activePage.mouse.down();
          await smartSleep(50 + Math.floor(Math.random() * 30), ws);
          await activePage.mouse.up();
        } else if (selectedClickType === 'touch') {
          // Сенсорний тап пальцем (мобільна емуляція)
          try {
            if (activePage.touchscreen) {
              await activePage.touchscreen.tap(vpClickX, vpClickY);
            } else {
              await activePage.mouse.click(vpClickX, vpClickY, { delay: 50 });
            }
          } catch {
            await activePage.mouse.click(vpClickX, vpClickY, { delay: 50 });
          }
        } else if (selectedClickType === 'pointer') {
          // Пряма диспетчеризація PointerEvent у Canvas
          try {
            await activePage.evaluate(({ x, y }) => {
              const el = document.elementFromPoint(x, y) || document.querySelector('canvas');
              if (!el) return;
              const opts = {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: x,
                clientY: y,
                screenX: x,
                screenY: y,
                button: 0,
                buttons: 1,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
                pressure: 0.5
              };
              el.dispatchEvent(new PointerEvent('pointerdown', opts));
              el.dispatchEvent(new MouseEvent('mousedown', opts));
              setTimeout(() => {
                el.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0, pressure: 0 }));
                el.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }));
                el.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }));
              }, 50);
            }, { x: vpClickX, y: vpClickY });
          } catch {
            await activePage.mouse.click(vpClickX, vpClickY, { delay: 50 });
          }
        } else {
          // 'fast': швидкий прямий клік з безпечним утриманням 50мс
          await activePage.mouse.click(vpClickX, vpClickY, { delay: 50 });
        }

        totalClicks++;
        clicksThisFrame++;

        // ── 2. ФОТО-ДЕБАГ ТІЛЬКИ ПІСЛЯ УДАРУ ТА ЯКЩО УВІМКНЕНО ────────────
        if (isPhotoDebug && ws) {
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

            const hitDebugBuf = await encodePng({ width: fieldPng.width, height: fieldPng.height, pixels: hitPx });
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
            const moleCropBuf = await encodePng(moleCrop);
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

        await smartSleep(clickDelay as number, ws);
      }

      // Періодичний лог прогресу та контрольний знімок
      if (frameCount % 10 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        logToClient(
          `📊 Прогрес: ${totalClicks} кротів за ${elapsed}с (${frameCount} кадрів, макс. збіг: ${Math.round(bestCandidate.score * 100)}% [${bestCandidate.name || '-'}])`,
          'info'
        );

        if (isPhotoDebug && ws && clicksThisFrame === 0) {
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
        if (isPhotoDebug && ws) {
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
