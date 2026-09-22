// Нода «Порятунок Кур» (ChickenRescueNode)
// Автоматичне проходження міні-гри Chicken Rescue / «Змійка з курчатами» у Sunflower Land.
// Режим Phaser Hook: прямий доступ до рушія Phaser (60 FPS tick-level autopilot),
// точний обхід перешкод (паркани, кактуси, вазони, скелі), ухиляння від гоблінів та власного хвоста,
// інтелектуальний BFS-пошук найближчих курчат і Flood-Fill перевірка безпеки від пасток.

import { NodeHandlerParams, NodeResult } from './types';
import { Page } from 'playwright';

export interface ChickenRescueConfig {
  engineMode?: 'phaser' | 'auto'; // Режим рушія (за замовчуванням 'phaser')
  targetScore?: number;           // Цільова кількість врятованих курей (за замовчуванням 40)
  autoStart?: boolean;            // Автоматичний клік Start / Retry / Play again
  maxDuration?: number;           // Максимальна тривалість гри у мс (120000)
  retryOnDeath?: boolean;         // Перезапускати гру при випадковій поразці до досягнення ліміту часу
  maxRetries?: number;            // Максимальна кількість перезапусків при поразці (за замовчуванням 3)
  browserDebug?: boolean;         // Малювати дебаг-оверлей прямо в браузері через Phaser Graphics (за замовчуванням true)
}

export interface PhaserChickenRescueSolveResult {
  success: boolean;
  score: number;
  followingCount: number;
  isDead: boolean;
  retriesUsed: number;
  durationMs: number;
  error?: string;
}

/**
 * Знаходить фрейм (або сторінку), де запущено Phaser екземпляр гри Chicken Rescue.
 */
export async function findChickenRescuePhaserFrame(page: Page): Promise<{ targetFrame: any } | null> {
  const browserContext = page.context();
  const pages = browserContext.pages();

  for (const p of pages) {
    const frames = typeof p.frames === 'function' ? p.frames() : [p];
    const sorted = [...frames].sort((a, b) => {
      const aUrl = typeof a.url === 'function' ? a.url() : '';
      const bUrl = typeof b.url === 'function' ? b.url() : '';
      return (bUrl.includes('chicken-rescue') || bUrl.includes('rescue') ? 1 : 0) -
             (aUrl.includes('chicken-rescue') || aUrl.includes('rescue') ? 1 : 0);
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
                      if (!item || item.depth > 40) continue;
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
                sc = game.scene.getScene('chicken_rescue') || game.scene.getScene('chicken-rescue');
              }
              if (!sc && game.scene && Array.isArray(game.scene.scenes)) {
                for (let i = 0; i < game.scene.scenes.length; i++) {
                  const s = game.scene.scenes[i];
                  if (s && (s.sceneId === 'chicken_rescue' || s.sys?.settings?.key === 'chicken_rescue' || s.currentPlayer)) {
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

/**
 * Автоматичне проходження гри Chicken Rescue через надшвидкий режим Phaser Hook.
 */
export async function solveChickenRescueWithPhaserHook(
  targetFrame: any,
  logToClient: (msg: string, level?: 'info' | 'error' | 'success' | 'debug') => void,
  smartSleep: (ms: number, ws?: any) => Promise<void>,
  checkRunning: () => boolean,
  ws: any,
  targetScore = 40,
  maxDuration = 120000,
  autoStart = true,
  retryOnDeath = true,
  maxRetries = 3,
  browserDebug = true
): Promise<PhaserChickenRescueSolveResult> {
  const startTime = Date.now();
  let retriesUsed = 0;

  logToClient('⏳ Очікування завантаження сцени гри «Порятунок Кур» у Phaser...', 'debug');

  // 1. Очікуємо готовності сцени
  let isReady = false;
  while (Date.now() - startTime < Math.min(maxDuration, 15000)) {
    if (!checkRunning()) {
      return { success: false, score: 0, followingCount: 0, isDead: false, retriesUsed: 0, durationMs: Date.now() - startTime, error: 'зупинено користувачем' };
    }

    const readyCheck: any = await Promise.resolve(
      targetFrame.evaluate(`(() => {
        const win = window;
        const game = win.__PHASER_GAME__;
        let sc = null;
        if (game && game.scene && typeof game.scene.getScene === 'function') {
          sc = game.scene.getScene('chicken_rescue') || game.scene.getScene('chicken-rescue');
        }
        if (!sc && game && game.scene && Array.isArray(game.scene.scenes)) {
          for (let i = 0; i < game.scene.scenes.length; i++) {
            const s = game.scene.scenes[i];
            if (s && (s.sceneId === 'chicken_rescue' || s.sys?.settings?.key === 'chicken_rescue' || s.currentPlayer)) {
              sc = s;
              break;
            }
          }
        }
        if (!sc) return { status: 'no_scene' };
        return {
          status: 'ready',
          portalState: sc.portalService?.state?.value,
          isDead: !!sc.isDead,
          score: sc.score || 0
        };
      })()`)
    ).catch(() => ({ status: 'error' }));

    if (readyCheck?.portalState === 'noAttempts') {
      logToClient('⛔ Вичерпано спроби для гри «Порятунок Кур» (потрібно розблокувати спроби в грі)!', 'error');
      return { success: false, score: readyCheck.score || 0, followingCount: 0, isDead: true, retriesUsed: 0, durationMs: Date.now() - startTime, error: 'вичерпано спроби (noAttempts)' };
    }

    if (readyCheck?.status === 'ready') {
      isReady = true;
      break;
    }
    await smartSleep(300, ws);
  }

  if (!isReady) {
    return { success: false, score: 0, followingCount: 0, isDead: false, retriesUsed: 0, durationMs: Date.now() - startTime, error: 'сцену chicken_rescue не знайдено у Phaser' };
  }

  // 2. Головний цикл спроб / проходження
  while (Date.now() - startTime < maxDuration) {
    if (!checkRunning()) {
      return { success: false, score: 0, followingCount: 0, isDead: false, retriesUsed, durationMs: Date.now() - startTime, error: 'зупинено користувачем' };
    }

    // Перевірка кнопки Start / Retry перед стартом
    if (autoStart) {
      await Promise.resolve(
        targetFrame.evaluate(`(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => {
            const t = b.innerText.trim().toLowerCase();
            return t.includes('play again') || t.includes('retry') || t.includes('start');
          });
          if (btn) btn.click();
        })()`)
      ).catch(() => {});
      await smartSleep(500, ws);
    }

    logToClient(`🎮 Підключення 60 FPS автопілота Phaser Hook до гри «Порятунок Кур»...`, 'info');

    // Встановлюємо автопілот у контексті гри
    const hookInstalled = await Promise.resolve(
      targetFrame.evaluate(`(() => {
        const win = window;
        const game = win.__PHASER_GAME__;
        let sc = null;
        if (game && game.scene && typeof game.scene.getScene === 'function') {
          sc = game.scene.getScene('chicken_rescue') || game.scene.getScene('chicken-rescue');
        }
        if (!sc && game && game.scene && Array.isArray(game.scene.scenes)) {
          for (let i = 0; i < game.scene.scenes.length; i++) {
            const s = game.scene.scenes[i];
            if (s && (s.sceneId === 'chicken_rescue' || s.sys?.settings?.key === 'chicken_rescue' || s.currentPlayer)) {
              sc = s;
              break;
            }
          }
        }
        if (!sc) return false;

        // Очищаємо попередній хук та графіку, якщо існують
        if (win.__CHICKEN_AUTOPILOT_HOOK__) {
          sc.events.off('update', win.__CHICKEN_AUTOPILOT_HOOK__);
          win.__CHICKEN_AUTOPILOT_HOOK__ = null;
        }
        if (win.__CHICKEN_DBG_GFX__) {
          try { win.__CHICKEN_DBG_GFX__.destroy(); } catch (_) {}
          win.__CHICKEN_DBG_GFX__ = null;
        }

        const DIRS = [
          { name: 'up', dx: 0, dy: -1 },
          { name: 'down', dx: 0, dy: 1 },
          { name: 'left', dx: -1, dy: 0 },
          { name: 'right', dx: 1, dy: 0 }
        ];
        const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

        // Точні межі ігрового поля всередині парканів (18x18 клітинок: [11..28, 4..21])
        // Лівий паркан X <= 10.75, правий X >= 29.25, верхній Y <= 3.75, нижній Y >= 22.25
        const MIN_CX = 11;
        const MAX_CX = 28;
        const MIN_CY = 4;
        const MAX_CY = 21;
        const CENTER_CX = 19.5;
        const CENTER_CY = 12.5;

        function isCellBlocked(cx, cy, blockedSet) {
          if (cx < MIN_CX || cx > MAX_CX || cy < MIN_CY || cy > MAX_CY) return true;
          return blockedSet.has(cx + ',' + cy);
        }

        function getBlockedGrid() {
          const blocked = new Set();
          const dangerTier1 = new Set(); // 1 клітинка від перешкоди: суворий буфер безпеки (штраф +45)
          const dangerTier2 = new Set(); // 2 клітинки від перешкоди: м'який буфер коридору (штраф +12)
          const goblinDanger = new Set();

          // 1. Статичні перешкоди зі сцени гри (скелі 1x1, вазони/валуни/ящики 2x2)
          if (Array.isArray(sc.obstacles)) {
            for (const o of sc.obstacles) {
              const obsCells = [];
              if (o.width === 2 || o.height === 2) {
                // Валуни/вазони 2x2: тіло розміром 24..28px навколо (o.x, o.y).
                // Блокуємо всі клітинки, які фізично перекриваються цим тілом
                for (let ox = -1; ox <= 1; ox++) {
                  for (let oy = -1; oy <= 1; oy++) {
                    const cx = o.x + ox;
                    const cy = o.y + oy;
                    if (cx >= MIN_CX && cx <= MAX_CX && cy >= MIN_CY && cy <= MAX_CY) {
                      obsCells.push({ x: cx, y: cy });
                    }
                  }
                }
              } else {
                obsCells.push({ x: o.x, y: o.y });
              }

              for (const c of obsCells) {
                blocked.add(c.x + ',' + c.y);
              }

              // Рівень 1: 1 клітинка навколо перешкоди (суворий буфер)
              for (const c of obsCells) {
                for (let dx = -1; dx <= 1; dx++) {
                  for (let dy = -1; dy <= 1; dy++) {
                    const nx = c.x + dx;
                    const ny = c.y + dy;
                    if (nx >= MIN_CX && nx <= MAX_CX && ny >= MIN_CY && ny <= MAX_CY) {
                      dangerTier1.add(nx + ',' + ny);
                    }
                  }
                }
              }

              // Рівень 2: 2 клітинки навколо перешкоди (м'який буфер)
              for (const c of obsCells) {
                for (let dx = -2; dx <= 2; dx++) {
                  for (let dy = -2; dy <= 2; dy++) {
                    const nx = c.x + dx;
                    const ny = c.y + dy;
                    if (nx >= MIN_CX && nx <= MAX_CX && ny >= MIN_CY && ny <= MAX_CY) {
                      dangerTier2.add(nx + ',' + ny);
                    }
                  }
                }
              }
            }
          }

          // 2. Хвіст курчат (надійне покриття всіх перекритих клітинок спрайтів)
          if (Array.isArray(sc.following)) {
            for (let i = 1; i < sc.following.length; i++) {
              const ch = sc.following[i];
              if (!ch || ch.x == null || ch.y == null) continue;
              // Кожне курча має хітбокс розміром 14x14 px
              const minCx = Math.floor((ch.x - 8) / 16);
              const maxCx = Math.floor((ch.x + 8) / 16);
              const minCy = Math.floor((ch.y - 8) / 16);
              const maxCy = Math.floor((ch.y + 8) / 16);

              for (let cx = minCx; cx <= maxCx; cx++) {
                for (let cy = minCy; cy <= maxCy; cy++) {
                  if (cx >= MIN_CX && cx <= MAX_CX && cy >= MIN_CY && cy <= MAX_CY) {
                    // Курчата з індексу 2 і вище є смертельними перешкодами
                    if (i >= 2) {
                      blocked.add(cx + ',' + cy);
                    }
                    // Зона відчуження навколо всього хвоста
                    for (let dx = -1; dx <= 1; dx++) {
                      for (let dy = -1; dy <= 1; dy++) {
                        dangerTier1.add((cx + dx) + ',' + (cy + dy));
                      }
                    }
                  }
                }
              }
            }
          }

          // 3. Траєкторія та позиції гоблінів (динамічна небезпека)
          if (Array.isArray(sc.goblins)) {
            for (const g of sc.goblins) {
              if (g?.container) {
                const gx = Math.floor(g.container.x / 16);
                const gy = Math.floor(g.container.y / 16);
                blocked.add(gx + ',' + gy);
                for (let dx = -2; dx <= 2; dx++) {
                  for (let dy = -2; dy <= 2; dy++) {
                    goblinDanger.add((gx + dx) + ',' + (gy + dy));
                  }
                }
              }
              if (g?.moveTo) {
                const mx = g.moveTo.x;
                const my = g.moveTo.y;
                blocked.add(mx + ',' + my);
                for (let dx = -1; dx <= 1; dx++) {
                  for (let dy = -1; dy <= 1; dy++) {
                    goblinDanger.add((mx + dx) + ',' + (my + dy));
                  }
                }
              }
            }
          }

          return { blocked, dangerTier1, dangerTier2, goblinDanger };
        }

        function floodFillCount(startX, startY, blocked) {
          if (isCellBlocked(startX, startY, blocked)) return 0;
          const visited = new Set([startX + ',' + startY]);
          const q = [{ x: startX, y: startY }];
          let count = 0;
          while (q.length > 0 && count < 100) {
            const cur = q.shift();
            count++;
            for (const d of DIRS) {
              const nx = cur.x + d.dx;
              const ny = cur.y + d.dy;
              const key = nx + ',' + ny;
              if (!visited.has(key) && !isCellBlocked(nx, ny, blocked)) {
                visited.add(key);
                q.push({ x: nx, y: ny });
              }
            }
          }
          return count;
        }

        // A* пошук одного відрізка маршруту з суворою буферизацією від перешкод та стін
        function aStarLeg(startX, startY, goals, blocked, dangerTier1, dangerTier2, goblinDanger, curDir) {
          const validGoals = goals.filter(g => (g.x !== startX || g.y !== startY) && !blocked.has(g.x + ',' + g.y));
          if (validGoals.length === 0) return null;

          const goalSet = new Set(validGoals.map(g => g.x + ',' + g.y));

          function heuristic(x, y) {
            let minH = 9999;
            for (const g of validGoals) {
              const h = Math.abs(x - g.x) + Math.abs(y - g.y);
              if (h < minH) minH = h;
            }
            return minH;
          }

          const open = [{
            x: startX,
            y: startY,
            g: 0,
            h: heuristic(startX, startY),
            f: heuristic(startX, startY),
            prev: null,
            dir: curDir
          }];
          const closed = new Set();
          let bestGoalNode = null;

          while (open.length > 0) {
            open.sort((a, b) => a.f - b.f);
            const cur = open.shift();
            const key = cur.x + ',' + cur.y;

            if (closed.has(key)) continue;
            closed.add(key);

            if (goalSet.has(key)) {
              bestGoalNode = cur;
              break;
            }

            const allowed = (cur.x === startX && cur.y === startY && curDir)
              ? DIRS.filter(d => d.name !== OPPOSITE[curDir])
              : DIRS.filter(d => !cur.dir || d.name !== OPPOSITE[cur.dir]);

            for (const d of allowed) {
              const nx = cur.x + d.dx;
              const ny = cur.y + d.dy;
              const nKey = nx + ',' + ny;

              if (nx < MIN_CX || nx > MAX_CX || ny < MIN_CY || ny > MAX_CY) continue;
              if (blocked.has(nKey) || closed.has(nKey)) continue;

              let stepCost = 1;
              const isGoal = goalSet.has(nKey);

              // 1. Суворий штраф за паркани (стіни арени):
              if ((nx === MIN_CX || nx === MAX_CX || ny === MIN_CY || ny === MAX_CY) && !isGoal) {
                stepCost += 60; // крайній паркан — заборонено для транзиту
              } else if ((nx === MIN_CX + 1 || nx === MAX_CX - 1 || ny === MIN_CY + 1 || ny === MAX_CY - 1) && !isGoal) {
                stepCost += 15; // 2-й ряд від паркану
              }

              // 2. Суворий штраф за наближення до перешкод (не підходити впритул!):
              if (dangerTier1.has(nKey) && !isGoal) {
                stepCost += 45; // 1 клітинка від каменя — суворо заборонено транзит, тільки підбір курки!
              } else if (dangerTier2.has(nKey) && !isGoal) {
                stepCost += 12; // 2 клітинки від каменя — тримати комфортну дистанцію
              }

              // 3. Штраф за наближення до гобліна
              if (goblinDanger.has(nKey) && !isGoal) {
                stepCost += 35;
              }

              // 4. Штраф за зміну напрямку
              if (cur.dir && cur.dir !== d.name) {
                stepCost += 0.5;
              }

              const g = cur.g + stepCost;
              const h = heuristic(nx, ny);
              const f = g + h;

              open.push({
                x: nx,
                y: ny,
                g,
                h,
                f,
                prev: cur,
                dir: d.name
              });
            }
          }

          if (!bestGoalNode) return null;

          let curr = bestGoalNode;
          const path = [{ x: curr.x, y: curr.y, dir: curr.dir }];
          while (curr.prev) {
            curr = curr.prev;
            path.unshift({ x: curr.x, y: curr.y, dir: curr.dir });
          }

          return { target: { x: bestGoalNode.x, y: bestGoalNode.y }, path, endDir: bestGoalNode.dir };
        }

        // Генерація кроків безпечного виходу у вільний центр поля подалі від перешкод
        function planEscapeSteps(fromX, fromY, inDir, blocked, dangerTier1, dangerTier2, goblinDanger, stepsCount = 6) {
          let cx = fromX;
          let cy = fromY;
          let cDir = inDir;
          const escapePath = [];

          for (let s = 0; s < stepsCount; s++) {
            const allowed = DIRS.filter(d => !cDir || d.name !== OPPOSITE[cDir]);
            let bestD = null;
            let bestScore = -99999;

            for (const d of allowed) {
              const nx = cx + d.dx;
              const ny = cy + d.dy;
              const nKey = nx + ',' + ny;
              if (nx >= MIN_CX && nx <= MAX_CX && ny >= MIN_CY && ny <= MAX_CY && !blocked.has(nKey)) {
                const space = floodFillCount(nx, ny, blocked);
                if (space < 3) continue;

                const distToCenter = Math.hypot(nx - CENTER_CX, ny - CENTER_CY);
                let score = space * 10 - distToCenter * 8;

                if (nx === MIN_CX || nx === MAX_CX || ny === MIN_CY || ny === MAX_CY) score -= 100;
                else if (nx === MIN_CX + 1 || nx === MAX_CX - 1 || ny === MIN_CY + 1 || ny === MAX_CY - 1) score -= 30;

                if (dangerTier1.has(nKey)) score -= 70;
                else if (dangerTier2.has(nKey)) score -= 20;

                if (goblinDanger.has(nKey)) score -= 60;
                if (d.name === cDir) score += 10;

                // Lookahead 2
                const a2Key = (nx + d.dx) + ',' + (ny + d.dy);
                if (nx + d.dx < MIN_CX || nx + d.dx > MAX_CX || ny + d.dy < MIN_CY || ny + d.dy > MAX_CY || blocked.has(a2Key)) {
                  score -= 30;
                }

                if (score > bestScore) {
                  bestScore = score;
                  bestD = d;
                }
              }
            }

            if (!bestD) break;
            cx += bestD.dx;
            cy += bestD.dy;
            cDir = bestD.name;
            escapePath.push({ x: cx, y: cy, dir: cDir });
          }

          return escapePath;
        }

        // Конвеєрний планувальник: ГАРАНТУЄ що в запасі ЗАВЖДИ є не менше minRemaining (6+) кроків
        // ТА СУВОРО ВАЛІДУЄ, що жодна точка маршруту не перетинає хвіст чи перешкоду!
        function ensureLookaheadBuffer(currentPath, curCellX, curCellY, curDir, sleepingChickens, blocked, dangerTier1, dangerTier2, goblinDanger, minRemaining = 6) {
          let path = [...(currentPath || [])];

          // 1. Знаходимо поточну позицію гравця у збереженому маршруті
          const curIdx = path.findIndex(p => p.x === curCellX && p.y === curCellY);
          if (curIdx >= 0) {
            path = path.slice(curIdx);
          } else {
            path = [{ x: curCellX, y: curCellY, dir: curDir }];
          }

          // 2. СУВОРА ВАЛІДАЦІЯ: перевіряємо КОЖНУ точку маршруту!
          // Якщо хоч одна точка потрапила в blocked (хвіст наповз, нова перешкода) — негайний перерахунок з нуля!
          const isPathSafe = path.every((p, idx) => idx === 0 || !blocked.has(p.x + ',' + p.y));
          if (!isPathSafe) {
            path = [{ x: curCellX, y: curCellY, dir: curDir }];
          }

          // 3. Поки в запасі маршруту попереду менше minRemaining кроків — безперервно добудовуємо вперед!
          let loopLimit = 0;
          while (path.length - 1 < minRemaining && loopLimit < 6) {
            loopLimit++;
            const lastPoint = path[path.length - 1];
            const lastDir = lastPoint.dir || curDir;

            // Шукаємо курчат, які ще не додані в поточний маршрут і не заблоковані
            const targetsInPath = new Set(path.map(p => p.x + ',' + p.y));
            const availableChickens = sleepingChickens.filter(c => !targetsInPath.has(c.x + ',' + c.y) && !blocked.has(c.x + ',' + c.y));

            if (availableChickens.length > 0) {
              const leg = aStarLeg(lastPoint.x, lastPoint.y, availableChickens, blocked, dangerTier1, dangerTier2, goblinDanger, lastDir);
              if (leg && leg.path.length > 1) {
                for (let i = 1; i < leg.path.length; i++) {
                  path.push(leg.path[i]);
                }
                continue;
              }
            }

            // Якщо доступних курей немає або вони тимчасово недосяжні —
            // добудовуємо конвеєр кроками безпечного патрулювання центру поля
            const needed = Math.max(minRemaining - (path.length - 1), 6);
            const escapeSteps = planEscapeSteps(lastPoint.x, lastPoint.y, lastDir, blocked, dangerTier1, dangerTier2, goblinDanger, needed);
            if (escapeSteps.length === 0) break;
            for (const esc of escapeSteps) {
              path.push(esc);
            }
            break;
          }

          return path;
        }

        let lastProcessedCell = '';
        let activeMultiPath = []; // Активна конвеєрна черга кроків (завжди 6+ у запасі)
        let plannedPathCells = []; // Клітинки для дебаг-оверлею

        const hook = () => {
          if (sc.isDead) return;

          const player = sc.currentPlayer;
          if (!player || !player.body) return;

          const curDir = sc.direction;
          const curCellX = Math.floor(player.x / 16);
          const curCellY = Math.floor(player.y / 16);
          const cellCenterX = curCellX * 16 + 8;
          const cellCenterY = curCellY * 16 + 8;
          const cellKey = curCellX + ',' + curCellY;

          const { blocked, dangerTier1, dangerTier2, goblinDanger } = getBlockedGrid();
          const allowedDirs = DIRS.filter(d => !curDir || d.name !== OPPOSITE[curDir]);

          // Аварійний перевізник: чи веде поточний курс руху прямо в перешкоду/стіну/хвіст
          const curD = curDir ? DIRS.find(d => d.name === curDir) : null;
          const nextCellBlocked = curD ? isCellBlocked(curCellX + curD.dx, curCellY + curD.dy, blocked) : false;

          let canTurn = false;
          if (!curDir) {
            canTurn = true;
          } else if (curDir === 'right') {
            canTurn = player.x >= cellCenterX;
          } else if (curDir === 'left') {
            canTurn = player.x <= cellCenterX;
          } else if (curDir === 'down') {
            canTurn = player.y >= cellCenterY;
          } else if (curDir === 'up') {
            canTurn = player.y <= cellCenterY;
          }

          // Поворот обов'язковий, якщо прямо попереду перешкода АБО гравець досяг центру клітинки
          if (nextCellBlocked || (canTurn && lastProcessedCell !== cellKey)) {
            const sleepingChickens = (sc.sleeping || []).map(s => ({ x: s.x, y: s.y }));
            let bestDir = null;

            // Конвеєрне оновлення буфера з повною валідацією кожної точки від хвоста і перешкод
            activeMultiPath = ensureLookaheadBuffer(activeMultiPath, curCellX, curCellY, curDir, sleepingChickens, blocked, dangerTier1, dangerTier2, goblinDanger, 6);

            // Перевіряємо перший наступний крок з конвеєра
            if (activeMultiPath && activeMultiPath.length > 1) {
              const nextStep = activeMultiPath[1];
              if (!isCellBlocked(nextStep.x, nextStep.y, blocked)) {
                bestDir = nextStep.dir;
                plannedPathCells = activeMultiPath;
              } else {
                // Якщо наступний крок заблоковано — негайне обнулення та чистий перерахунок
                activeMultiPath = ensureLookaheadBuffer([], curCellX, curCellY, curDir, sleepingChickens, blocked, dangerTier1, dangerTier2, goblinDanger, 6);
                if (activeMultiPath.length > 1 && !isCellBlocked(activeMultiPath[1].x, activeMultiPath[1].y, blocked)) {
                  bestDir = activeMultiPath[1].dir;
                  plannedPathCells = activeMultiPath;
                }
              }
            }

            // Абсолютний захист від вибору заблокованого напрямку:
            if (bestDir) {
              const dObj = DIRS.find(d => d.name === bestDir);
              if (dObj && isCellBlocked(curCellX + dObj.dx, curCellY + dObj.dy, blocked)) {
                bestDir = null; // скасовуємо заборонений крок
              }
            }

            // Аварійний розворот (якщо попереду стіна/перешкода/хвіст і конвеєр не зміг вирішити)
            if (!bestDir) {
              const safeDirs = allowedDirs.filter(d => !isCellBlocked(curCellX + d.dx, curCellY + d.dy, blocked));
              if (safeDirs.length > 0) {
                safeDirs.sort((a, b) => {
                  const aKey = (curCellX + a.dx) + ',' + (curCellY + a.dy);
                  const bKey = (curCellX + b.dx) + ',' + (curCellY + b.dy);
                  const aPerim = (curCellX + a.dx === MIN_CX || curCellX + a.dx === MAX_CX || curCellY + a.dy === MIN_CY || curCellY + a.dy === MAX_CY);
                  const bPerim = (curCellX + b.dx === MIN_CX || curCellX + b.dx === MAX_CX || curCellY + b.dy === MIN_CY || curCellY + b.dy === MAX_CY);
                  const aSpace = floodFillCount(curCellX + a.dx, curCellY + a.dy, blocked);
                  const bSpace = floodFillCount(curCellX + b.dx, curCellY + b.dy, blocked);
                  const aScore = aSpace * 10 + (dangerTier1.has(aKey) ? -50 : 0) + (aPerim ? -80 : 0);
                  const bScore = bSpace * 10 + (dangerTier1.has(bKey) ? -50 : 0) + (bPerim ? -80 : 0);
                  return bScore - aScore;
                });
                bestDir = safeDirs[0].name;
              }
            }

            if (bestDir && bestDir !== curDir) {
              // Прив'язка осі повороту для бездоганного проходження кутів
              if (bestDir === 'up' || bestDir === 'down') {
                player.x = cellCenterX;
                if (player.body) player.body.position.x = cellCenterX - player.body.halfWidth;
              } else if (bestDir === 'left' || bestDir === 'right') {
                player.y = cellCenterY;
                if (player.body) player.body.position.y = cellCenterY - player.body.halfHeight;
              }

              sc.queuedDirection = bestDir;
              // Миттєве застосування швидкості та реєстрація pivot у рушії Phaser
              if (typeof sc.updateDirection === 'function') {
                sc.updateDirection();
              }

              // Синхронізація cursorKeys
              if (sc.cursorKeys) {
                for (const k of ['up', 'down', 'left', 'right']) {
                  if (sc.cursorKeys[k]) sc.cursorKeys[k].isDown = (k === bestDir);
                }
              }

              try {
                const keyMap = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
                window.dispatchEvent(new KeyboardEvent('keydown', { key: keyMap[bestDir] || bestDir, code: keyMap[bestDir] || bestDir, bubbles: true }));
              } catch (_) {}
            }

            lastProcessedCell = cellKey;
          }

          // 6. In-browser дебаг-оверлей через Phaser Graphics (якщо browserDebug=true)
          if (${browserDebug}) {
            try {
              let dbg = win.__CHICKEN_DBG_GFX__;
              if (!dbg || dbg.scene !== sc || !dbg.active) {
                if (dbg?.destroy) try { dbg.destroy(); } catch (_) {}
                dbg = sc.add.graphics();
                dbg.setDepth(99999);
                win.__CHICKEN_DBG_GFX__ = dbg;
              }
              dbg.clear();

              // 1. Межі ігрової арени та внутрішній безпечний периметр
              dbg.lineStyle(2, 0x22c55e, 0.7);
              dbg.strokeRect(MIN_CX * 16, MIN_CY * 16, (MAX_CX - MIN_CX + 1) * 16, (MAX_CY - MIN_CY + 1) * 16);
              dbg.lineStyle(1, 0x10b981, 0.4);
              dbg.strokeRect((MIN_CX + 1) * 16, (MIN_CY + 1) * 16, (MAX_CX - MIN_CX - 1) * 16, (MAX_CY - MIN_CY - 1) * 16);

              // 2. Багаторівневі буферні зони безпеки навколо перешкод
              // Рівень 2 (м'який буфер коридору на 2 клітинки):
              dbg.fillStyle(0xfef08a, 0.08);
              for (const k of dangerTier2) {
                if (!blocked.has(k) && !dangerTier1.has(k)) {
                  const [bx, by] = k.split(',').map(Number);
                  dbg.fillRect(bx * 16, by * 16, 16, 16);
                }
              }
              // Рівень 1 (сувора зона відчуження на 1 клітинку):
              dbg.fillStyle(0xf59e0b, 0.25);
              for (const k of dangerTier1) {
                if (!blocked.has(k)) {
                  const [bx, by] = k.split(',').map(Number);
                  dbg.fillRect(bx * 16, by * 16, 16, 16);
                }
              }

              // 3. Зони динамічної небезпеки гоблінів (напівпрозоре фіолетове підсвічування)
              dbg.fillStyle(0xa855f7, 0.15);
              for (const k of goblinDanger) {
                if (!blocked.has(k)) {
                  const [gx, gy] = k.split(',').map(Number);
                  dbg.fillRect(gx * 16, gy * 16, 16, 16);
                }
              }

              // 4. Статичні перешкоди (червоні прямокутники точно за позицією спрайтів)
              if (Array.isArray(sc.obstacles)) {
                dbg.fillStyle(0xef4444, 0.4);
                dbg.lineStyle(1, 0xef4444, 0.9);
                for (const o of sc.obstacles) {
                  if (o.width === 2 || o.height === 2) {
                    const ox = (o.x - 1) * 16;
                    const oy = (o.y - 1) * 16;
                    dbg.fillRect(ox, oy, 32, 32);
                    dbg.strokeRect(ox, oy, 32, 32);
                  } else {
                    const ox = o.x * 16;
                    const oy = o.y * 16;
                    dbg.fillRect(ox, oy, 16, 16);
                    dbg.strokeRect(ox, oy, 16, 16);
                  }
                }
              }

              // 5. Сплячі курчата (золоті кружечки + біле кільце)
              if (Array.isArray(sc.sleeping)) {
                for (const s of sc.sleeping) {
                  const sx = s.x * 16 + 8;
                  const sy = s.y * 16 + 8;
                  dbg.fillStyle(0xfbbf24, 0.9);
                  dbg.fillCircle(sx, sy, 5);
                  dbg.lineStyle(1, 0xffffff, 0.8);
                  dbg.strokeCircle(sx, sy, 7);
                }
              }

              // 6. Гобліни (фіолетові рамки + вектор напрямку)
              if (Array.isArray(sc.goblins)) {
                for (const g of sc.goblins) {
                  if (g?.container) {
                    const gx = g.container.x;
                    const gy = g.container.y;
                    dbg.lineStyle(2, 0xa855f7, 0.9);
                    dbg.strokeRect(gx - 8, gy - 8, 16, 16);
                    if (g.moveTo) {
                      const mx = g.moveTo.x * 16 + 8;
                      const my = g.moveTo.y * 16 + 8;
                      dbg.lineStyle(1, 0xa855f7, 0.5);
                      dbg.lineBetween(gx, gy, mx, my);
                      dbg.fillStyle(0xa855f7, 0.5);
                      dbg.fillCircle(mx, my, 4);
                    }
                  }
                }
              }

              // 7. Хвіст курчат (перші 3 зелені, решта небезпечні помаранчеві)
              if (Array.isArray(sc.following)) {
                for (let i = 0; i < sc.following.length; i++) {
                  const fch = sc.following[i];
                  if (!fch) continue;
                  const fx = fch.x;
                  const fy = fch.y;
                  if (i <= 2) {
                    dbg.fillStyle(0x10b981, 0.8);
                    dbg.fillCircle(fx, fy, 4);
                  } else {
                    dbg.lineStyle(2, 0xf97316, 0.9);
                    dbg.strokeCircle(fx, fy, 5);
                  }
                }
              }

              // 8. Запланований конвеєрний маршрут A* (завжди 6+ кроків уперед)
              if (plannedPathCells && plannedPathCells.length > 1) {
                for (let pi = 0; pi < plannedPathCells.length - 1; pi++) {
                  const p0 = plannedPathCells[pi];
                  const p1 = plannedPathCells[pi + 1];
                  const isFar = (pi >= 3);
                  const color = isFar ? 0x10b981 : 0x06b6d4;
                  dbg.lineStyle(2, color, isFar ? 0.75 : 0.95);
                  dbg.lineBetween(p0.x * 16 + 8, p0.y * 16 + 8, p1.x * 16 + 8, p1.y * 16 + 8);
                }
                for (let pi = 0; pi < plannedPathCells.length; pi++) {
                  const pp = plannedPathCells[pi];
                  const isFar = (pi >= 3);
                  dbg.fillStyle(isFar ? 0x10b981 : 0x06b6d4, isFar ? 0.8 : 1.0);
                  dbg.fillCircle(pp.x * 16 + 8, pp.y * 16 + 8, isFar ? 2.0 : 2.5);
                }
              }

              // 7. Хітбокс гравця (синя рамка) + покажчик вектору курсу
              const px = player.x;
              const py = player.y;
              dbg.lineStyle(2, 0x3b82f6, 1.0);
              dbg.strokeRect(px - 7, py - 7, 14, 14);

              const dObj = DIRS.find(d => d.name === (sc.direction || 'right'));
              if (dObj) {
                dbg.lineStyle(2, 0x60a5fa, 1.0);
                dbg.lineBetween(px, py, px + dObj.dx * 12, py + dObj.dy * 12);
                dbg.fillStyle(0x60a5fa, 1.0);
                dbg.fillCircle(px + dObj.dx * 12, py + dObj.dy * 12, 2.5);
              }
            } catch (_) {}
          }
        };

        win.__CHICKEN_AUTOPILOT_HOOK__ = hook;
        sc.events.on('update', hook);

        // Старт руху, якщо гра щойно перезапустилася
        if (!sc.direction && sc.currentPlayer?.body) {
          sc.queuedDirection = 'right';
          if (typeof sc.updateDirection === 'function') {
            sc.updateDirection();
          }
        }

        return true;
      })()`)
    ).catch(() => false);

    if (!hookInstalled) {
      return { success: false, score: 0, followingCount: 0, isDead: false, retriesUsed, durationMs: Date.now() - startTime, error: 'не вдалося встановити хук автопілота' };
    }

    logToClient(`🚀 Автопілот активний! Збираю курей...`, 'success');

    // 3. Моніторинг ходу гри
    let lastReportedScore = -1;
    let victory = false;
    let lastState: any = null;

    while (Date.now() - startTime < maxDuration) {
      if (!checkRunning()) {
        await targetFrame.evaluate(`(() => {
          const win = window;
          const game = win.__PHASER_GAME__;
          const sc = game?.scene?.scenes?.find(s => s.sceneId === 'chicken_rescue') || game?.scene?.scenes?.[0];
          if (sc && win.__CHICKEN_AUTOPILOT_HOOK__) {
            sc.events.off('update', win.__CHICKEN_AUTOPILOT_HOOK__);
            win.__CHICKEN_AUTOPILOT_HOOK__ = null;
          }
          if (win.__CHICKEN_DBG_GFX__) {
            try { win.__CHICKEN_DBG_GFX__.destroy(); } catch (_) {}
            win.__CHICKEN_DBG_GFX__ = null;
          }
        })()`).catch(() => {});
        return { success: false, score: lastReportedScore > 0 ? lastReportedScore : 0, followingCount: 0, isDead: false, retriesUsed, durationMs: Date.now() - startTime, error: 'зупинено користувачем' };
      }

      lastState = await Promise.resolve(
        targetFrame.evaluate(`(() => {
          const win = window;
          const game = win.__PHASER_GAME__;
          let sc = null;
          if (game && game.scene && typeof game.scene.getScene === 'function') {
            sc = game.scene.getScene('chicken_rescue') || game.scene.getScene('chicken-rescue');
          }
          if (!sc && game && game.scene && Array.isArray(game.scene.scenes)) {
            for (let i = 0; i < game.scene.scenes.length; i++) {
              const s = game.scene.scenes[i];
              if (s && (s.sceneId === 'chicken_rescue' || s.sys?.settings?.key === 'chicken_rescue' || s.currentPlayer)) {
                sc = s;
                break;
              }
            }
          }
          if (!sc) return null;
          return {
            score: sc.score || 0,
            isDead: !!sc.isDead,
            followingCount: sc.following ? sc.following.filter(Boolean).length : 0,
            portalState: sc.portalService?.state?.value,
            target: sc.target || 40
          };
        })()`)
      ).catch(() => null);

      if (lastState) {
        if (lastState.score !== lastReportedScore) {
          lastReportedScore = lastState.score;
          logToClient(`🐔 Врятовано курей: ${lastState.score} / ${targetScore} (у конзі: ${lastState.followingCount})`, 'info');
        }

        // Перевірка досягнення цілі
        if (lastState.score >= targetScore) {
          victory = true;
          break;
        }

        // Перевірка поразки або вичерпання спроб
        if (lastState.isDead || lastState.portalState === 'loser' || lastState.portalState === 'gameOver' || lastState.portalState === 'noAttempts') {
          break;
        }
      }

      await smartSleep(400, ws);
    }

    // Видаляємо хук після раунду
    await Promise.resolve(
      targetFrame.evaluate(`(() => {
        const win = window;
        const game = win.__PHASER_GAME__;
        let sc = null;
        if (game && game.scene && typeof game.scene.getScene === 'function') {
          sc = game.scene.getScene('chicken_rescue') || game.scene.getScene('chicken-rescue');
        }
        if (!sc && game && game.scene && Array.isArray(game.scene.scenes)) {
          for (let i = 0; i < game.scene.scenes.length; i++) {
            const s = game.scene.scenes[i];
            if (s && (s.sceneId === 'chicken_rescue' || s.sys?.settings?.key === 'chicken_rescue' || s.currentPlayer)) {
              sc = s;
              break;
            }
          }
        }
        if (sc && win.__CHICKEN_AUTOPILOT_HOOK__) {
          sc.events.off('update', win.__CHICKEN_AUTOPILOT_HOOK__);
          win.__CHICKEN_AUTOPILOT_HOOK__ = null;
        }
        if (win.__CHICKEN_DBG_GFX__) {
          try { win.__CHICKEN_DBG_GFX__.destroy(); } catch (_) {}
          win.__CHICKEN_DBG_GFX__ = null;
        }
      })()`)
    ).catch(() => {});

    if (victory) {
      logToClient(`🎉 Ціль досягнуто! Врятовано ${lastState?.score || targetScore} курей!`, 'success');
      return {
        success: true,
        score: lastState?.score || targetScore,
        followingCount: lastState?.followingCount || 0,
        isDead: false,
        retriesUsed,
        durationMs: Date.now() - startTime
      };
    }

    if (lastState?.portalState === 'noAttempts') {
      logToClient(`⛔ Вичерпано спроби для гри «Порятунок Кур» (потрібно розблокувати спроби в грі)!`, 'error');
      return {
        success: (lastState?.score || 0) > 0,
        score: lastState?.score || 0,
        followingCount: lastState?.followingCount || 0,
        isDead: true,
        retriesUsed,
        durationMs: Date.now() - startTime,
        error: 'вичерпано спроби (noAttempts)'
      };
    }

    if (lastState?.isDead) {
      retriesUsed++;
      logToClient(`⚠️ Зіткнення! Поточний рахунок: ${lastState.score}.`, 'info');
      if (retryOnDeath && retriesUsed <= maxRetries && Date.now() - startTime < maxDuration) {
        logToClient(`🔄 Перезапуск спроби (${retriesUsed}/${maxRetries})...`, 'info');
        await smartSleep(800, ws);
        continue;
      } else {
        return {
          success: lastState.score > 0,
          score: lastState.score,
          followingCount: lastState.followingCount,
          isDead: true,
          retriesUsed,
          durationMs: Date.now() - startTime,
          error: retriesUsed > maxRetries ? 'вичерпано кількість спроб' : 'гравець загинув'
        };
      }
    }
  }

  return {
    success: false,
    score: 0,
    followingCount: 0,
    isDead: false,
    retriesUsed,
    durationMs: Date.now() - startTime,
    error: 'таймаут гри'
  };
}

// ─── Головний обробник ноди ──────────────────────────────────────────────────

export const chickenRescueNodeHandler = async ({
  currentNode,
  activePage,
  context,
  ws,
  logToClient,
  smartSleep,
  checkRunning,
}: NodeHandlerParams): Promise<NodeResult> => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const {
    engineMode = 'phaser',
    targetScore = 40,
    autoStart = true,
    maxDuration = 120000,
    retryOnDeath = true,
    maxRetries = 3,
    browserDebug = true
  } = nodeData;

  const target = typeof targetScore === 'number' ? targetScore : 40;
  const maxTime = typeof maxDuration === 'number' ? maxDuration : 120000;
  const autoStartVal = typeof autoStart === 'boolean' ? autoStart : true;
  const retryVal = typeof retryOnDeath === 'boolean' ? retryOnDeath : true;
  const retriesLimit = typeof maxRetries === 'number' ? maxRetries : 3;
  const browserDebugVal = typeof browserDebug === 'boolean' ? browserDebug : true;

  logToClient(`🐥 Нода «Порятунок Кур» (Chicken Rescue): старт [Ціль: ${target} курей, Режим: ${engineMode === 'phaser' ? '🎮 Phaser Hook' : '⚡ Авто'}]...`, 'info');

  if (!activePage) {
    logToClient('❌ Немає активної сторінки браузера. Переконайтеся, що сесія запущена.', 'error');
    return { data: { ...context, error: 'немає активної сторінки' }, nextHandle: ['error'] };
  }

  logToClient('🔍 [Phaser Hook] Пошук рушія гри «Порятунок Кур» у відкритих фреймах...', 'debug');
  const phaserInfo = await findChickenRescuePhaserFrame(activePage);

  if (!phaserInfo) {
    logToClient('❌ Режим Phaser Hook увімкнено, але фрейм або рушій гри «Порятунок Кур» не знайдено!', 'error');
    return { data: { ...context, error: 'рушій chicken_rescue не знайдено' }, nextHandle: ['error'] };
  }

  logToClient('⚡ Знайдено рушій Phaser гри «Порятунок Кур»! Запуск 60 FPS автопілота...', 'success');

  const res = await solveChickenRescueWithPhaserHook(
    phaserInfo.targetFrame,
    logToClient,
    smartSleep,
    checkRunning,
    ws,
    target,
    maxTime,
    autoStartVal,
    retryVal,
    retriesLimit,
    browserDebugVal
  );

  if (res.success) {
    logToClient(`🎉 Успіх! Врятовано ${res.score} курей за ${(res.durationMs / 1000).toFixed(1)}с!`, 'success');
    return {
      data: {
        ...context,
        score: res.score,
        followingCount: res.followingCount,
        retriesUsed: res.retriesUsed,
        durationMs: res.durationMs,
        value: res.score
      },
      nextHandle: [null, undefined, 'success']
    };
  } else {
    logToClient(`❌ Гра завершилась без досягнення цілі: ${res.error || 'помилка'} (Рахунок: ${res.score})`, 'error');
    return {
      data: {
        ...context,
        score: res.score,
        followingCount: res.followingCount,
        retriesUsed: res.retriesUsed,
        error: res.error,
        value: res.score
      },
      nextHandle: ['fail', 'error']
    };
  }
};
