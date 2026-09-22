// Нода «Капча (Quick Check / Drag & Rotate)»
// Автоматичне виявлення та проходження обох типів капчі у Sunflower Land:
// 1. Jigsaw Puzzle: перетягування культури у порожній силует («Drag the crop into the empty slot»)
// 2. Rotate Puzzle: повертання предмета до вертикального положення («Rotate the item until it is upright, then submit»)

import { NodeHandlerParams, NodeResult } from './types';
import { Page } from 'playwright';

export type CaptchaType = 'jigsaw' | 'rotate';

export interface CaptchaNodeConfig {
  skipIfNotFound?: boolean;    // Якщо капчі немає на екрані — пропустити без помилки (за замовчуванням true)
  timeout?: number;           // Час очікування появи капчі у мс, якщо skipIfNotFound=false (за замовчуванням 5000)
  dragDurationMs?: number;    // Тривалість перетягування у мс для Jigsaw (за замовчуванням 400)
  dragSteps?: number;         // Кількість проміжних точок перетягування (за замовчуванням 30)
  autoClickContinue?: boolean;// Автоматично натискати кнопку «Continue» після успіху (за замовчуванням true)
  maxRetries?: number;        // Кількість спроб при осічці (за замовчуванням 2)
}

export interface CaptchaCoordinatesResult {
  detected: boolean;
  crop?: string | null;
  piecePos?: { x: number; y: number };
  targetPos?: { x: number; y: number };
  startClient?: { x: number; y: number };
  endClient?: { x: number; y: number };
  canvasRect?: { left: number; top: number; width: number; height: number };
  error?: string;
}

export interface RotateCaptchaState {
  detected: boolean;
  collectible?: string | null;
  currentDeg: number;
  step: number; // 0..7
  clicksNeeded: { dir: 'left' | 'right'; count: number };
  error?: string;
}

export interface CaptchaDetectResult {
  present: boolean;
  type?: CaptchaType;
}

export interface CaptchaSolveResult {
  success: boolean;
  solved: boolean;
  skipped: boolean;
  captchaType?: CaptchaType;
  crop?: string | null;
  durationMs: number;
  error?: string;
}

/**
 * Перевіряє, чи присутнє на сторінці активне вікно капчі та визначає її тип.
 */
export async function detectCaptchaType(page: Page): Promise<CaptchaDetectResult> {
  try {
    return await page.evaluate(() => {
      const text = document.body.innerText || '';
      const hasQuickCheck = text.includes('Quick check') || text.includes('Complete this challenge');

      // Перевірка Rotate Captcha
      const hasRotateText = text.includes('Rotate the item') || text.includes('upright');
      const rotateImg = document.querySelector('img[style*="rotate"]');
      const hasArrowButtons = !!document.querySelector('button img[src*="arrow_left"]') && !!document.querySelector('button img[src*="arrow_right"]');

      if (hasRotateText || (rotateImg && hasArrowButtons)) {
        return { present: true, type: 'rotate' as const };
      }

      // Перевірка Jigsaw / Drag Puzzle
      const canvas = document.querySelector('canvas.cursor-pointer');
      const hasDragText = text.includes('Drag the crop') || text.includes('empty slot');

      if (canvas || hasDragText || (hasQuickCheck && canvas)) {
        return { present: true, type: 'jigsaw' as const };
      }

      if (hasQuickCheck) {
        // Якщо модалка є, але специфічні маркери ще завантажуються
        if (document.querySelector('button img[src*="arrow_"]')) {
          return { present: true, type: 'rotate' as const };
        }
        return { present: true, type: 'jigsaw' as const };
      }

      return { present: false };
    });
  } catch {
    return { present: false };
  }
}

/**
 * Для зворотної сумісності.
 */
export async function isCaptchaPresent(page: Page): Promise<boolean> {
  const res = await detectCaptchaType(page);
  return res.present;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. РОЗВ'ЯЗАННЯ JIGSAW CAPTCHA (ПЕРЕТЯГУВАННЯ КУЛЬТУРИ В СИЛУЕТ)
// ─────────────────────────────────────────────────────────────────────────────

export async function getCaptchaCoordinates(page: Page): Promise<CaptchaCoordinatesResult> {
  try {
    return await page.evaluate(() => {
      const canvas = document.querySelector('canvas.cursor-pointer') as HTMLCanvasElement | null;
      if (!canvas) {
        return { detected: false, error: 'Canvas капчі не знайдено' };
      }

      const rect = canvas.getBoundingClientRect();
      const CANVAS_WIDTH = canvas.width || 300;
      const CANVAS_HEIGHT = canvas.height || 150;
      const PIECE_SIZE = 36;
      const scaleX = rect.width / CANVAS_WIDTH;
      const scaleY = rect.height / CANVAS_HEIGHT;

      let piecePos: { x: number; y: number } | null = null;
      let targetPos: { x: number; y: number } | null = null;
      let crop: string | null = null;

      // Спроба зчитування через React Fiber
      try {
        const fiberKey = Object.keys(canvas).find(k => k.startsWith('__reactFiber'));
        if (fiberKey) {
          let f = (canvas as any)[fiberKey];
          let comp = f?.return;
          while (comp && (!comp.memoizedState || comp.type === 'div')) {
            comp = comp.return;
          }

          if (comp && comp.memoizedState) {
            let h = comp.memoizedState;
            while (h) {
              const stateVal = h.memoizedState;
              if (typeof stateVal === 'string' && stateVal.length > 2 && stateVal.length < 30) {
                if (!crop) crop = stateVal;
              } else if (stateVal && typeof stateVal === 'object') {
                const targetObj = ('current' in stateVal && stateVal.current && typeof stateVal.current === 'object')
                  ? stateVal.current
                  : stateVal;

                if (typeof targetObj?.x === 'number' && typeof targetObj?.y === 'number') {
                  if (targetObj.x <= 50) {
                    piecePos = { x: targetObj.x, y: targetObj.y };
                  } else if (targetObj.x >= 120) {
                    targetPos = { x: targetObj.x, y: targetObj.y };
                  }
                }
              }
              h = h.next;
            }
          }
        }
      } catch {}

      // Резервний аналіз пікселів Canvas
      if (!piecePos || !targetPos) {
        try {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const imgData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            const data = imgData.data;

            let minSilX = Infinity, maxSilX = -Infinity;
            let minSilY = Infinity, maxSilY = -Infinity;
            let silPixelsCount = 0;

            for (let y = 0; y < CANVAS_HEIGHT; y++) {
              for (let x = 0; x < CANVAS_WIDTH; x++) {
                const idx = (y * CANVAS_WIDTH + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const a = data[idx + 3];

                if (a > 200) {
                  const dr = Math.abs(r - 62);
                  const dg = Math.abs(g - 39);
                  const db = Math.abs(b - 49);
                  if (dr <= 18 && dg <= 18 && db <= 18) {
                    if (x < minSilX) minSilX = x;
                    if (x > maxSilX) maxSilX = x;
                    if (y < minSilY) minSilY = y;
                    if (y > maxSilY) maxSilY = y;
                    silPixelsCount++;
                  }
                }
              }
            }

            if (silPixelsCount > 30 && minSilX < Infinity) {
              targetPos = { x: minSilX, y: minSilY };
            }

            if (!piecePos) {
              piecePos = { x: 15, y: Math.round((CANVAS_HEIGHT - PIECE_SIZE) / 2) };
            }
          }
        } catch {}
      }

      if (!piecePos || !targetPos) {
        return {
          detected: true,
          error: 'Не вдалося визначити точні координати деталей капчі'
        };
      }

      const pieceCenterX = piecePos.x + PIECE_SIZE / 2;
      const pieceCenterY = piecePos.y + PIECE_SIZE / 2;
      const targetCenterX = targetPos.x + PIECE_SIZE / 2;
      const targetCenterY = targetPos.y + PIECE_SIZE / 2;

      return {
        detected: true,
        crop: crop || 'Crop',
        piecePos,
        targetPos,
        startClient: {
          x: rect.left + pieceCenterX * scaleX,
          y: rect.top + pieceCenterY * scaleY
        },
        endClient: {
          x: rect.left + targetCenterX * scaleX,
          y: rect.top + targetCenterY * scaleY
        },
        canvasRect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        }
      };
    });
  } catch (err: any) {
    return { detected: false, error: err.message };
  }
}

async function solveJigsawCaptcha(
  page: Page,
  config: CaptchaNodeConfig,
  log: (msg: string, type?: 'info' | 'error' | 'success' | 'debug') => void
): Promise<{ success: boolean; crop?: string | null; error?: string }> {
  const maxRetries = config.maxRetries ?? 2;
  const dragSteps = config.dragSteps ?? 30;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const coords = await getCaptchaCoordinates(page);
    if (!coords.detected || !coords.startClient || !coords.endClient) {
      log(`⚠️ Спроба ${attempt}/${maxRetries}: ${coords.error || 'помилка виявлення координат'}`, 'error');
      if (attempt < maxRetries) {
        await page.waitForTimeout(500);
        continue;
      }
      return { success: false, error: coords.error || 'Не вдалося визначити координати деталей' };
    }

    log(`🎯 Jigsaw: ${coords.crop || 'Crop'} | Старт: (${Math.round(coords.startClient.x)}, ${Math.round(coords.startClient.y)}) ➔ Ціль: (${Math.round(coords.endClient.x)}, ${Math.round(coords.endClient.y)})`, 'info');

    try {
      await page.mouse.move(coords.startClient.x, coords.startClient.y);
      await page.waitForTimeout(60 + Math.random() * 40);
      await page.mouse.down();
      await page.waitForTimeout(40 + Math.random() * 30);

      await page.mouse.move(coords.endClient.x, coords.endClient.y, { steps: dragSteps });
      await page.waitForTimeout(60 + Math.random() * 40);

      await page.mouse.up();
      log('✋ Перетягування завершено, перевірка результату...', 'info');
    } catch (dragErr: any) {
      log(`⚠️ Помилка перетягування: ${dragErr.message}`, 'error');
    }

    // Очікування успіху
    for (let check = 0; check < 10; check++) {
      await page.waitForTimeout(300);
      const state = await page.evaluate(() => {
        const text = document.body.innerText || '';
        const hasSuccess = text.includes('Success!') || text.includes('Correct!');
        const continueBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Continue'));
        const canvas = document.querySelector('canvas.cursor-pointer');
        return { hasSuccess, hasContinueBtn: !!continueBtn, hasCanvas: !!canvas };
      });

      if (state.hasSuccess || state.hasContinueBtn || !state.hasCanvas) {
        return { success: true, crop: coords.crop };
      }
    }

    log(`⚠️ Спроба ${attempt}/${maxRetries} не завершилася успіхом, повторна спроба...`, 'debug');
    await page.waitForTimeout(600);
  }

  return { success: false, error: 'Капча не підтвердила правильність перетягування' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. РОЗВ'ЯЗАННЯ ROTATE CAPTCHA (ПОВЕРТАННЯ ДО ВЕРТИКАЛЬНОГО ПОЛОЖЕННЯ)
// ─────────────────────────────────────────────────────────────────────────────

export async function getRotateCaptchaState(page: Page): Promise<RotateCaptchaState> {
  try {
    return await page.evaluate(() => {
      const img = document.querySelector('img[style*="rotate"]') as HTMLImageElement | null;
      if (!img) {
        return {
          detected: false,
          currentDeg: 0,
          step: 0,
          clicksNeeded: { dir: 'right', count: 0 },
          error: 'Зображення для обертання не знайдено'
        };
      }

      // Зчитування кута повороту з CSS-трансформу
      const transform = img.style.transform || img.getAttribute('style') || '';
      const match = transform.match(/rotate\((-?\d+)deg\)/);
      const currentDeg = match ? parseInt(match[1], 10) : 0;

      // STEP_DEGREES = 45, STEPS = 8 (45 * 8 = 360)
      const step = (Math.round(currentDeg / 45) % 8 + 8) % 8;

      // Визначаємо мінімальну кількість кліків (ліворуч чи праворуч) для повернення до 0 (вертикально)
      // Наприклад, step 5 (225deg) -> ліворуч 5 кліків або праворуч 3 кліки (3 менше за 5)
      let clicksNeeded: { dir: 'left' | 'right'; count: number };
      if (step === 0) {
        clicksNeeded = { dir: 'right', count: 0 };
      } else if (step <= 4) {
        clicksNeeded = { dir: 'left', count: step };
      } else {
        clicksNeeded = { dir: 'right', count: 8 - step };
      }

      // Спроба отримати назву колекційного предмета з React Fiber
      let collectible: string | null = null;
      try {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        let node;
        let targetEl = null;
        while (node = walker.nextNode()) {
          const el = node as HTMLElement;
          if (el.innerText && el.innerText.includes('Rotate the item')) {
            targetEl = el;
          }
        }
        if (targetEl) {
          let f = (targetEl as any)[Object.keys(targetEl).find(k => k.startsWith('__reactFiber')) || ''];
          while (f) {
            if (f.type?.name === 'RotateCollectibleGame' || f.type?.toString()?.includes('RotateCollectibleGame')) {
              let h = f.memoizedState;
              while (h) {
                if (typeof h.memoizedState === 'string' && h.memoizedState.length > 2) {
                  collectible = h.memoizedState;
                  break;
                }
                h = h.next;
              }
              break;
            }
            f = f.return;
          }
        }
      } catch {}

      return {
        detected: true,
        collectible,
        currentDeg,
        step,
        clicksNeeded
      };
    });
  } catch (err: any) {
    return {
      detected: false,
      currentDeg: 0,
      step: 0,
      clicksNeeded: { dir: 'right', count: 0 },
      error: err.message
    };
  }
}

async function solveRotateCaptcha(
  page: Page,
  _config: CaptchaNodeConfig,
  log: (msg: string, type?: 'info' | 'error' | 'success' | 'debug') => void
): Promise<{ success: boolean; crop?: string | null; error?: string }> {
  const state = await getRotateCaptchaState(page);
  if (!state.detected) {
    return { success: false, error: state.error || 'Не вдалося виявити стан Rotate Captcha' };
  }

  log(`🔄 Rotate Captcha: предмет «${state.collectible || 'Item'}» повернуто на ${state.currentDeg}° (крок ${state.step}/8)`, 'info');

  if (state.clicksNeeded.count > 0) {
    const dirText = state.clicksNeeded.dir === 'left' ? 'вліво ⇦' : 'вправо ⇨';
    log(`👆 Повертаємо ${dirText} (${state.clicksNeeded.count} кліків)...`, 'info');

    const selector = state.clicksNeeded.dir === 'left'
      ? 'button img[src*="arrow_left"]'
      : 'button img[src*="arrow_right"]';

    for (let i = 0; i < state.clicksNeeded.count; i++) {
      try {
        await page.click(selector);
        await page.waitForTimeout(150 + Math.random() * 50);
      } catch (clickErr: any) {
        log(`⚠️ Помилка кліку стрілки: ${clickErr.message}`, 'error');
      }
    }
  } else {
    log('👌 Предмет вже у вертикальному положенні!', 'info');
  }

  await page.waitForTimeout(200);

  // Натискаємо кнопку Submit
  log('🔘 Натискаємо кнопку «Submit»...', 'info');
  try {
    const submitClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Submit'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!submitClicked) {
      log('⚠️ Кнопку «Submit» не знайдено', 'error');
    }
  } catch (err: any) {
    log(`⚠️ Помилка кліку Submit: ${err.message}`, 'error');
  }

  // Очікуємо підтвердження успіху
  for (let check = 0; check < 12; check++) {
    await page.waitForTimeout(300);
    const resultState = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const hasCorrect = text.includes('Correct!') || text.includes('Success!');
      const continueBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Continue'));
      const hasRotateModal = text.includes('Rotate the item');
      return { hasCorrect, hasContinueBtn: !!continueBtn, hasRotateModal };
    });

    if (resultState.hasCorrect || resultState.hasContinueBtn || !resultState.hasRotateModal) {
      return { success: true, crop: state.collectible || 'Collectible' };
    }
  }

  return { success: false, error: 'Після Submit не отримано підтвердження успіху' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. УНІВЕРСАЛЬНИЙ ОБРОБНИК CAPTCHA SOLVER
// ─────────────────────────────────────────────────────────────────────────────

export async function solveCaptcha(
  page: Page,
  config: CaptchaNodeConfig = {},
  logToClient?: (msg: string, type?: 'info' | 'error' | 'success' | 'debug') => void
): Promise<CaptchaSolveResult> {
  const startTime = Date.now();
  const skipIfNotFound = config.skipIfNotFound ?? true;
  const timeout = config.timeout ?? 5000;
  const autoClickContinue = config.autoClickContinue ?? true;

  const log = (msg: string, type: 'info' | 'error' | 'success' | 'debug' = 'info') => {
    if (logToClient) logToClient(msg, type);
  };

  // 1. Визначення наявності капчі та її типу
  let detect = await detectCaptchaType(page);
  if (!detect.present) {
    if (skipIfNotFound) {
      log('ℹ️ Капчу «Quick check» не виявлено на екрані. Пропуск.', 'info');
      return {
        success: true,
        solved: false,
        skipped: true,
        durationMs: Date.now() - startTime
      };
    }

    log(`⏳ Очікування появи капчі (до ${timeout / 1000}с)...`, 'info');
    const startWait = Date.now();
    while (Date.now() - startWait < timeout) {
      await page.waitForTimeout(400);
      detect = await detectCaptchaType(page);
      if (detect.present) break;
    }

    if (!detect.present) {
      log('⚠️ Капча не з\'явилася за вказаний таймаут.', 'error');
      return {
        success: false,
        solved: false,
        skipped: false,
        durationMs: Date.now() - startTime,
        error: 'Капча не знайдена'
      };
    }
  }

  const captchaType = detect.type || 'jigsaw';
  log(`🛡️ Виявлено капчу типу: ${captchaType === 'rotate' ? '🔄 Rotate Puzzle (обертання)' : '🧩 Jigsaw Puzzle (перетягування)'}!`, 'info');

  // 2. Виконання відповідного розв'язання
  let solveOutcome: { success: boolean; crop?: string | null; error?: string };
  if (captchaType === 'rotate') {
    solveOutcome = await solveRotateCaptcha(page, config, log);
  } else {
    solveOutcome = await solveJigsawCaptcha(page, config, log);
  }

  if (!solveOutcome.success) {
    return {
      success: false,
      solved: false,
      skipped: false,
      captchaType,
      durationMs: Date.now() - startTime,
      error: solveOutcome.error || 'Помилка проходження капчі'
    };
  }

  log(`🎉 Капчу успішно розв'язано! (Предмет/культура: ${solveOutcome.crop || 'OK'})`, 'success');

  // 3. Автоматичний клік кнопки «Continue»
  if (autoClickContinue) {
    for (let c = 0; c < 8; c++) {
      await page.waitForTimeout(400);
      const clicked = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Continue'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });

      if (clicked) {
        log('✅ Натиснуто кнопку «Continue»', 'info');
        await page.waitForTimeout(600);
        break;
      }

      // Якщо модалки більше немає взагалі — виходимо
      const modalGone = await page.evaluate(() => {
        const text = document.body.innerText || '';
        return !text.includes('Quick check') && !text.includes('Success!');
      });
      if (modalGone) break;
    }
  }

  return {
    success: true,
    solved: true,
    skipped: false,
    captchaType,
    crop: solveOutcome.crop,
    durationMs: Date.now() - startTime
  };
}

/**
 * Основний обробник ноди для ProjectRunner.
 */
export const captchaSolverNodeHandler = async ({
  currentNode,
  activePage,
  context,
  logToClient
}: NodeHandlerParams): Promise<NodeResult> => {
  const nodeData = (currentNode.data || {}) as Record<string, unknown>;
  const config: CaptchaNodeConfig = {
    skipIfNotFound: nodeData.skipIfNotFound !== false,
    timeout: typeof nodeData.timeout === 'number' ? nodeData.timeout : 5000,
    dragDurationMs: typeof nodeData.dragDurationMs === 'number' ? nodeData.dragDurationMs : 400,
    dragSteps: typeof nodeData.dragSteps === 'number' ? nodeData.dragSteps : 30,
    autoClickContinue: nodeData.autoClickContinue !== false,
    maxRetries: typeof nodeData.maxRetries === 'number' ? nodeData.maxRetries : 2
  };

  logToClient('🛡️ Запуск перевірки капчі «Quick check»...', 'info');

  const result = await solveCaptcha(activePage, config, logToClient);

  if (result.success) {
    if (result.skipped) {
      return {
        data: {
          ...context,
          captchaSolved: false,
          captchaSkipped: true,
          durationMs: result.durationMs
        },
        nextHandle: ['skipped', 'no_captcha', null, undefined, 'success']
      };
    }

    return {
      data: {
        ...context,
        captchaSolved: true,
        captchaSkipped: false,
        captchaType: result.captchaType,
        crop: result.crop,
        durationMs: result.durationMs
      },
      nextHandle: ['solved', 'success', null, undefined]
    };
  } else {
    logToClient(`❌ Помилка розв'язання капчі: ${result.error || 'невідома помилка'}`, 'error');
    return {
      data: {
        ...context,
        captchaSolved: false,
        captchaSkipped: false,
        captchaType: result.captchaType,
        error: result.error,
        durationMs: result.durationMs
      },
      nextHandle: ['fail', 'error']
    };
  }
};
