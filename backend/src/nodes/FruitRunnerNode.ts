// Нода «Фруктовий Ранер» v2 (FruitRunnerNode)
// Повне переосмислення: адаптивний комп'ютерний зір з калібруванням,
// багатостратегійне зчитування стану гри, lane-based прийняття рішень,
// підтримка пауер-апів, динамічний lookahead.
// Вікно гри залишається на 100% чистим — усі рамки та HUD у вкладці «Фото / Радар».

import { NodeHandlerParams, NodeResult } from './types';
import { Logger } from '../logger';
import { parsePng, encodePng, PngData } from '../utils/pngParser';
import type { Page } from 'playwright';

const logger = new Logger('FruitRunnerNode');

// ─── Типи та конфігурація ────────────────────────────────────────────────────

export interface FruitRunnerConfig {
  targetScore?: number;       // Цільовий рахунок (за замовчуванням 2500)
  maxDuration?: number;       // Максимальний час гри у мс (120000)
  snapshotInterval?: number;  // Інтервал debug-знімків у мс (500)
  dangerLookahead?: number;   // Базовий горизонт сканування у px (400)
  safetyMargin?: number;      // Буфер безпеки у px (30)
  numLanes?: number;          // Кількість віртуальних смуг для рішень (5)
  gameAreaSelector?: string;  // CSS-селектор Canvas елемента гри ('canvas')

  // ── Ручні межі (0 = авто) ──
  manualRoadLeft?: number;    // Ліва межа дороги у px від лівого краю Canvas
  manualRoadRight?: number;   // Права межа дороги у px від лівого краю Canvas
  playerFrameTop?: number;    // Верхня межа рамки персонажа (Y px від верху Canvas)
  playerFrameBottom?: number; // Нижня межа рамки персонажа (Y px від верху Canvas)
  detectionTopY?: number;     // Висота до якої детектяться предмети зверху (Y px від верху Canvas, 0 = авто)
  detectionBottomY?: number;  // Висота до якої детектяться предмети знизу (Y px від верху Canvas, 0 = авто)

  // ── Дебаг ──
  enableDebugSnapshot?: boolean; // Увімкнути / вимкнути фотодебаг (за замовчуванням true)
  browserDebug?: boolean;        // Малювати дебаг-оверлей прямо в браузері через Phaser Graphics (без скріншотів)

  // ── Режим рушія ──
  engineMode?: 'auto' | 'phaser' | 'vision'; // Режим роботи: авто (Phaser + Vision), тільки Phaser, або тільки Vision
}

interface GameState {
  score: number;
  gameOver: boolean;
  gameWon: boolean;
}

export interface DetectedObject {
  x: number; y: number;
  w: number; h: number;
  category: 'obstacle' | 'collectible' | 'powerup';
  subtype: string;
}

export interface VisionCalibration {
  roadR: number; roadG: number; roadB: number;
  roadLeft: number; roadRight: number;
  playerBaseY: number;
  dpr: number;
  clipW: number; clipH: number;
}

export interface FrameAnalysis {
  playerX: number;
  playerY: number;
  roadLeft: number;
  roadRight: number;
  obstacles: DetectedObject[];
  collectibles: DetectedObject[];
}

interface LaneScore {
  centerX: number;
  score: number;
  isFatal?: boolean;
}

// ─── Утиліти ─────────────────────────────────────────────────────────────────

async function screenshotWithRetry(page: Page, options: any, retries = 3, delay = 500): Promise<Buffer> {
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

function sendDebugSnapshot(
  ws: any,
  nodeId: string,
  nodeTitle: string,
  pngBuf: Buffer,
  stats?: Record<string, any>
): void {
  if (!ws || typeof ws.send !== 'function' || ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify({
      type: 'DEBUG_SNAPSHOT',
      nodeId,
      nodeTitle,
      image: `data:image/png;base64,${pngBuf.toString('base64')}`,
      timestamp: Date.now(),
      stats
    }));
  } catch {}
}

// ─── Малювання для живого HUD-монітора ───────────────────────────────────────

function drawRect(
  px: Buffer, W: number, H: number,
  x0: number, y0: number, x1: number, y1: number,
  r: number, g: number, b: number, t = 2
) {
  const lx = Math.max(0, Math.min(x0, x1));
  const rx = Math.min(W - 1, Math.max(x0, x1));
  const ty = Math.max(0, Math.min(y0, y1));
  const by = Math.min(H - 1, Math.max(y0, y1));
  for (let k = 0; k < t; k++) {
    for (let x = lx; x <= rx; x++) {
      for (const y of [ty + k, by - k]) {
        if (y >= 0 && y < H) {
          const i = (y * W + x) * 4;
          px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
        }
      }
    }
    for (let y = ty; y <= by; y++) {
      for (const x of [lx + k, rx - k]) {
        if (x >= 0 && x < W) {
          const i = (y * W + x) * 4;
          px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
        }
      }
    }
  }
}

function drawLine(
  px: Buffer, W: number, H: number,
  x0: number, y0: number, x1: number, y1: number,
  r: number, g: number, b: number
) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, cx = x0, cy = y0;
  while (true) {
    if (cx >= 0 && cx < W && cy >= 0 && cy < H) {
      const i = (cy * W + cx) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
}

function drawCrosshair(
  px: Buffer, W: number, H: number,
  cx: number, cy: number, size: number,
  r: number, g: number, b: number, thickness = 1
) {
  for (let t = -Math.floor(thickness / 2); t <= Math.floor(thickness / 2); t++) {
    for (let d = -size; d <= size; d++) {
      const x1 = cx + d, y1 = cy + t;
      if (x1 >= 0 && x1 < W && y1 >= 0 && y1 < H) {
        const i = (y1 * W + x1) * 4;
        px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
      }
      const x2 = cx + t, y2 = cy + d;
      if (x2 >= 0 && x2 < W && y2 >= 0 && y2 < H) {
        const i = (y2 * W + x2) * 4;
        px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
      }
    }
  }
}

function drawFilledRect(
  px: Buffer, W: number, H: number,
  x0: number, y0: number, x1: number, y1: number,
  r: number, g: number, b: number, a = 255
) {
  const lx = Math.max(0, Math.min(x0, x1));
  const rx = Math.min(W - 1, Math.max(x0, x1));
  const ty = Math.max(0, Math.min(y0, y1));
  const by = Math.min(H - 1, Math.max(y0, y1));
  for (let y = ty; y <= by; y++) {
    for (let x = lx; x <= rx; x++) {
      const i = (y * W + x) * 4;
      if (a === 255) {
        px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
      } else {
        const alpha = a / 255;
        px[i] = Math.round(px[i] * (1 - alpha) + r * alpha);
        px[i + 1] = Math.round(px[i + 1] * (1 - alpha) + g * alpha);
        px[i + 2] = Math.round(px[i + 2] * (1 - alpha) + b * alpha);
      }
    }
  }
}


function drawArrow(
  px: Buffer, W: number, H: number,
  x0: number, y0: number, x1: number, y1: number,
  r: number, g: number, b: number
) {
  drawLine(px, W, H, x0, y0, x1, y1, r, g, b);
  const dx = x1 - x0;
  if (Math.abs(dx) > 6) {
    const dir = dx > 0 ? 1 : -1;
    drawLine(px, W, H, x1, y1, x1 - dir * 8, y1 - 6, r, g, b);
    drawLine(px, W, H, x1, y1, x1 - dir * 8, y1 + 6, r, g, b);
  }
}

/** Швидке зменшення зображення у 2 рази для усунення затримок PNG-компресії */
function downscale2x(src: Buffer, W: number, H: number): { width: number; height: number; pixels: Buffer } {
  const dstW = Math.floor(W / 2);
  const dstH = Math.floor(H / 2);
  const dst = Buffer.alloc(dstW * dstH * 4);

  for (let dy = 0; dy < dstH; dy++) {
    const sy = dy * 2;
    const srcRow = sy * W * 4;
    const dstRow = dy * dstW * 4;
    for (let dx = 0; dx < dstW; dx++) {
      const sx = dx * 2;
      const si = srcRow + sx * 4;
      const di = dstRow + dx * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = 255;
    }
  }
  return { width: dstW, height: dstH, pixels: dst };
}


// ─── Зчитування стану гри (Multi-Strategy) ──────────────────────────────────
// Спочатку шукаємо в DOM (модальні вікна, HUD-оверлеї),
// потім у Phaser Game Instance, потім у глобальних змінних window.

async function extractGameState(page: Page): Promise<GameState> {
  try {
    const result = await page.evaluate(`(() => {
      var st = { score: 0, gameOver: false, gameWon: false };
      try {
        var els = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, button, label, a');
        for (var i = 0; i < els.length; i++) {
          var t = (els[i].textContent || '').trim();
          if (!t || t.length > 300) continue;
          var sm = t.match(/(?:Score|Points)[:\\\\s]*(\\\\d+)/i);
          if (sm) st.score = Math.max(st.score, parseInt(sm[1]));
          if (/game\\\\s*over|try\\\\s*again|mission\\\\s*failed|you\\\\s*died/i.test(t)) st.gameOver = true;
          if (/victory|you\\\\s*won|claim\\\\s*reward|congratulat/i.test(t)) st.gameWon = true;
        }
      } catch(e) {}
      try {
        var games = (window.Phaser && window.Phaser.GAMES) || [];
        for (var g = 0; g < games.length; g++) {
          var scenes = games[g].scene.scenes || [];
          for (var s = 0; s < scenes.length; s++) {
            var sc = scenes[s];
            if (typeof sc.score === 'number') st.score = Math.max(st.score, sc.score);
            if (sc.gameOver === true || sc.isGameOver === true) st.gameOver = true;
            if (sc.gameWon === true || sc.isVictory === true) st.gameWon = true;
            try {
              var rs = sc.registry && sc.registry.get && sc.registry.get('score');
              if (typeof rs === 'number') st.score = Math.max(st.score, rs);
            } catch(e2) {}
          }
        }
      } catch(e) {}
      try {
        var keys = ['gameState','state','GAME_STATE','_state','game'];
        for (var k = 0; k < keys.length; k++) {
          var obj = window[keys[k]];
          if (obj && typeof obj === 'object') {
            if (typeof obj.score === 'number') st.score = Math.max(st.score, obj.score);
            if (obj.gameOver) st.gameOver = true;
            if (obj.won || obj.victory) st.gameWon = true;
          }
        }
      } catch(e) {}
      return st;
    })()`) as GameState;
    return result || { score: 0, gameOver: false, gameWon: false };
  } catch {
    return { score: 0, gameOver: false, gameWon: false };
  }
}

// ─── Phaser 60 FPS Engine Autopilot ─────────────────────────────────────────

export interface PhaserTelemetry {
  running: boolean;
  score: number;
  gameOver: boolean;
  gameWon: boolean;
  playerX: number;
  playerY: number;
  playerW?: number;
  playerH?: number;
  playerOriginX?: number;
  playerOriginY?: number;
  targetX: number;
  roadLeft: number;
  roadRight: number;
  obstacles: DetectedObject[];
  collectibles: DetectedObject[];
  plannedPath?: Array<{ x: number; y: number }>;
  keyHeld: 'ArrowLeft' | 'ArrowRight' | null;
  ticks: number;
  canvasW?: number;
  canvasH?: number;
}

export const INSTALL_PHASER_AUTOPILOT_SCRIPT = `(() => {
  if (window.__SF_PHASER_AUTOPILOT__) {
    // Зупиняємо попередній цикл перед запуском свіжої версії скрипта
    window.__SF_PHASER_AUTOPILOT__.running = false;
  }

  function extractGameFromReact() {
    try {
      const rootEl = document.getElementById('root') || document.body.firstElementChild;
      if (!rootEl) return null;
      const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactContainer'));
      if (!fiberKey) return null;
      const queue = [{ fiber: rootEl[fiberKey], depth: 0 }];
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item || item.depth > 40) continue;
        const curr = item.fiber;
        let s = curr.memoizedState;
        while (s) {
          if (s.memoizedState?.current?.scene) return s.memoizedState.current;
          if (s.memoizedState?.scene) return s.memoizedState;
          s = s.next;
        }
        if (curr.child) queue.push({ fiber: curr.child, depth: item.depth + 1 });
        if (curr.sibling) queue.push({ fiber: curr.sibling, depth: item.depth });
      }
    } catch (_) {}
    return null;
  }

  function findGame() {
    if (window.__FOUND_PHASER_GAME__ && window.__FOUND_PHASER_GAME__.scene) return window.__FOUND_PHASER_GAME__;
    if (window.__PHASER_GAME__ && window.__PHASER_GAME__.scene) return window.__PHASER_GAME__;
    if (window.Phaser && Array.isArray(window.Phaser.GAMES) && window.Phaser.GAMES.length > 0) {
      const g = window.Phaser.GAMES.find(x => x && x.scene);
      if (g) return g;
    }
    if (window.game && window.game.scene) return window.game;

    const fromReact = extractGameFromReact();
    if (fromReact) {
      window.__FOUND_PHASER_GAME__ = fromReact;
      window.__PHASER_GAME__ = fromReact;
      return fromReact;
    }

    const iframes = document.querySelectorAll('iframe');
    for (let i = 0; i < iframes.length; i++) {
      try {
        const w = iframes[i].contentWindow;
        if (w) {
          if (w.__FOUND_PHASER_GAME__ && w.__FOUND_PHASER_GAME__.scene) return w.__FOUND_PHASER_GAME__;
          if (w.Phaser && Array.isArray(w.Phaser.GAMES)) {
            const g = w.Phaser.GAMES.find(x => x && x.scene);
            if (g) return g;
          }
        }
      } catch (_) {}
    }
    return null;
  }

  const game = findGame();
  if (!game) return { success: false, error: 'Phaser not found' };

  function getActiveScene() {
    if (!game || !game.scene) return null;
    if (typeof game.scene.getScene === 'function') {
      const fd = game.scene.getScene('fruit_dash');
      if (fd) return fd;
    }
    if (Array.isArray(game.scene.scenes)) {
      const fd = game.scene.scenes.find(s => s && s.sys && s.sys.settings && s.sys.settings.key === 'fruit_dash');
      if (fd) return fd;
      for (const s of game.scene.scenes) {
        if (s && s.sys && s.sys.settings && s.sys.settings.active && s.sys.settings.visible) {
          if (s.children && s.children.list && s.children.list.length > 0) return s;
        }
      }
      return game.scene.scenes.find(s => s && s.sys && s.sys.settings && s.sys.settings.active) || game.scene.scenes[0] || null;
    }
    return null;
  }

  const activeScene = getActiveScene();
  if (!activeScene) return { success: false, error: 'No active Phaser scene' };

  const state = {
    running: true,
    installedAt: Date.now(),
    lastTick: Date.now(),
    score: 0,
    gameOver: false,
    gameWon: false,
    playerX: 0,
    playerY: 0,
    playerW: 18,
    playerH: 22,
    playerOriginX: 0.5,
    playerOriginY: 0.5,
    lastAxeTime: 0,
    targetX: 0,
    roadLeft: 0,
    roadRight: 0,
    canvasW: 888,
    canvasH: 1786,
    obstacles: [],
    collectibles: [],
    plannedPath: [],
    keyHeld: null,
    ticks: 0,
    hasStartedPlaying: false,
    hasCalibratedRoad: false,
  };
  window.__SF_PHASER_AUTOPILOT__ = state;

  function tick() {
    if (!state.running) return;

    try {
      state.ticks++;
      state.lastTick = Date.now();
      const sc = getActiveScene();
      if (!sc) {
        requestAnimationFrame(tick);
        return;
      }

      const canvas = sc.game?.canvas || document.querySelector('canvas') || window;
      const W = (sc.sys && sc.sys.game && sc.sys.game.config && sc.sys.game.config.width) || sc.scale?.width || canvas.width || 888;
      const H = (sc.sys && sc.sys.game && sc.sys.game.config && sc.sys.game.config.height) || sc.scale?.height || canvas.height || 1786;
      state.canvasW = W;
      state.canvasH = H;

      // 1. Рахунок та статус гри
      let curScore = 0;
      if (sc.portalService?.state?.context?.score !== undefined) {
        curScore = Number(sc.portalService.state.context.score) || 0;
      } else if (typeof sc.score === 'number') {
        curScore = sc.score;
      }
      try {
        const regScore = sc.registry && sc.registry.get && sc.registry.get('score');
        if (typeof regScore === 'number') curScore = Math.max(curScore, regScore);
      } catch (_) {}
      state.score = Math.max(state.score, curScore);

      if (sc.isGamePlaying === true) {
        state.hasStartedPlaying = true;
      }

      if (sc.gameOver === true || sc.isGameOver === true) state.gameOver = true;
      if (sc.gameWon === true || sc.isVictory === true) state.gameWon = true;

      // Якщо раніше гра вже бігла, а тепер isGamePlaying став false — це завершення гри
      if (state.hasStartedPlaying && sc.isGamePlaying === false) {
        state.gameOver = true;
      }
      if (sc.portalService?.state?.value === 'gameOver' || sc.portalService?.state?.value === 'complete') {
        state.gameOver = true;
      }

      // 2. Гравець та точні динамічні межі дороги
      let playerObj = sc.currentPlayer || sc.player || sc.hero || null;
      let pX = playerObj && typeof playerObj.x === 'number' ? playerObj.x : (state.playerX || Math.round(W / 2));
      let pY = playerObj && typeof playerObj.y === 'number' ? playerObj.y : (state.playerY || Math.round(H * 0.70));
      let pBodyW = (playerObj?.body && typeof playerObj.body.width === 'number') ? playerObj.body.width : 10;
      let pBodyH = (playerObj?.body && typeof playerObj.body.height === 'number') ? playerObj.body.height : 12;
      let pOriginX = (playerObj && typeof playerObj.originX === 'number') ? playerObj.originX : 0.5;
      let pOriginY = (playerObj && typeof playerObj.originY === 'number') ? playerObj.originY : 0.5;
      state.playerW = pBodyW;
      state.playerH = pBodyH;
      state.playerOriginX = pOriginX;
      state.playerOriginY = pOriginY;

      // Динамічне калібрування меж дороги через механіку обмеження персонажа гри (clamping)
      let roadL = state.roadLeft;
      let roadR = state.roadRight;
      if (sc.currentPlayer && typeof sc.updatePlayer === 'function' && (!state.hasCalibratedRoad || state.ticks % 60 === 0)) {
        const curX = sc.currentPlayer.x;
        sc.currentPlayer.x = -99999;
        sc.updatePlayer(0);
        const measuredMin = sc.currentPlayer.x;
        sc.currentPlayer.x = 99999;
        sc.updatePlayer(0);
        const measuredMax = sc.currentPlayer.x;
        sc.currentPlayer.x = curX;
        if (measuredMin > 0 && measuredMax > measuredMin && (measuredMax - measuredMin) < W) {
          roadL = measuredMin;
          roadR = measuredMax;
          state.hasCalibratedRoad = true;
        }
      }
      if (!state.hasCalibratedRoad) {
        const cX = pX || Math.round(W / 2);
        roadL = Math.max(10, cX - 45);
        roadR = Math.min(W - 10, cX + 45);
      }
      state.roadLeft = roadL;
      state.roadRight = roadR;
      state.playerX = pX;
      state.playerY = pY;

      // 3. Збір перешкод та бонусів
      const obstacles = [];
      const collectibles = [];

      // 3.1 Офіційний пайплайн Fruit Dash: sc.groundFactory._obstaclesFactory.obstaclesLines
      const of = sc.groundFactory?._obstaclesFactory;
      const lines = of?.obstaclesLines || [];
      const deadIdx = of?.deadObstacles || 0;
      for (let i = deadIdx; i < lines.length; i++) {
        const item = lines[i];
        if (!item || item.isProcessed?.() || item.active === false || item.visible === false) continue;

        let itemX = typeof item.x === 'number' ? item.x : 0;
        let itemY = typeof item.y === 'number' ? item.y : 0;
        let itemW = 25;
        let itemH = 25;
        if (typeof item.getType === 'function' && item.getType() === 'Rectangle' && typeof item.getCollisionRect === 'function') {
          const r = item.getCollisionRect();
          if (r) {
            itemX = r.centerX !== undefined ? r.centerX : (r.x + (r.width || 0) / 2);
            itemY = r.centerY !== undefined ? r.centerY : (r.y + (r.height || 0) / 2);
            itemW = r.width || 25;
            itemH = r.height || 25;
          }
        } else if (typeof item.getType === 'function' && item.getType() === 'Circle' && typeof item.getCollisionCircle === 'function') {
          const c = item.getCollisionCircle();
          if (c) {
            itemX = c.x !== undefined ? c.x : itemX;
            itemY = c.y !== undefined ? c.y : itemY;
            itemW = (c.radius || 12) * 2;
            itemH = (c.radius || 12) * 2;
          }
        } else {
          const bounds = typeof item.getBounds === 'function' ? item.getBounds() : null;
          itemW = bounds?.width || item.displayWidth || item.width || 25;
          itemH = bounds?.height || item.displayHeight || item.height || 25;
        }

        const name = (typeof item.getName === 'function' ? item.getName() : (item.name || '')).toLowerCase();
        const isObs = typeof item.isObstacle === 'function' ? item.isObstacle() : (name.includes('rock') || name.includes('pit') || name.includes('oil') || name.includes('grave') || name.includes('hole'));
        const isFruit = typeof item.isBounty === 'function' ? item.isBounty() : (name.includes('fruit') || name.includes('apple') || name.includes('banana') || name.includes('bounty') || name.includes('chest'));
        const isPower = typeof item.isPowerUp === 'function' ? item.isPowerUp() : (name.includes('axe') || name.includes('ghost') || name.includes('slow'));

        if (isObs) {
          let subtype = 'obstacle';
          if (name.includes('pit') || name.includes('hole') || name.includes('oil')) subtype = 'hole';
          else if (name.includes('rock') || name.includes('stone')) subtype = 'rock';
          else if (name.includes('grave') || name.includes('tomb')) subtype = 'grave';
          // Додаємо додаткові пікселі зверху хітбоксу перешкод (за запитом користувача: 5px)
          const extraTop = 5;
          const adjH = itemH + extraTop;
          const adjY = itemY - extraTop / 2;
          obstacles.push({ x: itemX, y: adjY, w: itemW, h: adjH, category: 'obstacle', subtype });
        } else if (isFruit || isPower) {
          let cat = isPower ? 'powerup' : 'collectible';
          let subtype = name || 'fruit';
          if (name.includes('axe')) { subtype = 'axe'; cat = 'powerup'; }
          else if (name.includes('ghost')) { subtype = 'ghost'; cat = 'powerup'; }
          else if (name.includes('slow')) { subtype = 'mushroom'; cat = 'powerup'; }
          else if (name.includes('bounty') || name.includes('chest')) { subtype = 'chest'; cat = 'collectible'; }
          collectibles.push({ x: itemX, y: itemY, w: itemW, h: itemH, category: cat, subtype });
        }
      }

      // 3.2 Резервний рекурсивний пошук по Container у sc.children.list (якщо lines порожній)
      if (obstacles.length === 0 && collectibles.length === 0) {
        const queue = [...(sc.children?.list || [])];
        const visited = new Set();
        while (queue.length > 0 && obstacles.length + collectibles.length < 50) {
          const obj = queue.shift();
          if (!obj || visited.has(obj) || obj.visible === false || obj.active === false) continue;
          visited.add(obj);
          if (obj === sc.currentPlayer) continue;

          if (obj.type === 'Container' && Array.isArray(obj.list)) {
            for (const ch of obj.list) {
              if (ch && ch.visible !== false) {
                const worldX = obj.x + (ch.x || 0);
                const worldY = obj.y + (ch.y || 0);
                const tex = (ch.texture?.key || '').toLowerCase();
                const frame = String(ch.frame?.name || '').toLowerCase();
                const nm = (ch.name || '').toLowerCase();
                const tag = tex + ' ' + frame + ' ' + nm;

                if (worldX >= roadL - 40 && worldX <= roadR + 40) {
                  if (tag.includes('hole') || tag.includes('pit') || tag.includes('oil') || tag.includes('rock') || tag.includes('stone') || tag.includes('grave') || tag.includes('tomb')) {
                    let subtype = 'obstacle';
                    if (tag.includes('hole') || tag.includes('pit') || tag.includes('oil')) subtype = 'hole';
                    else if (tag.includes('rock') || tag.includes('stone')) subtype = 'rock';
                    else if (tag.includes('grave') || tag.includes('tomb')) subtype = 'grave';
                    const extraTop = 5;
                    obstacles.push({ x: worldX, y: worldY - extraTop / 2, w: 25, h: 25 + extraTop, category: 'obstacle', subtype });
                  } else if (tag.includes('fruit') || tag.includes('apple') || tag.includes('banana') || tag.includes('bounty') || tag.includes('chest') || tag.includes('axe')) {
                    collectibles.push({ x: worldX, y: worldY, w: 20, h: 20, category: tag.includes('axe') ? 'powerup' : 'collectible', subtype: 'fruit' });
                  }
                }
              }
            }
          }
        }
      }

      state.obstacles = obstacles;
      state.collectibles = collectibles;

      // 3.3 Авто-кидок сокири у каміння/надгробки перед гравцем (якщо є в запасі)
      const axesCount = Number(sc.portalService?.state?.context?.axes) || 0;
      if (axesCount > 0 && Date.now() - (state.lastAxeTime || 0) > 400) {
        const blockingRock = obstacles.find(obs =>
          obs.subtype !== 'hole' &&
          obs.y < pY && (pY - obs.y) < 360 &&
          Math.abs(pX - obs.x) < 26
        );
        if (blockingRock) {
          state.lastAxeTime = Date.now();
          if (typeof sc.throwAxe === 'function') {
            try { sc.throwAxe(); } catch (_) {}
          } else if (typeof of?.throwAxe === 'function') {
            try { of.throwAxe(); } catch (_) {}
          }
        }
      }

      // 4. Побудова маршруту наперед (Forward Space-Time Trajectory Planner)
      // Горизонт: до самого верху карти (54 шари / 55 точок)
      // Перша половина (1..27): закріплюється і не змінюється (з гарантованим захистом від перешкод та збором близьких фруктів)
      // Друга половина (28..54): динамічно підбирає правильний маршрут через фрукти та зі 100% обходом перешкод
      function planForwardTrajectory() {
        const isGhost = Boolean(sc.ghost);

        // Фізичні параметри (у пікселях за секунду)
        const rawSpeed = typeof sc.speed === 'number' && sc.speed > 0 ? sc.speed : 1.6;
        const gameSpeed = Math.max(40, rawSpeed * 60);
        const rawWalk = typeof sc.walkingSpeed === 'number' && sc.walkingSpeed > 0 ? sc.walkingSpeed : 105;
        const walkSpeed = Math.max(40, rawWalk * 0.96);

        // ГОРИЗОНТ: до самого верху карти (54 шари / 55 точок)
        const topOfRoadY = 20;
        const maxLookaheadDist = Math.max(160, pY - topOfRoadY);
        const numLayers = 54;
        const lockIndex = Math.floor(numLayers / 2); // 27
        const dY = Math.max(4, Math.round(maxLookaheadDist / numLayers));

        // Максимальне бокове переміщення персонажа за 1 шар
        const secPerLayer = dY / gameSpeed;
        const maxLateralPerLayer = walkSpeed * secPerLayer;

        // Рівномірні X-смуги вздовж усієї реальної ширини дороги (15 смуг для плавної кривої)
        const roadCenter = (roadL + roadR) / 2;
        const usableW = Math.max(20, roadR - roadL);
        const numSamples = 15;
        const sampleSpacing = usableW / (numSamples - 1);

        const xSamples = [];
        for (let i = 0; i < numSamples; i++) {
          xSamples.push(roadL + sampleSpacing * i);
        }

        const maxIndexStep = Math.max(2, Math.floor(maxLateralPerLayer / sampleSpacing) + 1);

        // Точні межі небезпечної зони навколо перешкоди
        // obs.h вже збільшено на +5px зверху від extraTop!
        function getObsBounds(obs, padW, padH) {
          const halfW = (obs.w / 2) + 5 + 7 + (padW || 0); // 5px половина тіла + 7px запас
          const halfH = (obs.h / 2) + 6 + 6 + (padH || 0); // 6px половина тіла + 6px запас
          return {
            left: obs.x - halfW,
            right: obs.x + halfW,
            top: obs.y - halfH,
            bottom: obs.y + halfH,
          };
        }

        // Перевірка точки на зіткнення
        function isPointBlocked(x, y, padW, padH) {
          if (isGhost) return false;
          for (let o = 0; o < obstacles.length; o++) {
            const b = getObsBounds(obstacles[o], padW, padH);
            if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
              return true;
            }
          }
          return false;
        }

        // Безперервна перевірка відрізка між двома точками траєкторії (запобігає зрізанню кутів перешкод!)
        function isSegmentBlocked(x0, y0, x1, y1) {
          if (isGhost) return false;
          if (isPointBlocked(x0, y0) || isPointBlocked(x1, y1)) return true;

          const dx = x1 - x0;
          const dy = y1 - y0;
          const len = Math.hypot(dx, dy);
          const steps = Math.max(6, Math.ceil(len / 4)); // перевірка з щільним кроком не більше 4px

          for (let s = 1; s < steps; s++) {
            const t = s / steps;
            const mx = x0 + dx * t;
            const my = y0 + dy * t;
            if (isPointBlocked(mx, my)) return true;
          }
          return false;
        }

        // Перевірка безпеки фрукта (щоб бот не біг у пастку прямо перед каменем/ямою)
        function isFruitSafe(col) {
          if (isGhost) return true;
          for (let o = 0; o < obstacles.length; o++) {
            const obs = obstacles[o];
            const dx = Math.abs(obs.x - col.x);
            const dy = Math.abs(obs.y - col.y);
            const safeW = (obs.w / 2) + 14;
            const safeH = (obs.h / 2) + 18;
            if (dx < safeW && dy < safeH) return false;
          }
          return true;
        }

        // 1. РОЗРАХУНОК ЗСУВУ ДОРОГИ ДЛЯ ЗАКРІПЛЕННЯ ПЕРШОЇ ПОЛОВИНИ (Road-anchored Lock):
        const now = Date.now();
        const dt = Math.min(0.1, Math.max(0.001, (now - (state.lastPlanTime || (now - 40))) / 1000));
        state.lastPlanTime = now;
        const roadShiftY = gameSpeed * dt;

        const prevPath = state.plannedPath;
        const hasPrev = Array.isArray(prevPath) && prevPath.length === (numLayers + 1);
        const shiftedPrev = hasPrev ? prevPath.map(pt => ({ x: pt.x, y: pt.y + roadShiftY })) : null;

        // Побудова масиву точок
        const path = new Array(numLayers + 1);
        path[0] = { x: Math.round(pX), y: Math.round(pY) };

        // ПЕРША ПОЛОВИНА ТОЧОК (1..lockIndex): ЗАКРІПЛЯЄТЬСЯ І НЕ ЗМІНЮЄТЬСЯ
        // З гарантованим обходом будь-яких перешкод та підбором близьких фруктів
        for (let k = 1; k <= lockIndex; k++) {
          const curY = Math.round(pY - k * dY);
          const prevX = path[k - 1].x;
          const prevY = path[k - 1].y;

          let candX = null;

          if (shiftedPrev) {
            for (let p = 0; p < shiftedPrev.length - 1; p++) {
              const pA = shiftedPrev[p];
              const pB = shiftedPrev[p + 1];
              if (pA && pB && ((pA.y >= curY && pB.y <= curY) || (pB.y >= curY && pA.y <= curY))) {
                const span = pA.y - pB.y;
                const t = Math.abs(span) > 0.01 ? (pA.y - curY) / span : 0;
                candX = pA.x + (pB.x - pA.x) * t;
                break;
              }
            }
            if (candX === null && shiftedPrev[k]) {
              candX = shiftedPrev[k].x;
            }
          }
          if (candX === null) candX = prevX;

          // Перевірка безпеки: точка candX та сегмент від попередньої точки
          const safe = !isPointBlocked(candX, curY) && !isSegmentBlocked(prevX, prevY, candX, curY);

          if (!safe) {
            // Точка або сегмент перетинає перешкоду! Знаходимо найближчий безпечний обхід
            let bestSafeX = null;
            let minDiff = Infinity;

            for (let i = 0; i < numSamples; i++) {
              const sx = xSamples[i];
              if (!isPointBlocked(sx, curY) && !isSegmentBlocked(prevX, prevY, sx, curY)) {
                const diff = Math.abs(sx - candX);
                if (diff < minDiff) {
                  minDiff = diff;
                  bestSafeX = sx;
                }
              }
            }

            if (bestSafeX !== null) {
              candX = bestSafeX;
            } else {
              for (let i = 0; i < numSamples; i++) {
                const sx = xSamples[i];
                if (!isPointBlocked(sx, curY)) {
                  const diff = Math.abs(sx - prevX);
                  if (diff < minDiff) { minDiff = diff; candX = sx; }
                }
              }
            }
          }

          // Підбір фруктів у першій половині: якщо поруч є безпечний фрукт — впевнено підрулюємо до нього!
          for (let c = 0; c < collectibles.length; c++) {
            const col = collectibles[c];
            if (Math.abs(curY - col.y) <= dY * 0.65) {
              const dist = Math.abs(candX - col.x);
              if (dist < 28 && isFruitSafe(col)) {
                if (!isPointBlocked(col.x, curY) && !isSegmentBlocked(prevX, prevY, col.x, curY)) {
                  candX = col.x;
                  break;
                }
              }
            }
          }

          const finalX = Math.round(Math.max(roadL, Math.min(roadR, candX)));
          path[k] = { x: finalX, y: curY };
        }

        // 2. ДРУГА ПОЛОВИНА ТОЧОК (lockIndex + 1 .. numLayers):
        // ДИНАМІЧНО ПІДБИРАЄ ПРАВИЛЬНИЙ МАРШРУТ (через фрукти та зі 100% обходом перешкод)
        const dp = [];
        const parent = [];

        dp[lockIndex] = new Float64Array(numSamples).fill(Infinity);
        parent[lockIndex] = new Int16Array(numSamples).fill(-1);

        const lockX = path[lockIndex].x;
        let lockSampleIdx = 0;
        let minLockDist = Infinity;
        for (let i = 0; i < numSamples; i++) {
          const d = Math.abs(xSamples[i] - lockX);
          if (d < minLockDist) { minLockDist = d; lockSampleIdx = i; }
        }
        dp[lockIndex][lockSampleIdx] = 0;

        for (let k = lockIndex + 1; k <= numLayers; k++) {
          const curY = pY - k * dY;
          dp[k] = new Float64Array(numSamples).fill(Infinity);
          parent[k] = new Int16Array(numSamples).fill(-1);

          for (let i = 0; i < numSamples; i++) {
            const candX = xSamples[i];
            let nodeCost = 0;

            // 2.1 Перешкоди: пряме потрапляння абсолютно заборонене!
            if (isPointBlocked(candX, curY)) {
              dp[k][i] = Infinity;
              continue;
            }

            // М'яка зона попередження (тримаємося на безпечній відстані від країв перешкоди)
            if (!isGhost) {
              for (let o = 0; o < obstacles.length; o++) {
                const obs = obstacles[o];
                const safeW = (obs.w / 2) + 12;
                const safeH = (obs.h / 2) + 12;
                const dx = Math.abs(candX - obs.x);
                const dy = Math.abs(curY - obs.y);
                if (dx < safeW + 16 && dy < safeH + 16) {
                  nodeCost += (safeW + 16 - dx) * (safeH + 16 - dy) * 18;
                }
              }
            }

            // 2.2 ЗБІР ФРУКТІВ ТА БОНУСІВ: потужний бонус притягує траєкторію
            for (let c = 0; c < collectibles.length; c++) {
              const col = collectibles[c];
              const dy = Math.abs(curY - col.y);
              if (dy <= dY * 0.85) {
                const dx = Math.abs(candX - col.x);
                if (dx < 32 && isFruitSafe(col)) {
                  let bonus = 2600;
                  if (col.category === 'powerup') bonus = 4200;
                  else if (col.subtype === 'chest') bonus = 4800;
                  nodeCost -= Math.max(600, bonus - dx * 40);
                }
              }
            }

            // 2.3 Слабке центрування для рівної їзди за відсутності цілей
            nodeCost += Math.abs(candX - roadCenter) * 0.25;

            // 2.4 Пошук найкращого переходу з шару k - 1
            let minPrev = Infinity;
            let bestJ = -1;
            const fromY = pY - (k - 1) * dY;
            const minJ = Math.max(0, i - maxIndexStep);
            const maxJ = Math.min(numSamples - 1, i + maxIndexStep);

            for (let j = minJ; j <= maxJ; j++) {
              if (!isFinite(dp[k - 1][j])) continue;

              const fromX = xSamples[j];

              // ПЕРЕВІРКА ВІДРІЗКА: перетин перешкоди СУВОРО ЗАБОРОНЕНО
              if (isSegmentBlocked(fromX, fromY, candX, curY)) {
                continue;
              }

              const laneDist = Math.abs(candX - fromX);
              const transCost = laneDist * 4 + (laneDist * laneDist) * 0.15;
              const total = dp[k - 1][j] + transCost;
              if (total < minPrev) {
                minPrev = total;
                bestJ = j;
              }
            }

            if (bestJ >= 0) {
              dp[k][i] = minPrev + nodeCost;
              parent[k][i] = bestJ;
            }
          }
        }

        // Зворотній прохід для відновлення другої половини траєкторії
        let bestIdx = -1;
        let minFinalCost = Infinity;
        for (let i = 0; i < numSamples; i++) {
          if (dp[numLayers][i] < minFinalCost) {
            minFinalCost = dp[numLayers][i];
            bestIdx = i;
          }
        }

        if (bestIdx === -1) {
          for (let k = numLayers - 1; k > lockIndex; k--) {
            for (let i = 0; i < numSamples; i++) {
              if (dp[k][i] < minFinalCost) {
                minFinalCost = dp[k][i];
                bestIdx = i;
              }
            }
            if (bestIdx >= 0) break;
          }
        }

        let curr = bestIdx >= 0 ? bestIdx : lockSampleIdx;
        for (let k = numLayers; k > lockIndex; k--) {
          curr = Math.max(0, Math.min(numSamples - 1, curr));
          path[k] = { x: Math.round(xSamples[curr]), y: Math.round(pY - k * dY) };
          const par = parent[k][curr];
          curr = par >= 0 ? par : curr;
        }

        return path;
      }

      // 4.1 Виконати планування та обрати ціль
      const plannedPath = planForwardTrajectory();
      state.plannedPath = plannedPath;

      // targetX слідує за найближчим кроком запланованої траєкторії path[1]
      let targetX = pX;
      if (plannedPath && plannedPath.length > 1 && plannedPath[1]) {
        targetX = plannedPath[1].x;
      } else if (plannedPath && plannedPath.length > 0 && plannedPath[0]) {
        targetX = plannedPath[0].x;
      } else {
        targetX = (roadL + roadR) / 2;
      }
      targetX = Math.max(roadL, Math.min(roadR, targetX));
      state.targetX = targetX;




      // 5. Керування (рушійні курсори + емуляція клавіш)
      const deltaX = targetX - pX;
      const deadZone = 2.0;
      let desiredKey = null;
      if (deltaX < -deadZone) desiredKey = 'ArrowLeft';
      else if (deltaX > deadZone) desiredKey = 'ArrowRight';

      if (sc.cursorKeys) {
        if (sc.cursorKeys.left) sc.cursorKeys.left.isDown = (desiredKey === 'ArrowLeft');
        if (sc.cursorKeys.right) sc.cursorKeys.right.isDown = (desiredKey === 'ArrowRight');
        if (sc.cursorKeys.a) sc.cursorKeys.a.isDown = (desiredKey === 'ArrowLeft');
        if (sc.cursorKeys.d) sc.cursorKeys.d.isDown = (desiredKey === 'ArrowRight');
      }
      if (sc.mobileKeys) {
        sc.mobileKeys.left = (desiredKey === 'ArrowLeft');
        sc.mobileKeys.right = (desiredKey === 'ArrowRight');
      }
      if (sc.cursors) {
        if (sc.cursors.left) sc.cursors.left.isDown = (desiredKey === 'ArrowLeft');
        if (sc.cursors.right) sc.cursors.right.isDown = (desiredKey === 'ArrowRight');
      }

      if (desiredKey !== state.keyHeld) {
        if (state.keyHeld) {
          const up = new KeyboardEvent('keyup', { key: state.keyHeld, code: state.keyHeld, bubbles: true });
          canvas.dispatchEvent(up);
          window.dispatchEvent(up);
        }
        if (desiredKey) {
          const down = new KeyboardEvent('keydown', { key: desiredKey, code: desiredKey, bubbles: true });
          canvas.dispatchEvent(down);
          window.dispatchEvent(down);
        }
        state.keyHeld = desiredKey;
      }

      // 6. In-browser дебаг-оверлей через Phaser Graphics (якщо browserDebug=true)
      if (state.browserDebug) {
        try {
          // Отримуємо або створюємо Graphics об'єкт
          let dbg = window.__SF_DBG_GFX__;
          if (!dbg || dbg.scene !== sc || !dbg.active) {
            if (dbg && typeof dbg.destroy === 'function') { try { dbg.destroy(); } catch (_) {} }
            dbg = sc.add.graphics();
            dbg.setDepth(9999);
            window.__SF_DBG_GFX__ = dbg;
          }
          dbg.clear();

          const alpha = 0.85;

          // Заплановий маршрут (cyan) — лінії між точками + самі точки
          if (state.plannedPath && state.plannedPath.length > 1) {
            // Лінії між точками шляху
            for (let pi = 0; pi < state.plannedPath.length - 1; pi++) {
              const p0 = state.plannedPath[pi];
              const p1 = state.plannedPath[pi + 1];
              if (p0 && p1) {
                dbg.lineStyle(3, 0x00f0ff, 0.9);
                dbg.lineBetween(p0.x, p0.y, p1.x, p1.y);
              }
            }
            // Точки шляху (кружечки)
            dbg.fillStyle(0x00f0ff, 1.0);
            for (let pi = 0; pi < state.plannedPath.length; pi++) {
              const pp = state.plannedPath[pi];
              if (pp) dbg.fillCircle(pp.x, pp.y, 4);
            }
          }

          // Межі дороги (жовті вертикальні лінії з урахуванням ширини дороги)
          dbg.lineStyle(2, 0xffd700, 0.7);
          dbg.lineBetween(state.roadLeft - 8, 0, state.roadLeft - 8, H);
          dbg.lineBetween(state.roadRight + 8, 0, state.roadRight + 8, H);

          // Перешкоди (червоні рамки)
          for (let oi = 0; oi < state.obstacles.length; oi++) {
            const obs = state.obstacles[oi];
            dbg.lineStyle(2, 0xff4444, 0.9);
            dbg.strokeRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
          }

          // Фрукти / бонуси (зелені/пурпурні рамки)
          for (let ci = 0; ci < state.collectibles.length; ci++) {
            const col = state.collectibles[ci];
            const colColor = col.category === 'powerup' ? 0xaa55ff : 0x22c55e;
            dbg.lineStyle(2, colColor, 0.9);
            dbg.strokeRect(col.x - col.w / 2, col.y - col.h / 2, col.w, col.h);
          }

          // Хітбокс гравця (синя рамка)
          dbg.lineStyle(2, 0x3b82f6, 0.9);
          dbg.strokeRect(pX - pBodyW / 2, pY - pBodyH / 2, pBodyW, pBodyH);

          // Ціль targetX (біла хрестоподібна мітка)
          const tx = state.targetX;
          dbg.lineStyle(2, 0xffffff, 1.0);
          dbg.lineBetween(tx - 8, pY, tx + 8, pY);
          dbg.lineBetween(tx, pY - 8, tx, pY + 8);

        } catch (_) {}
      }
    } catch (_) {}

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
  return { success: true, installed: true };
})()`;

export async function findPhaserFrame(page: Page): Promise<{ targetFrame: any } | null> {
  const frames = typeof page.frames === 'function' ? page.frames() : [page];
  const sorted = [...frames].sort((a, b) => {
    const aUrl = typeof a.url === 'function' ? a.url() : '';
    const bUrl = typeof b.url === 'function' ? b.url() : '';
    return (bUrl.includes('fruit-dash') ? 1 : 0) - (aUrl.includes('fruit-dash') ? 1 : 0);
  });

  for (const f of sorted) {
    try {
      const hasPhaser = await Promise.resolve(
        f.evaluate(() => {
          const win = window as any;
          if (win.__FOUND_PHASER_GAME__?.scene) return true;
          if (win.__PHASER_GAME__?.scene) return true;
          if (win.Phaser && Array.isArray(win.Phaser.GAMES) && win.Phaser.GAMES.length > 0) return true;
          if (win.game?.scene) return true;

          // React Fiber Search
          try {
            const rootEl = document.getElementById('root') || document.body.firstElementChild;
            if (rootEl) {
              const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactContainer'));
              if (fiberKey) {
                const queue = [{ fiber: (rootEl as any)[fiberKey], depth: 0 }];
                while (queue.length > 0) {
                  const item = queue.shift();
                  if (!item || item.depth > 40) continue;
                  const curr = item.fiber;
                  let s = curr.memoizedState;
                  while (s) {
                    if (s.memoizedState?.current?.scene) {
                      win.__FOUND_PHASER_GAME__ = s.memoizedState.current;
                      win.__PHASER_GAME__ = s.memoizedState.current;
                      return true;
                    }
                    if (s.memoizedState?.scene) {
                      win.__FOUND_PHASER_GAME__ = s.memoizedState;
                      win.__PHASER_GAME__ = s.memoizedState;
                      return true;
                    }
                    s = s.next;
                  }
                  if (curr.child) queue.push({ fiber: curr.child, depth: item.depth + 1 });
                  if (curr.sibling) queue.push({ fiber: curr.sibling, depth: item.depth });
                }
              }
            }
          } catch (_) {}

          // Check iframes
          const iframes = document.querySelectorAll('iframe');
          for (let i = 0; i < iframes.length; i++) {
            try {
              const w = iframes[i].contentWindow as any;
              if (w && (w.__FOUND_PHASER_GAME__ || (w.Phaser && Array.isArray(w.Phaser.GAMES) && w.Phaser.GAMES.length > 0))) return true;
            } catch (_) {}
          }
          return false;
        })
      ).catch(() => false);

      if (hasPhaser) return { targetFrame: f };
    } catch (_) {}
  }
  return null;
}

export async function uninstallPhaserAutopilot(frameOrPage: any): Promise<void> {
  try {
    await Promise.resolve(
      frameOrPage.evaluate(() => {
        if ((window as any).__SF_PHASER_AUTOPILOT__) {
          (window as any).__SF_PHASER_AUTOPILOT__.running = false;
          const key = (window as any).__SF_PHASER_AUTOPILOT__.keyHeld;
          if (key) {
            const up = new KeyboardEvent('keyup', { key, code: key, bubbles: true });
            window.dispatchEvent(up);
            document.querySelector('canvas')?.dispatchEvent(up);
            (window as any).__SF_PHASER_AUTOPILOT__.keyHeld = null;
          }
          const game = (window as any).__FOUND_PHASER_GAME__ || (window as any).__PHASER_GAME__;
          const sc = game?.scene?.getScene?.('fruit_dash') || game?.scene?.scenes?.[0];
          if (sc) {
            if (sc.cursorKeys) {
              if (sc.cursorKeys.left) sc.cursorKeys.left.isDown = false;
              if (sc.cursorKeys.right) sc.cursorKeys.right.isDown = false;
              if (sc.cursorKeys.a) sc.cursorKeys.a.isDown = false;
              if (sc.cursorKeys.d) sc.cursorKeys.d.isDown = false;
            }
            if (sc.mobileKeys) {
              sc.mobileKeys.left = false;
              sc.mobileKeys.right = false;
            }
          }
          // Очищаємо debug Graphics якщо існує
          const dbg = (window as any).__SF_DBG_GFX__;
          if (dbg && typeof dbg.destroy === 'function') { try { dbg.destroy(); } catch (_) {} }
          (window as any).__SF_DBG_GFX__ = null;
        }
      })
    ).catch(() => {});
  } catch (_) {}
}

// ─── Калібрування зору ──────────────────────────────────────────────────────
// Сканує 3 горизонтальних лінії зображення для знаходження меж дороги
// та калібрування кольору дорожнього покриття.

export function calibrateFromFrame(
  png: PngData
): { roadR: number; roadG: number; roadB: number; roadLeft: number; roadRight: number; playerBaseY: number } | null {
  const { width: W, height: H, pixels } = png;
  if (W < 50 || H < 50) return null;

  const sampleRows = [0.35, 0.45, 0.55, 0.65].map(f => Math.floor(H * f));
  const detectedLefts: number[] = [];
  const detectedRights: number[] = [];
  let sumR = 0, sumG = 0, sumB = 0, roadSamples = 0;

  for (const sy of sampleRows) {
    if (sy >= H) continue;

    // Скануємо зліва направо в пошуках переходу трава -> піщана дорога
    let left = -1;
    for (let x = 5; x < Math.floor(W * 0.48); x++) {
      const idx = (sy * W + x) * 4;
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
      // Пісок: R > 150, R >= G, G >= B - 15, не трава (G не більше за R)
      const isSand = (r > 150 && r >= g && g >= b - 15 && !(g > r + 15));
      if (isSand) {
        const i2 = (sy * W + Math.min(W - 1, x + 2)) * 4;
        if (pixels[i2] > 150 && pixels[i2] >= pixels[i2 + 1]) {
          left = x;
          break;
        }
      }
    }

    // Скануємо справа наліво в пошуках правої межі піщаної дороги
    let right = -1;
    for (let x = W - 6; x > Math.floor(W * 0.52); x--) {
      const idx = (sy * W + x) * 4;
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
      const isSand = (r > 150 && r >= g && g >= b - 15 && !(g > r + 15));
      if (isSand) {
        const i2 = (sy * W + Math.max(0, x - 2)) * 4;
        if (pixels[i2] > 150 && pixels[i2] >= pixels[i2 + 1]) {
          right = x;
          break;
        }
      }
    }

    if (left !== -1 && right !== -1 && right - left > 60) {
      detectedLefts.push(left);
      detectedRights.push(right);
      for (let x = left + 10; x < right - 10; x += 4) {
        const idx = (sy * W + x) * 4;
        sumR += pixels[idx];
        sumG += pixels[idx + 1];
        sumB += pixels[idx + 2];
        roadSamples++;
      }
    }
  }

  let finalLeft = Math.floor(W * 0.25);
  let finalRight = Math.floor(W * 0.75);

  if (detectedLefts.length > 0) {
    detectedLefts.sort((a, b) => a - b);
    detectedRights.sort((a, b) => a - b);
    // Беремо медіану
    finalLeft = detectedLefts[Math.floor(detectedLefts.length / 2)];
    finalRight = detectedRights[Math.floor(detectedRights.length / 2)];
  } else {
    // Якщо меж трави не знайдено (наприклад, у тестах з однорідним кольором піску)
    finalLeft = 10;
    finalRight = W - 10;
    for (const sy of sampleRows) {
      for (let x = 20; x < W - 20; x += 10) {
        const idx = (sy * W + x) * 4;
        sumR += pixels[idx];
        sumG += pixels[idx + 1];
        sumB += pixels[idx + 2];
        roadSamples++;
      }
    }
  }

  if (roadSamples < 5) return null;

  // Шукаємо початковий Y гравця за помаранчевою сорочкою фермера у нижній частині екрану
  let foundPlayerY = Math.floor(H * 0.89);
  let maxOrangeRowHits = 0;
  const playerSearchYMin = Math.floor(H * 0.72);
  const playerSearchYMax = Math.floor(H * 0.96);

  for (let y = playerSearchYMin; y <= playerSearchYMax; y += 2) {
    let rowOrange = 0;
    for (let x = finalLeft; x <= finalRight; x += 2) {
      const idx = (y * W + x) * 4;
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
      if (r > 170 && g > 60 && g < 160 && b < 65 && r > g + 25 && g > b + 20) {
        rowOrange++;
      }
    }
    if (rowOrange > maxOrangeRowHits && rowOrange >= 3) {
      maxOrangeRowHits = rowOrange;
      foundPlayerY = y;
    }
  }

  return {
    roadR: Math.round(sumR / roadSamples),
    roadG: Math.round(sumG / roadSamples),
    roadB: Math.round(sumB / roadSamples),
    roadLeft: finalLeft,
    roadRight: finalRight,
    playerBaseY: foundPlayerY,
  };
}

// ─── Pixel Vision Engine ────────────────────────────────────────────────────
// Аналізує кадр з каліброваними порогами. Знаходить гравця, перешкоди,
// збиральні предмети та пауер-апи. Адаптивно уточнює межі дороги.

export function analyzeFrame(
  png: PngData,
  cal: VisionCalibration,
  lookahead: number,
  prevPlayerX: number,
  manualBounds?: {
    playerFrameTop?: number;
    playerFrameBottom?: number;
    detectionTopY?: number;
    detectionBottomY?: number;  // Нижня межа зони детекції (Y від верху)
  }
): FrameAnalysis {
  const { width: W, height: H, pixels } = png;
  const { roadR, roadG, roadB, playerBaseY } = cal;

  // ── Адаптивне уточнення меж дороги ──────────────────────────────────────
  const sampleY = Math.min(H - 1, Math.floor(H * 0.50));
  let roadLeft = cal.roadLeft;
  let roadRight = cal.roadRight;

  // Швидкий скан ±40px навколо останніх відомих меж
  const scanRadius = 40;
  for (let x = Math.max(5, cal.roadLeft - scanRadius); x < Math.min(W - 5, cal.roadLeft + scanRadius); x++) {
    const idx = (sampleY * W + x) * 4;
    const diff = Math.abs(pixels[idx] - roadR) + Math.abs(pixels[idx + 1] - roadG) + Math.abs(pixels[idx + 2] - roadB);
    if (diff < 50) { roadLeft = x; break; }
  }
  for (let x = Math.min(W - 6, cal.roadRight + scanRadius); x > Math.max(5, cal.roadRight - scanRadius); x--) {
    const idx = (sampleY * W + x) * 4;
    const diff = Math.abs(pixels[idx] - roadR) + Math.abs(pixels[idx + 1] - roadG) + Math.abs(pixels[idx + 2] - roadB);
    if (diff < 50) { roadRight = x; break; }
  }

  // Гарантуємо мінімальну ширину
  if (roadRight - roadLeft < 80) {
    roadLeft = cal.roadLeft;
    roadRight = cal.roadRight;
  }

  // ── Пошук гравця ──────────────────────────────────────────────────────────
  // У Fruit Dash персонаж біжить по строго фіксованій вертикальній лінії (Y).
  // Він ніколи не рухається вгору або вниз!
  // Якщо Герой ↑/↓ задані вручну — беремо їх, інакше використовуємо playerBaseY.
  const hasManualFrame = manualBounds?.playerFrameTop && manualBounds?.playerFrameBottom
    && manualBounds.playerFrameTop > 0 && manualBounds.playerFrameBottom > manualBounds.playerFrameTop;

  const winW = 42;
  const winH = hasManualFrame
    ? (manualBounds!.playerFrameBottom! - manualBounds!.playerFrameTop!)
    : 56;

  const playerY = hasManualFrame
    ? Math.round((manualBounds!.playerFrameTop! + manualBounds!.playerFrameBottom!) / 2)
    : playerBaseY;

  // Фіксований верх рамки пошуку персонажа (Y не сканує небо з написами підбору!)
  const fixedWy = hasManualFrame
    ? manualBounds!.playerFrameTop!
    : Math.max(10, playerBaseY - Math.floor(winH / 2));

  const searchXStart = Math.max(roadLeft + 5, prevPlayerX - 90);
  const searchXEnd = Math.min(roadRight - winW - 5, prevPlayerX + 90);

  let maxScore = -Infinity;
  let playerX = prevPlayerX;

  // Скануємо по горизонталі (з допуском ±8px по Y на випадок коливання висоти бігу)
  const ySearchMin = Math.max(5, fixedWy - 8);
  const ySearchMax = Math.min(H - winH - 5, fixedWy + 8);

  for (let wy = ySearchMin; wy <= ySearchMax; wy += 4) {
    for (let wx = searchXStart; wx <= searchXEnd; wx += 3) {
      let density = 0;
      let darkHits = 0;
      let darkPit = 0;
      let orangeHits = 0;
      let skinHits = 0;
      let hairOrClothesHits = 0;

      for (let dy = 0; dy < winH; dy += 2) {
        for (let dx = 0; dx < winW; dx += 2) {
          const sx = wx + dx, sy = wy + dy;
          if (sx >= W || sy >= H) continue;
          const idx = (sy * W + sx) * 4;
          const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
          const diff = Math.abs(r - roadR) + Math.abs(g - roadG) + Math.abs(b - roadB);
          if (diff < 35) continue; // Пропускаємо пісок дороги
          density++;

          // 1. Чорна безодня ями (r < 65, g < 65, b < 90) - притаманна лише ямам
          if (r < 65 && g < 65 && b < 90) darkPit++;

          // 2. Темний контур / черевики / очі
          if (r < 65 && g < 65 && b < 85) darkHits++;

          // 3. Яскрава помаранчева футболка фермера Sunflower Land
          if (r > 170 && g > 60 && g < 160 && b < 65 && r > g + 25 && g > b + 20) orangeHits++;

          // 4. Тілесний колір (обличчя, руки) - строго не дорога
          if (r > 190 && g > 130 && g < 225 && b > 85 && b < 185 && r > g && g > b) skinHits++;

          // 5. Волосся (коричневе) або джинси (сині)
          const isHair = (r > 90 && r < 160 && g > 50 && g < 95 && b > 40 && b < 85);
          const isBlue = (b > r + 15 && b > g && b > 60 && b < 160);
          if (isHair || isBlue) hairOrClothesHits++;
        }
      }

      // Якщо у кандидата глибока чорна яма (darkPit >= 25) і немає помаранчевої сорочки фермера (orangeHits < 3)
      // це 100% яма/провалля, а НЕ персонаж!
      if (darkPit >= 25 && orangeHits < 3) continue;

      let characterBonus = 0;
      if (orangeHits >= 3) {
        // Знайдено фірмову сорочку фермера — абсолютний пріоритет!
        characterBonus = 1000 + orangeHits * 30 + skinHits * 10 + hairOrClothesHits * 5 - darkPit * 5;
      } else {
        // Резервний розрахунок для інших скінів або синтетичних тестів
        characterBonus =
          (darkHits >= 2 ? 30 : 0) +
          (skinHits >= 2 ? 40 : 0) +
          (hairOrClothesHits >= 2 ? 30 : 0) -
          darkPit * 5;
      }

      const cx = wx + Math.floor(winW / 2);
      const distFromPrev = Math.abs(cx - prevPlayerX);
      const proximityBonus = Math.max(0, 25 - distFromPrev * 0.15);
      const finalScore = density + characterBonus + proximityBonus;

      if (finalScore > maxScore) {
        maxScore = finalScore;
        playerX = cx;
      }
    }
  }

  // ── Сканування об'єктів у зоні небезпеки (від гравця вгору) ──────────────
  const playerHalfH = hasManualFrame
    ? Math.round((manualBounds!.playerFrameBottom! - manualBounds!.playerFrameTop!) / 2)
    : 28;
  const playerHalfW = Math.round(winW / 2); // 21px
  const autoScanTop = Math.max(5, playerY - lookahead);
  const scanTop = (manualBounds?.detectionTopY && manualBounds.detectionTopY > 0 && manualBounds.detectionTopY < H)
    ? Math.max(5, manualBounds.detectionTopY)
    : autoScanTop;
  const autoScanBottom = playerY - playerHalfH - 3;
  const scanBottom = (manualBounds?.detectionBottomY && manualBounds.detectionBottomY > 0 && manualBounds.detectionBottomY < H)
    ? Math.min(autoScanBottom, manualBounds.detectionBottomY)
    : autoScanBottom;
  const blockSize = 10;

  const rawDetections: Array<{
    x: number; y: number;
    category: 'obstacle' | 'collectible' | 'powerup';
    subtype: string;
  }> = [];

  for (let y = scanTop; y <= scanBottom; y += blockSize) {
    for (let x = roadLeft + 4; x <= roadRight - blockSize - 4; x += blockSize) {
      const blockCenterX = x + blockSize / 2;
      const blockCenterY = y + blockSize / 2;
      const dxFromPlayer = Math.abs(blockCenterX - playerX);
      const dyFromPlayer = playerY - blockCenterY; // позитивне, якщо вище гравця

      // Пропускаємо тільки безпосереднє тіло самого гравця (з мінімальним зазором 2px)
      if (dxFromPlayer < playerHalfW + 2 && Math.abs(dyFromPlayer) < playerHalfH + 2) continue;

      let roadCount = 0, darkCount = 0, obstacleCount = 0, fruitCount = 0;
      let avgR = 0, avgG = 0, avgB = 0;
      let samples = 0;

      for (let dy = 0; dy < blockSize; dy += 2) {
        for (let dx = 0; dx < blockSize; dx += 2) {
          const sx = x + dx, sy = y + dy;
          if (sx >= W || sy >= H) continue;
          const idx = (sy * W + sx) * 4;
          const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
          avgR += r; avgG += g; avgB += b;
          samples++;

          const roadDiff = Math.abs(r - roadR) + Math.abs(g - roadG) + Math.abs(b - roadB);
          if (roadDiff < 45) { roadCount++; continue; }

          // Відфільтровуємо бліки / світлі піщані плями дороги:
          // Блік завжди світліший або такий же як дорога за всіма каналами і має теплий пісочний відтінок
          const isRoadGlare = (
            r >= roadR - 8 &&
            g >= roadG - 8 &&
            b >= roadB - 8 &&
            roadDiff < 95
          );
          if (isRoadGlare) {
            roadCount++;
            continue;
          }

          // Дуже темне → яма (2.png центр: RGB(32,32,64))
          if (r < 65 && g < 65 && b < 90) { darkCount++; continue; }

          // Визначаємо насиченість та яскравість пікселя
          const pixSat = Math.max(r, g, b) - Math.min(r, g, b);
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const roadLum = 0.299 * roadR + 0.587 * roadG + 0.114 * roadB;

          // Не перешкода, якщо це яскравий білий або світло-жовтий текст підбору/лічильника
          const isBrightText = (r > 190 && g > 180 && b > 160);

          // Справжні перешкоди (могили 22.png, камені 222.png):
          // Помітно темніші за дорогу (lum < roadLum - 15) або мають холодний сіро-синій відтінок (b >= r - 15)
          const isStoneObstacle = (
            !isBrightText &&
            (lum < roadLum - 15 || b >= r - 15) &&
            pixSat < 115 &&
            roadDiff > 50
          );

          if (isStoneObstacle) {
            obstacleCount++;
          } else if (pixSat >= 120 && roadDiff > 50) {
            // Фрукти мають sat >= 120: яскраві чисті кольори
            fruitCount++;
          }
        }
      }

      if (samples < 4) continue;
      const minHits = Math.max(2, Math.floor(samples * 0.20));
      avgR = Math.round(avgR / samples);
      avgG = Math.round(avgG / samples);
      avgB = Math.round(avgB / samples);

      let category: 'obstacle' | 'collectible' | 'powerup' = 'obstacle';
      let subtype = 'unknown';

      // Середня насиченість блоку — головний розділювач
      const blockSat = Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB);

      if (darkCount >= minHits) {
        // Яма: темний центр (2.png)
        category = 'obstacle';
        subtype = 'hole';
      } else if (obstacleCount >= minHits && obstacleCount >= fruitCount) {
        // Камінь/могила: сіро-синюватий, sat < 120 (22.png, 222.png)
        category = 'obstacle';
        subtype = avgB > avgR + 5 ? 'grave' : 'rock';
      } else if (fruitCount >= minHits || (blockSat >= 120 && (fruitCount + obstacleCount) >= minHits)) {
        // Фрукт або пауер-ап: яскравий, sat >= 120

        if (avgB > 160 && avgR < 130 && avgB > avgR + 35) {
          // Чорниця (11.png): домінує синій RGB(0,64,128)
          category = 'collectible';
          subtype = 'blueberry';
        } else if (avgG > avgR + 25 && avgG > avgB + 15 && avgG > 110) {
          // Зелений → мухомор
          category = 'powerup';
          subtype = 'mushroom';
        } else if (avgR > 185 && avgG > 130 && avgB < 95) {
          // Банан (1111.png) / Апельсин (11111.png): золотисто-жовтий з низьким синім (B < 95)
          category = 'collectible';
          subtype = 'banana';
        } else if (avgR > avgG + 45 && avgB < 95 && avgR > 130) {
          // Вишня (1.png): чистий червоний (B < 95)
          category = 'collectible';
          subtype = 'cherry';
        } else if (avgB > avgG && avgR < 100 && blockSat >= 100) {
          // Виноград (111.png): фіолетовий RGB(96,64,96)
          category = 'collectible';
          subtype = 'grape';
        } else {
          continue; // Світлий пісок або бліки — не фрукти, ігноруємо
        }
      } else {
        continue; // Переважно дорога, нічого цікавого
      }

      // Пропускаємо спливаючі іконки фруктів підбору безпосередньо над головою гравця (не перешкоди!)
      if (category !== 'obstacle' && dxFromPlayer < 24 && dyFromPlayer > 0 && dyFromPlayer < 50) continue;

      rawDetections.push({ x: x + blockSize / 2, y: y + blockSize / 2, category, subtype });
    }
  }

  // ── Кластеризація детекцій в об'єкти ────────────────────────────────────
  const objects: DetectedObject[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < rawDetections.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);
    const d = rawDetections[i];
    let minX = d.x, maxX = d.x, minY = d.y, maxY = d.y;
    let blockCount = 1;
    // Лічильники для голосування за категорію
    let obstacleVotes = d.category === 'obstacle' ? 1 : 0;
    let collectibleVotes = d.category === 'collectible' ? 1 : 0;
    let powerupVotes = d.category === 'powerup' ? 1 : 0;
    let dominantSubtype = d.subtype;

    for (let j = i + 1; j < rawDetections.length; j++) {
      if (visited.has(j)) continue;
      const o = rawDetections[j];
      // Кластеризуємо ВСІ сусідні блоки НЕЗАЛЕЖНО від категорії —
      // один фізичний об'єкт не повинен мати і червону і зелену рамку
      if (Math.abs(o.x - d.x) < 42 && Math.abs(o.y - d.y) < 42) {
        visited.add(j);
        blockCount++;
        if (o.category === 'obstacle') obstacleVotes++;
        else if (o.category === 'powerup') powerupVotes++;
        else collectibleVotes++;
        minX = Math.min(minX, o.x);
        maxX = Math.max(maxX, o.x);
        minY = Math.min(minY, o.y);
        maxY = Math.max(maxY, o.y);
      }
    }

    // Фільтр відблисків/іскорок: одиничний блок = шум, не реальний об'єкт.
    if (blockCount < 2) continue;

    // Класифікація за більшістю голосів. Obstacle має пріоритет (безпека > збір)
    let finalCategory: 'obstacle' | 'collectible' | 'powerup';
    let finalSubtype = dominantSubtype;
    if (obstacleVotes >= collectibleVotes && obstacleVotes >= powerupVotes) {
      finalCategory = 'obstacle';
      finalSubtype = dominantSubtype === 'hole' || dominantSubtype === 'rock' ? dominantSubtype : 'rock';
    } else if (powerupVotes > obstacleVotes && powerupVotes >= collectibleVotes) {
      finalCategory = 'powerup';
    } else {
      finalCategory = 'collectible';
    }

    objects.push({
      x: Math.round((minX + maxX) / 2),
      y: Math.round((minY + maxY) / 2),
      w: Math.max(24, maxX - minX + blockSize),
      h: Math.max(24, maxY - minY + blockSize),
      category: finalCategory,
      subtype: finalSubtype,
    });
  }

  return {
    playerX,
    playerY,
    roadLeft,
    roadRight,
    obstacles: objects.filter(o => o.category === 'obstacle'),
    collectibles: objects.filter(o => o.category === 'collectible' || o.category === 'powerup'),
  };
}

// ─── Точні габарити перешкод за результатами аналізу спрайтів ───────────────
// Персонаж: 42px ширина (половина = 21px)
// Яма (2.png): 96px ширина (половина = 48px)
// Камінь (222.png): 54px ширина (половина = 27px)
// Могила (22.png): 42px ширина (половина = 21px)
export function getObstacleHalfWidth(obs: DetectedObject | string): number {
  const subtype = typeof obs === 'string' ? obs : obs?.subtype;
  if (subtype === 'hole') return 48;
  if (subtype === 'rock') return 27;
  if (subtype === 'grave') return 21;
  if (typeof obs !== 'string' && obs?.w) {
    return Math.max(Math.round(obs.w / 2), 24);
  }
  return 24;
}

// ─── Global Trajectory Planner (Spatio-Temporal Pathfinding) ────────────────
// Розраховує глобально оптимальну траєкторію бігу від гравця до верху екрана:
// - Дискретизує дорогу на 15 горизонтальних треків та вертикальні зрізи
// - Враховує фізичні обмеження швидкості бігу та кута повороту
// - Огинає перешкоди з безпечною дистанцією
// - Притягується до бонусних фруктів та мухоморів
// - Будує безперервну полілінію точок (траєкторію) для керування

export interface TrajectoryPoint {
  x: number;
  y: number;
}

export function planGlobalTrajectory(
  playerX: number,
  playerY: number,
  roadLeft: number,
  roadRight: number,
  obstacles: DetectedObject[],
  collectibles: DetectedObject[],
  scanTop: number,
  isInvincible = false,
  estimatedSpeed = 1.0,
  safetyMargin = 16
): TrajectoryPoint[] {
  const minX = roadLeft + safetyMargin;
  const maxX = roadRight - safetyMargin;
  if (maxX <= minX) {
    return [{ x: playerX, y: playerY }];
  }

  // 15 дискретних треків по ширині дороги
  const numTracks = 15;
  const trackStep = (maxX - minX) / (numTracks - 1);
  const tracks: number[] = [];
  for (let i = 0; i < numTracks; i++) {
    tracks.push(Math.round(minX + i * trackStep));
  }

  // Зрізи від playerY вгору до scanTop
  const sliceH = 25;
  const slices: number[] = [];
  for (let y = playerY; y >= scanTop; y -= sliceH) {
    slices.push(y);
  }
  if (slices.length === 0 || slices[slices.length - 1] > scanTop + 10) {
    slices.push(scanTop);
  }

  const numSlices = slices.length;
  if (numSlices <= 1) {
    return [{ x: playerX, y: playerY }];
  }

  // DP таблиця вартостей та батьківських треків
  const cost: number[][] = Array.from({ length: numSlices }, () => Array(numTracks).fill(Infinity));
  const parent: number[][] = Array.from({ length: numSlices }, () => Array(numTracks).fill(-1));

  // Початкова точка найближча до playerX
  let startTrack = 0;
  let minStartDiff = Infinity;
  for (let t = 0; t < numTracks; t++) {
    const diff = Math.abs(tracks[t] - playerX);
    if (diff < minStartDiff) {
      minStartDiff = diff;
      startTrack = t;
    }
  }
  cost[0][startTrack] = 0;

  // Кінематичний кут нахилу маневру dx / dy
  const maxSteerSlope = Math.max(0.65, 0.95 / Math.min(1.4, estimatedSpeed));

  for (let s = 0; s < numSlices - 1; s++) {
    const y0 = slices[s];
    const y1 = slices[s + 1];
    const dy = Math.abs(y0 - y1);
    const maxDx = dy * maxSteerSlope + 4;

    for (let t0 = 0; t0 < numTracks; t0++) {
      if (cost[s][t0] === Infinity) continue;
      const x0 = tracks[t0];

      for (let t1 = 0; t1 < numTracks; t1++) {
        const x1 = tracks[t1];
        const dx = Math.abs(x1 - x0);
        if (dx > maxDx) continue; // Недосяжний перехід

        // Плавність: штраф за зайві рухи вбік
        let edgeCost = dx * 1.2;
        let proximityCost = 0;

        // Перевірка колізій із перешкодами на цьому сегменті
        if (!isInvincible) {
          for (const obs of obstacles) {
            // Ігноруємо перешкоди вище scanTop або далеко від сегмента
            if (obs.y < scanTop - 10) continue;
            if (obs.y < y1 - 15 || obs.y > y0 + 15) continue;

            const ratio = (obs.y - y0) / (y1 - y0);
            const pathX = x0 + ratio * (x1 - x0);
            const dist = Math.abs(pathX - obs.x);
            const halfW = getObstacleHalfWidth(obs);
            const playerHalfW = 18;
            const clearance = dist - (halfW + playerHalfW);

            if (clearance <= 0) {
              // Штраф за перетин зони колізії (замість відкидання переходу),
              // щоб алгоритм ніколи не зривався у дефолтну пряму лінію і завжди обирав
              // найшвидшу евакуацію з небезпеки вбік з максимальним clearance.
              const penetration = Math.abs(clearance);
              proximityCost += 2000000 + penetration * 10000;
            } else if (clearance < 24) {
              proximityCost += (24 - clearance) * 50;
            }
          }
        }

        // Бонус за підбір фруктів та мухоморів
        let fruitBonus = 0;
        for (const col of collectibles) {
          if (col.y >= y1 - 20 && col.y <= y0 + 20) {
            const dist = Math.abs(x1 - col.x);
            if (dist < 26) {
              fruitBonus += col.category === 'powerup' ? 6000 : 1500;
            }
          }
        }

        const totalCost = cost[s][t0] + edgeCost + proximityCost - fruitBonus;
        if (totalCost < cost[s + 1][t1]) {
          cost[s + 1][t1] = totalCost;
          parent[s + 1][t1] = t0;
        }
      }
    }
  }

  // Пошук найкращого фінішного треку на верхньому зрізі
  let bestEndTrack = -1;
  let minEndCost = Infinity;
  for (let t = 0; t < numTracks; t++) {
    if (cost[numSlices - 1][t] < minEndCost) {
      minEndCost = cost[numSlices - 1][t];
      bestEndTrack = t;
    }
  }

  // Якщо верхній зріз заблоковано — шукаємо найвищий досяжний зріз
  if (bestEndTrack === -1) {
    for (let s = numSlices - 2; s >= 1; s--) {
      for (let t = 0; t < numTracks; t++) {
        if (cost[s][t] < minEndCost) {
          minEndCost = cost[s][t];
          bestEndTrack = t;
        }
      }
      if (bestEndTrack !== -1) {
        const partialPath: TrajectoryPoint[] = [];
        let curr = bestEndTrack;
        for (let k = s; k >= 0; k--) {
          partialPath.unshift({ x: tracks[curr], y: slices[k] });
          curr = parent[k][curr];
          if (curr === -1 && k > 0) break;
        }
        return partialPath;
      }
    }
    // Fallback в екстреній ситуації: відхиляємося від найближчої перешкоди, а не біжимо прямо на таран
    const nearestObs = obstacles
      .filter(o => o.y >= scanTop && o.y <= playerY + 15)
      .sort((a, b) => Math.hypot(a.x - playerX, a.y - playerY) - Math.hypot(b.x - playerX, b.y - playerY))[0];
    const evadeX = nearestObs
      ? (nearestObs.x > playerX ? minX : maxX)
      : playerX;
    return slices.map((y, idx) => ({
      x: Math.round(playerX + (evadeX - playerX) * Math.min(1, idx * 0.35)),
      y,
    }));
  }

  // Бектрекінг шляху від верху до низу
  const path: TrajectoryPoint[] = [];
  let currTrack = bestEndTrack;
  for (let s = numSlices - 1; s >= 0; s--) {
    path.unshift({ x: tracks[currTrack], y: slices[s] });
    currTrack = parent[s][currTrack];
    if (currTrack === -1 && s > 0) break;
  }

  return path;
}

// ─── Decision Engine: Оцінка смуг (Lane-Based Decision Making) ──────────────
// Дворівнева система прийняття рішень:
// 1. Пріоритет виживання (Survival First):
//    - Перевірка зіткнення на цільовій смузі
//    - Перевірка коридору перебігу (Swept Corridor)
//    - Кінематична досяжність (Time-To-Collision)
// 2. Збір предметів (Greed Second):
//    - Дозволено ТІЛЬКИ якщо немає безпосередніх загроз
//    - Тільки в межах безпечної зони досяжності

export function evaluateLanes(
  playerX: number,
  playerY: number,
  roadLeft: number,
  roadRight: number,
  obstacles: DetectedObject[],
  collectibles: DetectedObject[],
  numLanes: number,
  lookahead: number,
  safetyMargin: number,
  isInvincible: boolean,
  estimatedSpeed: number = 1.0
): LaneScore[] {
  const effLeft = roadLeft + safetyMargin;
  const effRight = roadRight - safetyMargin;
  if (effRight <= effLeft) {
    return [{ centerX: Math.round((roadLeft + roadRight) / 2), score: 0 }];
  }
  const laneWidth = (effRight - effLeft) / numLanes;
  const playerHalfW = 21;
  const baseMargin = Math.max(14, safetyMargin);

  // Швидкості для кінематичного розрахунку:
  // Vx гравця ~ 320 px/s
  // Vy перешкод ~ 140 * estimatedSpeed px/s
  const playerVx = 320;
  const obstacleVy = Math.max(80, 140 * estimatedSpeed);

  // 1. Визначаємо, чи є пряма негайна загроза для поточної позиції гравця
  let immediateThreat = false;
  let minTimeToImpact = Infinity;

  if (!isInvincible) {
    for (const obs of obstacles) {
      const obsHalfW = getObstacleHalfWidth(obs);
      const distY = playerY - obs.y;
      if (distY > -10 && distY < 200) {
        // Чи перекриває перешкода поточну координату гравця?
        const lethalLeft = obs.x - obsHalfW - playerHalfW - 8;
        const lethalRight = obs.x + obsHalfW + playerHalfW + 8;
        if (playerX >= lethalLeft && playerX <= lethalRight) {
          immediateThreat = true;
          const timeToImpact = Math.max(0.01, distY / obstacleVy);
          if (timeToImpact < minTimeToImpact) {
            minTimeToImpact = timeToImpact;
          }
        }
      }
    }
  }

  // Максимальна горизонтальна відстань, яку гравець фізично може подолати до удару
  // Якщо є загроза, радіус маневру жорстко обмежений часом до зіткнення
  const maxEscapeDist = immediateThreat
    ? Math.max(60, minTimeToImpact * playerVx)
    : Infinity;

  const lanes: LaneScore[] = [];

  for (let i = 0; i < numLanes; i++) {
    const centerX = Math.round(effLeft + (i + 0.5) * laneWidth);
    const moveDist = Math.abs(centerX - playerX);
    let score = 0;
    let isFatal = false;

    if (!isInvincible) {
      // ── А. Кінематична досяжність: чи встигне гравець взагалі сюди добігти?
      if (immediateThreat && moveDist > maxEscapeDist) {
        // Смуга занадто далеко — фізично не встигнути до удару!
        isFatal = true;
        score -= 900000;
      }

      // ── Б. Перевірка цільової смуги на пряме зіткнення
      for (const obs of obstacles) {
        const obsHalfW = getObstacleHalfWidth(obs);
        const distY = playerY - obs.y;
        if (distY < -15 || distY > lookahead) continue;

        const lethalLeft = obs.x - obsHalfW - playerHalfW - baseMargin;
        const lethalRight = obs.x + obsHalfW + playerHalfW + baseMargin;

        if (centerX >= lethalLeft && centerX <= lethalRight) {
          if (distY < 130) {
            // Безпосередній удар на цій смузі!
            isFatal = true;
            score -= 1000000;
          } else {
            // Небезпека попереду в цій смузі
            const proximity = Math.max(0, 1 - distY / lookahead);
            const severity = obs.subtype === 'hole' ? 220 : 160;
            score -= proximity * severity * (1 + proximity * 2);
          }
        }
      }

      // ── В. Коридор перебігу (Swept Corridor Check): чи не летить перешкода на шляху між playerX і centerX?
      if (!isFatal && moveDist > 15) {
        const corridorMinX = Math.min(playerX, centerX) - playerHalfW;
        const corridorMaxX = Math.max(playerX, centerX) + playerHalfW;

        for (const obs of obstacles) {
          const obsHalfW = getObstacleHalfWidth(obs);
          const distY = playerY - obs.y;
          if (distY < -10 || distY > 240) continue;

          // Чи перетинає перешкода горизонтальний коридор руху?
          const obsLeft = obs.x - obsHalfW - 8;
          const obsRight = obs.x + obsHalfW + 8;

          const overlapsCorridor = Math.max(corridorMinX, obsLeft) <= Math.min(corridorMaxX, obsRight);
          if (overlapsCorridor) {
            // Розрахунок часу: чи перетнеться гравець із перешкодою під час бігу?
            const timeToObsHit = Math.max(0.01, distY / obstacleVy);
            const timeToCross = moveDist / playerVx;

            // Якщо перешкода досягне гравця раніше, ніж гравець встигне пробігти коридор
            if (timeToObsHit < timeToCross + 0.18) {
              isFatal = true;
              score -= 800000; // Смертельний перебіг! На шляху перешкода!
              break;
            }
          }
        }
      }
    }

    // ── Г. Збір предметів (ТІЛЬКИ якщо НЕМАЄ негайної загрози та смуга безпечна) ──
    if (!isFatal && !immediateThreat) {
      for (const col of collectibles) {
        const halfW = col.w / 2 + 18;
        if (centerX >= col.x - halfW && centerX <= col.x + halfW) {
          const distY = playerY - col.y;
          if (distY < -15 || distY > lookahead) continue;

          // Перевіряємо, чи цей фрукт не розташований під перешкодою (пастка)
          const isTrapped = obstacles.some(obs => {
            const obsHalfW = getObstacleHalfWidth(obs);
            return (
              Math.abs(obs.x - col.x) < obsHalfW + 20 &&
              Math.abs(obs.y - col.y) < 70
            );
          });

          if (!isTrapped) {
            const proximity = Math.max(0, 1 - distY / lookahead);
            const value = col.category === 'powerup' ? 60 : 25;
            score += proximity * value;
          }
        }
      }
    }

    // ── Д. Штрафи за рух та центрування ──
    if (immediateThreat) {
      // В екстреному режимі: мінімальний маневр вбік заради порятунку
      score -= moveDist * 1.5;
    } else {
      // У звичайному режимі: помірний штраф за перебігання (не стрибати далеко через усю дорогу)
      score -= moveDist * 0.18;

      // Бонус за центральну позицію (більше простору для маневру в майбутньому)
      const roadCenter = (effLeft + effRight) / 2;
      const centerDist = Math.abs(centerX - roadCenter) / Math.max(1, effRight - effLeft);
      score += (1 - centerDist) * 8;
    }

    lanes.push({ centerX, score, isFatal });
  }

  return lanes;
}

export function selectBestLane(lanes: LaneScore[], lastTargetX?: number): number {
  if (lanes.length === 0) return 400; // Fallback
  let best = lanes[0];
  let bestScore = best.score;

  // Гістерезис: даємо невеликий бонус поточній цілі, щоб уникнути тремтіння (jitter)
  if (lastTargetX !== undefined && Math.abs(best.centerX - lastTargetX) < 15 && !best.isFatal) {
    bestScore += 12;
  }

  for (let i = 1; i < lanes.length; i++) {
    let s = lanes[i].score;
    if (lastTargetX !== undefined && Math.abs(lanes[i].centerX - lastTargetX) < 15 && !lanes[i].isFatal) {
      s += 12;
    }
    if (s > bestScore) {
      best = lanes[i];
      bestScore = s;
    }
  }
  return best.centerX;
}

// ─── Основний обробник ноди FruitRunnerNode ──────────────────────────────────

export const fruitRunnerNodeHandler = async ({
  currentNode,
  activePage,
  ws,
  nodeTitle,
  logToClient,
  context,
  smartSleep: _smartSleep,
  checkRunning: _checkRunning,
}: NodeHandlerParams): Promise<NodeResult> => {
  // Fallbacks для зворотної сумісності (тести можуть не надавати ці функції)
  const doSleep = typeof _smartSleep === 'function'
    ? _smartSleep
    : (ms: number) => new Promise<void>(r => setTimeout(r, ms));
  const isRunning = typeof _checkRunning === 'function'
    ? _checkRunning
    : () => true;

  const nodeData = (currentNode.data || {}) as FruitRunnerConfig;
  const targetScore = Number(nodeData.targetScore) || 2500;
  const maxDurationMs = Number(nodeData.maxDuration) || 120000;
  const baseLookahead = Number(nodeData.dangerLookahead) || 400;
  const safetyMargin = Number(nodeData.safetyMargin) || 30;
  const snapshotInterval = Number(nodeData.snapshotInterval) || 500;
  const numLanes = Number(nodeData.numLanes) || 5;
  const gameAreaSelector = nodeData.gameAreaSelector || 'canvas';

  // Ручні межі (0 = авто)
  const manualRoadLeft = Number(nodeData.manualRoadLeft) || 0;
  const manualRoadRight = Number(nodeData.manualRoadRight) || 0;
  const playerFrameTop = Number(nodeData.playerFrameTop) || 0;
  const playerFrameBottom = Number(nodeData.playerFrameBottom) || 0;
  const detectionTopY = Number(nodeData.detectionTopY) || 0;
  const detectionBottomY = Number(nodeData.detectionBottomY) || 0;
  const enableDebugSnapshot = nodeData.enableDebugSnapshot !== false;
  const browserDebug = Boolean(nodeData.browserDebug);
  const engineMode = nodeData.engineMode || 'auto';

  logger.info(
    `Starting FruitRunnerNode v2: target=${targetScore}, maxDuration=${maxDurationMs}ms, lanes=${numLanes}, engineMode=${engineMode}`
  );
  logToClient(
    `🎮 Fruit Runner v2 — старт (Ціль: ${targetScore} очок, ${numLanes} смуг, режим: ${engineMode})`,
    'info'
  );

  if (!activePage || activePage.isClosed()) {
    logToClient('❌ Немає активної сторінки браузера', 'error');
    return { data: context, nextHandle: 'failed' };
  }

  // ── 1. Підготовка ────────────────────────────────────────────────────────

  // Очищуємо будь-які залишки DOM-оверлеїв
  try {
    await activePage.evaluate(`(() => {
      var old = document.getElementById('__sf_runner_overlay__');
      if (old) old.remove();
      var old2 = document.getElementById('__sf_runner_svg__');
      if (old2) old2.remove();
    })()`);
  } catch (_) { /* ігноруємо */ }

  // Фокусуємо Canvas для прийому клавіш
  try {
    await activePage.evaluate(`(() => {
      var c = document.querySelector('${gameAreaSelector}');
      if (c) { c.focus(); if (c.click) c.click(); }
    })()`);
  } catch (_) { /* ігноруємо */ }

  // DPR (Device Pixel Ratio)
  let dpr = 1;
  try {
    dpr = (await activePage.evaluate(() => window.devicePixelRatio || 1).catch(() => 1)) as number;
  } catch (_) { /* ігноруємо */ }

  // ── 1.1 Нормалізація масштабу CDP ───────────────────────────────────────
  // Якщо в браузері залишився CDP pageScaleFactor != 1 (наприклад, після pinch-zoom),
  // скидаємо його до 1.0, щоб Playwright screenshot() не конфліктував з CDP
  // і не змінював візуальний масштаб сторінки під час гри!
  try {
    const session = await activePage.context().newCDPSession(activePage);
    await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.0 });
    await session.detach();
  } catch (_) { /* ігноруємо */ }

  // Використовуємо повнокадровий скріншот без жорсткого clip-обрізання:
  // calibrateFromFrame автоматично знаходить дорогу (roadLeft/roadRight) за кольором піску
  // при будь-якому зумі, розмірі екрану чи зміщенні канвасу, уникаючи спотворень (наприклад, 607x977).
  const shotOptions: any = { type: 'png' };

  // ── 1.2 Спроба підключення до рушія Phaser (Варіант 2: 60 FPS Engine Autopilot) ──
  let phaserActive = false;
  let phaserTargetFrame: any = activePage;

  if (engineMode !== 'vision') {
    logToClient('🔍 Пошук рушія Phaser у грі...', 'info');
    for (let attempt = 0; attempt < 3; attempt++) {
      const found = await findPhaserFrame(activePage);
      if (found) {
        phaserTargetFrame = found.targetFrame;
        const res: any = await Promise.resolve(phaserTargetFrame.evaluate(INSTALL_PHASER_AUTOPILOT_SCRIPT)).catch(() => ({ success: false }));
        if (res?.success) {
          phaserActive = true;
          // Передаємо browserDebug прапор в state гри
          if (browserDebug) {
            await phaserTargetFrame.evaluate(() => {
              if ((window as any).__SF_PHASER_AUTOPILOT__) {
                (window as any).__SF_PHASER_AUTOPILOT__.browserDebug = true;
              }
            }).catch(() => {});
          }
          logToClient('⚡ Підключено до Phaser Engine! Активовано 60 FPS автопілот із нульовою затримкою.', 'success');
          break;
        }
      }
      await doSleep(300, ws);
    }

    if (!phaserActive) {
      if (engineMode === 'phaser') {
        logToClient('❌ Не вдалося знайти екземпляр Phaser. Переконайтеся, що гра відкрита.', 'error');
        return { data: context, nextHandle: 'failed' };
      }
      logToClient('ℹ️ Phaser не виявлено (або гра в ізольованому iframe). Перемикаюся на комп\'ютерний зір (Pixel Vision)...', 'info');
    }
  }

  // Якщо Phaser активовано — запускаємо надшвидкий 60 FPS ігровий цикл на рівні рушія!
  if (phaserActive) {
    const startTime = Date.now();
    let lastScore = 0;
    let lastLoggedScore = -1;
    let lastRadarLogTime = 0;
    let lastSnapshotTime = 0;
    const effectiveSnapshotInterval = Math.max(300, snapshotInterval);

    while (Date.now() - startTime < maxDurationMs) {
      if (!isRunning()) {
        await uninstallPhaserAutopilot(phaserTargetFrame);
        logToClient('⏹️ Зупинено користувачем', 'info');
        break;
      }
      if (activePage.isClosed()) {
        logToClient('❌ Сторінку закрито', 'error');
        break;
      }

      const telemetry: PhaserTelemetry = await Promise.resolve(
        phaserTargetFrame.evaluate(() => {
          return (window as any).__SF_PHASER_AUTOPILOT__ || { running: false, score: 0, gameOver: false, gameWon: false };
        })
      ).catch(() => ({ running: false, score: 0, gameOver: false, gameWon: false } as PhaserTelemetry));

      if (telemetry.score > 0) lastScore = Math.max(lastScore, telemetry.score);

      // Оновлення рахунку на UI
      if (lastScore !== lastLoggedScore && lastScore > 0) {
        lastLoggedScore = lastScore;
        logToClient(`🎯 Рахунок: ${lastScore} / ${targetScore}`, 'info');
        if (ws && typeof ws.send === 'function' && ws.readyState === 1) {
          try {
            ws.send(JSON.stringify({
              type: 'NODE_DISPLAY_DATA',
              nodeId: currentNode.id,
              value: `Рахунок: ${lastScore}/${targetScore} (Phaser 60FPS)`,
            }));
          } catch (_) {}
        }
      }

      // Перемога
      if (telemetry.gameWon || lastScore >= targetScore) {
        await uninstallPhaserAutopilot(phaserTargetFrame);
        logToClient(`🏆 Перемога у Фруктовому Ранері! Рахунок: ${lastScore} >= ${targetScore}`, 'success');
        return {
          data: { ...context, score: lastScore, targetScore, success: true },
          nextHandle: 'success',
        };
      }

      // Поразка
      if (telemetry.gameOver) {
        await uninstallPhaserAutopilot(phaserTargetFrame);
        logToClient(`💀 Game Over. Рахунок: ${lastScore}`, 'error');
        return {
          data: { ...context, score: lastScore, targetScore, success: false },
          nextHandle: 'failed',
        };
      }

      // Радарні логи в чат кожні 1.5 сек
      if (Date.now() - lastRadarLogTime >= 1500) {
        lastRadarLogTime = Date.now();
        const obsList = (telemetry.obstacles || []).map(o => `${o.subtype}@${Math.round(o.x)}`).join(', ') || 'чисто';
        const colList = (telemetry.collectibles || []).map(c => `${c.subtype}@${Math.round(c.x)}`).join(', ') || 'немає';
        const action = telemetry.keyHeld === 'ArrowLeft' ? '← [ВЛІВО]' : telemetry.keyHeld === 'ArrowRight' ? '→ [ВПРАВО]' : '|| [ПРЯМО]';
        logToClient(
          `⚡ [PHASER 60FPS] Позиція X=${Math.round(telemetry.playerX)} | ${action} → Ціль X=${Math.round(telemetry.targetX)} | Перешкоди: [${obsList}] | Фрукти: [${colList}]`,
          'info'
        );
      }

      // Фотодебаг (HUD) у вкладку «Фото»
      if (enableDebugSnapshot && Date.now() - lastSnapshotTime >= effectiveSnapshotInterval) {
        lastSnapshotTime = Date.now();
        try {
          const shotBuf = await screenshotWithRetry(activePage, shotOptions, 1, 150);
          const png = await parsePng(shotBuf);
          if (png) {
            const dbgPx = Buffer.from(png.pixels);
            const gW = (telemetry.canvasW && telemetry.canvasW > 0) ? telemetry.canvasW : png.width;
            const gH = (telemetry.canvasH && telemetry.canvasH > 0) ? telemetry.canvasH : png.height;
            const scaleX = png.width / gW;
            const scaleY = png.height / gH;
            const toScreenX = (gx: number) => Math.max(0, Math.min(png.width - 1, Math.round(gx * scaleX)));
            const toScreenY = (gy: number) => Math.max(0, Math.min(png.height - 1, Math.round(gy * scaleY)));
            const toScreenW = (gw: number) => Math.max(2, Math.round(gw * scaleX));
            const toScreenH = (gh: number) => Math.max(2, Math.round(gh * scaleY));

            // 0. Траєкторія наперед (яскрава неонова лінія Cyan)
            if (Array.isArray(telemetry.plannedPath) && telemetry.plannedPath.length > 0) {
              for (let pt = 0; pt < telemetry.plannedPath.length - 1; pt++) {
                const p0 = telemetry.plannedPath[pt];
                const p1 = telemetry.plannedPath[pt + 1];
                if (p0 && p1) {
                  const x0 = toScreenX(p0.x);
                  const y0 = toScreenY(p0.y);
                  const x1 = toScreenX(p1.x);
                  const y1 = toScreenY(p1.y);
                  drawLine(dbgPx, png.width, png.height, x0, y0, x1, y1, 0, 240, 255);
                  drawLine(dbgPx, png.width, png.height, x0 + 1, y0, x1 + 1, y1, 0, 240, 255);
                }
              }
            }

            // 1. Межі дороги (жовті лінії) — з розширенням 8px (реальна дорога трохи ширша)
            const roadVisualExpand = 8;
            const rLeft = toScreenX(telemetry.roadLeft - roadVisualExpand);
            const rRight = toScreenX(telemetry.roadRight + roadVisualExpand);
            drawRect(dbgPx, png.width, png.height, rLeft, 0, rLeft + 2, png.height - 1, 234, 179, 8, 2);
            drawRect(dbgPx, png.width, png.height, rRight - 2, 0, rRight, png.height - 1, 234, 179, 8, 2);

            // 2. Перешкоди (червоні рамки)
            for (const obs of (telemetry.obstacles || [])) {
              const ox = toScreenX(obs.x);
              const oy = toScreenY(obs.y);
              const ow = toScreenW(obs.w || 25);
              const oh = toScreenH(obs.h || 25);
              drawRect(
                dbgPx, png.width, png.height,
                ox - Math.round(ow / 2), oy - Math.round(oh / 2),
                ox + Math.round(ow / 2), oy + Math.round(oh / 2),
                239, 68, 68, 2
              );
            }

            // 3. Фрукти (зелені рамки)
            for (const col of (telemetry.collectibles || [])) {
              const cx = toScreenX(col.x);
              const cy = toScreenY(col.y);
              const cw = toScreenW(col.w || 20);
              const ch = toScreenH(col.h || 20);
              const cr = col.category === 'powerup' ? 168 : 34;
              const cg = col.category === 'powerup' ? 85 : 197;
              const cb = col.category === 'powerup' ? 247 : 94;
              drawRect(
                dbgPx, png.width, png.height,
                cx - Math.round(cw / 2), cy - Math.round(ch / 2),
                cx + Math.round(cw / 2), cy + Math.round(ch / 2),
                cr, cg, cb, 2
              );
            }

            // 4. Гравець (зелена рамка з точним розміром хітбокса)
            const px = toScreenX(telemetry.playerX);
            const py = toScreenY(telemetry.playerY);
            const pw = toScreenW(telemetry.playerW || 18);
            const ph = toScreenH(telemetry.playerH || 22);
            const ox = telemetry.playerOriginX ?? 0.5;
            const oy = telemetry.playerOriginY ?? 0.5;
            drawRect(
              dbgPx, png.width, png.height,
              px - Math.round(pw * ox), py - Math.round(ph * oy),
              px + Math.round(pw * (1 - ox)), py + Math.round(ph * (1 - oy)),
              34, 197, 94, 2
            );

            // 5. Жовтий приціл
            const tx = toScreenX(telemetry.targetX);
            drawCrosshair(
              dbgPx, png.width, png.height,
              tx, py, Math.max(6, Math.round(10 * scaleX)),
              234, 179, 8, 2
            );

            // 6. Плашка Phaser 60 FPS
            const bannerW = Math.min(420, png.width - 20);
            const bannerX = Math.round((png.width - bannerW) / 2);
            drawFilledRect(dbgPx, png.width, png.height, bannerX, 8, bannerX + bannerW, 36, 15, 23, 42, 230);
            drawRect(dbgPx, png.width, png.height, bannerX, 8, bannerX + bannerW, 36, 16, 185, 129, 2);

            const snapshotData = (png.width >= 350 && png.height >= 500)
              ? downscale2x(dbgPx, png.width, png.height)
              : { width: png.width, height: png.height, pixels: dbgPx };
            const debugBuf = encodePng(snapshotData);
            sendDebugSnapshot(ws, currentNode.id, nodeTitle || 'Fruit Runner (Phaser 60FPS)', debugBuf, {
              playerX: telemetry.playerX,
              targetX: telemetry.targetX,
              obstacles: (telemetry.obstacles || []).length,
              collectibles: (telemetry.collectibles || []).length,
              score: lastScore,
              speed: 'Phaser 60FPS',
              invincible: false,
              key: telemetry.keyHeld || 'idle',
              stuck: false,
            });
          }
        } catch (_) {}
      }

      await doSleep(40, ws);
    }

    await uninstallPhaserAutopilot(phaserTargetFrame);
    const reached = lastScore >= targetScore;
    logToClient(
      `⏱️ Завершено за часом (${maxDurationMs / 1000}с). Рахунок: ${lastScore}/${targetScore}`,
      reached ? 'success' : 'info'
    );
    return {
      data: { ...context, score: lastScore, targetScore, success: reached },
      nextHandle: reached ? 'success' : 'timeout',
    };
  }

  // ── 2. Калібрування зору ─────────────────────────────────────────────────

  logToClient('🔬 Калібрування зору — аналіз кольорів дороги...', 'info');

  let calibration: VisionCalibration | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const calBuf = await screenshotWithRetry(activePage, shotOptions);
      const calPng = await parsePng(calBuf);
      if (!calPng) {
        await doSleep(500, ws);
        continue;
      }
      const calResult = calibrateFromFrame(calPng);
      if (calResult) {
        calibration = {
          ...calResult,
          dpr,
          clipW: calPng.width,
          clipH: calPng.height,
        };
        logToClient(
          `✅ Калібрування: дорога ${calResult.roadLeft}–${calResult.roadRight}px, RGB(${calResult.roadR},${calResult.roadG},${calResult.roadB})`,
          'success'
        );
        break;
      }
    } catch (err: any) {
      logger.warn(`Calibration attempt ${attempt + 1} failed: ${err.message}`);
    }
    await doSleep(400, ws);
  }

   if (!calibration) {
    logToClient('⚠️ Калібрування не вдалось — використовую адаптивні дефолтні значення', 'info');
    calibration = {
      roadR: 194,
      roadG: 163,
      roadB: 117,
      roadLeft: 120,
      roadRight: 380,
      playerBaseY: 880,
      dpr,
      clipW: 500,
      clipH: 1000,
    };
  }

  // Застосовуємо ручні межі (якщо задані > 0 та відповідають поточній роздільності)
  const maxW = calibration.clipW || 500;
  const maxH = calibration.clipH || 1000;
  if (manualRoadLeft > 0 && manualRoadLeft < maxW - 50) {
    calibration.roadLeft = manualRoadLeft;
  }
  if (manualRoadRight > calibration.roadLeft + 50 && manualRoadRight <= maxW) {
    calibration.roadRight = manualRoadRight;
  }
  if (playerFrameTop > 0 && playerFrameBottom > playerFrameTop && playerFrameBottom <= maxH) {
    calibration.playerBaseY = Math.round((playerFrameTop + playerFrameBottom) / 2);
  }

  if (manualRoadLeft > 0 || manualRoadRight > 0 || playerFrameTop > 0) {
    logToClient(
      `📏 Ручні межі: дорога ${calibration.roadLeft}–${calibration.roadRight}px, гравець Y=${calibration.playerBaseY}`,
      'info'
    );
  }

  // ── 3. Ігровий цикл ─────────────────────────────────────────────────────

  const startTime = Date.now();
  let lastScore = 0;
  let lastLoggedScore = -1;
  let currentKeyHeld: 'ArrowLeft' | 'ArrowRight' | null = null;
  let lastSnapshotTime = 0;
  let lastRadarLogTime = 0;
  let lastPlayerX = Math.round((calibration.roadLeft + calibration.roadRight) / 2);
  let loopCount = 0;

  // Детекція замороженого екрану (Game Over без DOM-індикатора)
  let frozenFrameCount = 0;
  let prevFrameHash = 0;

  // Стан невразливості (від мухомора)
  let isInvincible = false;
  let invincibleUntil = 0;

  // Оцінка швидкості гри (зростає з часом)
  let estimatedSpeed = 1.0;

  // Детекція застрягання та відновлення фокусу Canvas
  let keyPressStartTime = 0;
  let keyPressStartX = 0;
  let lastFocusRecoverTime = 0;
  let isStuckDetected = false;

  // Трекер перешкод у часі (утримує перешкоди при наближенні до персонажа)
  interface TrackedObstacle extends DetectedObject {
    firstSeen: number;
    lastSeen: number;
    missedFrames: number;
    vy: number;
  }
  let trackedObstacles: TrackedObstacle[] = [];

  const releaseKey = async () => {
    if (currentKeyHeld && activePage && !activePage.isClosed()) {
      try {
        await activePage.keyboard.up(currentKeyHeld);
      } catch (_) { /* ігноруємо */ }
      currentKeyHeld = null;
    }
  };

  try {
    while (Date.now() - startTime < maxDurationMs) {
      // Перевірка зупинки ззовні
      if (!isRunning()) {
        logToClient('⏹️ Зупинено користувачем', 'info');
        break;
      }
      if (activePage.isClosed()) {
        logToClient('❌ Сторінку закрито', 'error');
        break;
      }
      loopCount++;

      // ── 3.1 Скріншот з retry ────────────────────────────────────────────
      let screenshotBuf: Buffer;
      try {
        screenshotBuf = await screenshotWithRetry(activePage, shotOptions, 2, 300);
      } catch {
        await doSleep(50, ws);
        continue;
      }

      const png = await parsePng(screenshotBuf);
      if (!png) {
        await doSleep(20, ws);
        continue;
      }

      // ── 3.2 Зчитування стану гри (рахунок, Game Over, Victory) ──────────
      const gameState = await extractGameState(activePage);
      if (gameState.score > 0) lastScore = Math.max(lastScore, gameState.score);

      // Перемога
      if (gameState.gameWon || lastScore >= targetScore) {
        await releaseKey();
        logToClient(
          `🏆 Перемога у Фруктовому Ранері! Рахунок: ${lastScore} >= ${targetScore}`,
          'success'
        );
        return {
          data: { ...context, score: lastScore, targetScore, success: true },
          nextHandle: 'success',
        };
      }

      // Game Over (DOM-індикатор)
      if (gameState.gameOver) {
        await releaseKey();
        logToClient(`💀 Game Over. Рахунок: ${lastScore}`, 'error');
        return {
          data: { ...context, score: lastScore, targetScore, success: false },
          nextHandle: 'failed',
        };
      }

      // ── 3.3 Детекція замороженого екрану ────────────────────────────────
      // Якщо кадр не змінюється >2 секунди — ймовірно Game Over або зависання
      let frameHash = 0;
      const hashStep = 53;
      for (let i = 0; i < png.pixels.length; i += hashStep * 4) {
        frameHash = ((frameHash * 31 + png.pixels[i]) | 0) >>> 0;
      }
      if (frameHash === prevFrameHash && loopCount > 10) {
        frozenFrameCount++;
        if (frozenFrameCount > 20) {
          await releaseKey();
          logToClient(
            `🧊 Екран заморожено (ймовірно Game Over). Рахунок: ${lastScore}`,
            'error'
          );
          return {
            data: { ...context, score: lastScore, targetScore, success: false },
            nextHandle: 'failed',
          };
        }
      } else {
        frozenFrameCount = 0;
      }
      prevFrameHash = frameHash;

      // ── 3.4 Аналіз кадру ───────────────────────────────────────────────

      // Динамічний lookahead: зростає з часом (оцінка прискорення гри)
      const elapsedSec = (Date.now() - startTime) / 1000;
      estimatedSpeed = 1 + Math.min(2, elapsedSec / 30);
      const dynamicLookahead = Math.round(baseLookahead * Math.min(1.5, estimatedSpeed));

      // Таймер невразливості
      if (Date.now() > invincibleUntil) {
        isInvincible = false;
      }

      const analysis = analyzeFrame(png, calibration, dynamicLookahead, lastPlayerX, {
        playerFrameTop: playerFrameTop || undefined,
        playerFrameBottom: playerFrameBottom || undefined,
        detectionTopY: detectionTopY || undefined,
        detectionBottomY: detectionBottomY || undefined,
      });
      lastPlayerX = analysis.playerX;

      // Перевірка чи підібрано пауер-ап (мухомор поблизу гравця)
      for (const col of analysis.collectibles) {
        if (col.category === 'powerup' && col.subtype === 'mushroom') {
          const dist = Math.hypot(col.x - analysis.playerX, col.y - analysis.playerY);
          if (dist < 35) {
            isInvincible = true;
            invincibleUntil = Date.now() + 5000;
            logToClient('🍄 Мухомор підібрано! Невразливість 5 сек!', 'success');
          }
        }
      }

      // ── 3.4.1 Трекер перешкод у часі (Temporal Obstacle Tracker) ─────────
      // Забезпечує безперервне утримання перешкод: коли перешкода наближається
      // впритул до персонажа, вона НЕ МОЖЕ раптово зникнути, доки не пройде позаду гравця.
      const defaultVy = Math.max(8, Math.round(18 * estimatedSpeed));
      const matchedTracked = new Set<number>();

      for (const newObs of analysis.obstacles) {
        let bestIdx = -1;
        let minScore = Infinity;
        for (let i = 0; i < trackedObstacles.length; i++) {
          if (matchedTracked.has(i)) continue;
          const t = trackedObstacles[i];
          const dx = Math.abs(newObs.x - t.x);
          const dy = newObs.y - t.y;
          if (dx <= 35 && dy >= -10 && dy <= 70) {
            const score = dx + Math.abs(dy - defaultVy);
            if (score < minScore) {
              minScore = score;
              bestIdx = i;
            }
          }
        }

        if (bestIdx !== -1) {
          matchedTracked.add(bestIdx);
          const t = trackedObstacles[bestIdx];
          const measuredVy = Math.max(4, Math.min(50, newObs.y - t.y));
          t.x = newObs.x;
          t.y = newObs.y;
          t.w = newObs.w;
          t.h = newObs.h;
          t.subtype = newObs.subtype;
          t.lastSeen = Date.now();
          t.missedFrames = 0;
          t.vy = Math.round(t.vy * 0.4 + measuredVy * 0.6);
        } else {
          trackedObstacles.push({
            ...newObs,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            missedFrames: 0,
            vy: defaultVy,
          });
        }
      }

      // Зберігаємо та прогнозуємо перешкоди, які тимчасово не розпізналися на поточному кадрі
      const survivingObstacles: TrackedObstacle[] = [];
      for (let i = 0; i < trackedObstacles.length; i++) {
        const t = trackedObstacles[i];
        if (matchedTracked.has(i)) {
          survivingObstacles.push(t);
        } else {
          t.missedFrames++;
          // Утримуємо перешкоду до 2 пропущених кадрів, поки вона не перетне лінію за персонажем
          if (t.missedFrames <= 2 && t.y < analysis.playerY + 25) {
            t.y += t.vy;
            survivingObstacles.push(t);
          }
        }
      }
      trackedObstacles = survivingObstacles;

      // Ефективний список перешкод для планувальника та відображення
      const effectiveObstacles: DetectedObject[] = trackedObstacles.map(t => ({
        x: t.x,
        y: t.y,
        w: t.w,
        h: t.h,
        category: t.category,
        subtype: t.subtype,
      }));

      // ── 3.5 Глобальне планування траєкторії (Global Trajectory Planner) ──
      const trajectoryScanTop = detectionTopY > 0 ? detectionTopY : Math.max(70, analysis.playerY - dynamicLookahead);
      const trajectory = planGlobalTrajectory(
        analysis.playerX,
        analysis.playerY,
        analysis.roadLeft,
        analysis.roadRight,
        effectiveObstacles,
        analysis.collectibles,
        trajectoryScanTop,
        isInvincible,
        estimatedSpeed,
        safetyMargin
      );

      // Визначаємо targetX за точкою траєкторії безпосередньо попереду персонажа (~25-45px попереду)
      let targetX = analysis.playerX;
      if (trajectory.length > 1) {
        const leadPoint = trajectory.find(p => p.y <= analysis.playerY - 25) || trajectory[1];
        targetX = leadPoint.x;
      }

      // ── 3.6 Керування (Playwright Native Keyboard) ──────────────────────
      const deltaX = targetX - analysis.playerX;
      // Поріг 10px запобігає перельоту та тремтінню між кадрами
      const moveThreshold = 10;

      if (deltaX < -moveThreshold) {
        if (currentKeyHeld === 'ArrowRight') {
          await activePage.keyboard.up('ArrowRight');
          currentKeyHeld = null;
        }
        if (currentKeyHeld !== 'ArrowLeft') {
          await activePage.keyboard.down('ArrowLeft');
          currentKeyHeld = 'ArrowLeft';
        }
      } else if (deltaX > moveThreshold) {
        if (currentKeyHeld === 'ArrowLeft') {
          await activePage.keyboard.up('ArrowLeft');
          currentKeyHeld = null;
        }
        if (currentKeyHeld !== 'ArrowRight') {
          await activePage.keyboard.down('ArrowRight');
          currentKeyHeld = 'ArrowRight';
        }
      } else {
        await releaseKey();
      }

      // ── 3.6.1 Детекція руху та авто-відновлення фокусу Canvas ─────────────
      if (currentKeyHeld) {
        if (keyPressStartTime === 0) {
          keyPressStartTime = Date.now();
          keyPressStartX = analysis.playerX;
        } else {
          const holdDuration = Date.now() - keyPressStartTime;
          const movedDist = Math.abs(analysis.playerX - keyPressStartX);
          if (holdDuration > 250 && movedDist < 5) {
            isStuckDetected = true;
            if (Date.now() - lastFocusRecoverTime > 1500) {
              lastFocusRecoverTime = Date.now();
              logToClient('⚠️ Персонаж не реагує на клавіші (втрата фокусу). Клікаю по грі...', 'info');
              activePage.evaluate(`(() => {
                var c = document.querySelector('${gameAreaSelector}');
                if (c) { c.focus(); if (c.click) c.click(); }
              })()`).catch(() => {});
            }
          } else if (movedDist >= 5) {
            isStuckDetected = false;
          }
        }
      } else {
        keyPressStartTime = 0;
        isStuckDetected = false;
      }

      // ── 3.7 Оновлення рахунку на UI ────────────────────────────────────
      if (lastScore !== lastLoggedScore && lastScore > 0) {
        lastLoggedScore = lastScore;
        logToClient(`🎯 Рахунок: ${lastScore} / ${targetScore}`, 'info');
        if (ws && typeof ws.send === 'function' && ws.readyState === 1) {
          try {
            ws.send(
              JSON.stringify({
                type: 'NODE_DISPLAY_DATA',
                nodeId: currentNode.id,
                value: `Рахунок: ${lastScore}/${targetScore}`,
              })
            );
          } catch (_) { /* ігноруємо */ }
        }
      }

      // ── 3.8 Живі логи радара (кожні 1.5 сек) ──────────────────────────
      if (Date.now() - lastRadarLogTime >= 1500) {
        lastRadarLogTime = Date.now();
        const obsList =
          effectiveObstacles.map(o => `${o.subtype}@${o.x}`).join(', ') || 'чисто';
        const colList =
          analysis.collectibles.map(c => `${c.subtype}@${c.x}`).join(', ') || 'немає';
        const action =
          deltaX < -moveThreshold
            ? '← [ВЛІВО]'
            : deltaX > moveThreshold
              ? '→ [ВПРАВО]'
              : '|| [ПРЯМО]';
        const isEmergency = effectiveObstacles.some(o => Math.abs(o.x - analysis.playerX) < 40 && o.y < analysis.playerY && analysis.playerY - o.y < 160);
        const modeTag = isInvincible ? '🛡️ [НЕВРАЗЛИВИЙ]' : isEmergency ? '🚨 [УХИЛЕННЯ]' : '🍏 [ЗБІР]';
        const stuckTag = isStuckDetected ? ' ⚠️ ЗАСТРЯГ!' : '';
        logToClient(
          `👁️ ${modeTag} Позиція X=${analysis.playerX} | ${action} → Ціль X=${targetX} | Траєкторія: ${trajectory.length} точок до Y=${trajectoryScanTop} | Перешкоди: [${obsList}] | Фрукти: [${colList}]${stuckTag} | Speed×${estimatedSpeed.toFixed(1)}`,
          'info'
        );
      }

      // ── 3.9 Живий HUD-монітор (debug snapshot у вкладку «Фото») ────────
      const effectiveSnapshotInterval = Math.max(300, snapshotInterval);
      if (enableDebugSnapshot && Date.now() - lastSnapshotTime >= effectiveSnapshotInterval) {
        lastSnapshotTime = Date.now();
        const dbgPx = Buffer.from(png.pixels);

        // 1. Межі дороги (жовті лінії)
        drawRect(dbgPx, png.width, png.height, analysis.roadLeft, 0, analysis.roadLeft + 2, png.height - 1, 234, 179, 8, 2);
        drawRect(dbgPx, png.width, png.height, analysis.roadRight - 2, 0, analysis.roadRight, png.height - 1, 234, 179, 8, 2);

        // 2. Перешкоди (червоні рамки)
        for (const obs of effectiveObstacles) {
          drawRect(
            dbgPx, png.width, png.height,
            obs.x - obs.w / 2, obs.y - obs.h / 2,
            obs.x + obs.w / 2, obs.y + obs.h / 2,
            239, 68, 68, 2
          );
        }

        // 3. Фрукти (зелені рамки) та пауер-апи (фіолетові рамки)
        for (const col of analysis.collectibles) {
          const cr = col.category === 'powerup' ? 168 : 34;
          const cg = col.category === 'powerup' ? 85 : 197;
          const cb = col.category === 'powerup' ? 247 : 94;
          drawRect(
            dbgPx, png.width, png.height,
            col.x - col.w / 2, col.y - col.h / 2,
            col.x + col.w / 2, col.y + col.h / 2,
            cr, cg, cb, 2
          );
        }

        // 4. Глобальна запланована траєкторія (яскраво-синя лінія крізь усю дорогу!)
        if (trajectory.length > 1) {
          for (let i = 0; i < trajectory.length - 1; i++) {
            const p0 = trajectory[i];
            const p1 = trajectory[i + 1];
            // 3px товщина синьої лінії
            for (let dx = -1; dx <= 1; dx++) {
              drawLine(dbgPx, png.width, png.height, p0.x + dx, p0.y, p1.x + dx, p1.y, 59, 130, 246);
            }
          }
          // Точки-маячки вздовж траєкторії
          for (const p of trajectory) {
            drawFilledRect(dbgPx, png.width, png.height, p.x - 2, p.y - 2, p.x + 2, p.y + 2, 147, 197, 253);
          }
        }

        // 5. Гравець (синя рамка, або зелена при невразливості)
        const pR = isInvincible ? 34 : 59;
        const pG = isInvincible ? 197 : 130;
        const pB = isInvincible ? 94 : 246;
        const halfW = 21;
        const halfH = (playerFrameTop > 0 && playerFrameBottom > playerFrameTop)
          ? Math.round((playerFrameBottom - playerFrameTop) / 2)
          : 28;
        drawRect(
          dbgPx, png.width, png.height,
          analysis.playerX - halfW, analysis.playerY - halfH,
          analysis.playerX + halfW, analysis.playerY + halfH,
          pR, pG, pB, isInvincible ? 3 : 2
        );

        // 6. Приціл на найближчу точку траєкторії (жовтий хрестик)
        drawCrosshair(
          dbgPx, png.width, png.height,
          targetX, analysis.playerY, 10,
          234, 179, 8, 2
        );

        // 7. КОКПІТ-ПАНЕЛЬ (Індикатор зверху кадру)
        const bannerW = Math.min(420, png.width - 20);
        const bannerX = Math.round((png.width - bannerW) / 2);
        drawFilledRect(dbgPx, png.width, png.height, bannerX, 8, bannerX + bannerW, 36, 15, 23, 42, 230);
        drawRect(dbgPx, png.width, png.height, bannerX, 8, bannerX + bannerW, 36, 51, 65, 85, 1);

        // Ліва плашка: РЕЖИМ (Ухилення = червоний, Збір = зелений, Зірка = фіолетовий)
        const isEmergency = effectiveObstacles.some(o => Math.abs(o.x - analysis.playerX) < 40 && o.y < analysis.playerY && analysis.playerY - o.y < 160);
        const modeR = isInvincible ? 168 : isEmergency ? 239 : 34;
        const modeG = isInvincible ? 85 : isEmergency ? 68 : 197;
        const modeB = isInvincible ? 247 : isEmergency ? 68 : 94;
        drawFilledRect(dbgPx, png.width, png.height, bannerX + 6, 12, bannerX + 90, 32, modeR, modeG, modeB);

        // Центральна плашка: КЛАВІАТУРА (ВЛІВО, ВПРАВО, СТОП)
        if (currentKeyHeld === 'ArrowLeft') {
          // Жовта плашка [ <--- ВЛІВО ]
          drawFilledRect(dbgPx, png.width, png.height, bannerX + 100, 12, bannerX + 220, 32, 234, 179, 8);
          drawArrow(dbgPx, png.width, png.height, bannerX + 200, 22, bannerX + 115, 22, 20, 20, 20);
        } else if (currentKeyHeld === 'ArrowRight') {
          // Жовта плашка [ ВПРАВО ---> ]
          drawFilledRect(dbgPx, png.width, png.height, bannerX + 100, 12, bannerX + 220, 32, 234, 179, 8);
          drawArrow(dbgPx, png.width, png.height, bannerX + 115, 22, bannerX + 200, 22, 20, 20, 20);
        } else {
          // Сіра плашка [ СТОП ]
          drawFilledRect(dbgPx, png.width, png.height, bannerX + 100, 12, bannerX + 220, 32, 71, 85, 105);
          drawFilledRect(dbgPx, png.width, png.height, bannerX + 155, 16, bannerX + 165, 28, 255, 255, 255);
        }

        // Права плашка: Індикатор дельти
        drawFilledRect(dbgPx, png.width, png.height, bannerX + 230, 12, bannerX + bannerW - 6, 32, 30, 41, 59);

        // Якщо виявлено застрягання або втрату фокусу — червоне попередження
        if (isStuckDetected) {
          drawFilledRect(dbgPx, png.width, png.height, bannerX + 50, 40, bannerX + bannerW - 50, 62, 239, 68, 68, 240);
        }

        try {
          const snapshotData = (png.width >= 350 && png.height >= 500)
            ? downscale2x(dbgPx, png.width, png.height)
            : { width: png.width, height: png.height, pixels: dbgPx };
          const debugBuf = encodePng(snapshotData);
          sendDebugSnapshot(ws, currentNode.id, nodeTitle || 'Fruit Runner v2', debugBuf, {
            playerX: analysis.playerX,
            targetX,
            obstacles: analysis.obstacles.length,
            collectibles: analysis.collectibles.length,
            score: lastScore,
            speed: estimatedSpeed.toFixed(1),
            invincible: isInvincible,
            key: currentKeyHeld || 'idle',
            stuck: isStuckDetected,
          });
        } catch (_) { /* ігноруємо */ }
      }

      // Адаптивна затримка: швидше при вищій швидкості гри
      const sleepMs = Math.max(10, Math.round(30 / estimatedSpeed));
      await doSleep(sleepMs, ws);
    }

    // ── Таймаут ────────────────────────────────────────────────────────────
    await releaseKey();
    const reached = lastScore >= targetScore;
    logToClient(
      `⏱️ Завершено за часом (${maxDurationMs / 1000}с). Рахунок: ${lastScore}/${targetScore}`,
      reached ? 'success' : 'info'
    );
    return {
      data: { ...context, score: lastScore, targetScore, success: reached },
      nextHandle: reached ? 'success' : 'timeout',
    };
  } catch (err: any) {
    await releaseKey();
    logger.error('FruitRunnerNode v2 error', err instanceof Error ? err : new Error(String(err)));
    logToClient(`❌ Помилка: ${err.message || String(err)}`, 'error');
    return {
      data: { ...context, score: lastScore, error: err.message },
      nextHandle: 'failed',
    };
  } finally {
    await releaseKey();
  }
};
