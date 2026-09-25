import { Page } from 'playwright';
import { Logger } from '../logger';
import { NodeHandlerParams, NodeResult, WorldNavigatorNodeData } from './types';

const logger = new Logger('WorldNavigatorNode');

/**
 * Локації відкритого світу Sunflower Land та відповідні URL-хеші
 */
const WORLD_LOCATIONS: Record<string, string> = {
  plaza: 'https://sunflower-land.com/play/#/world/plaza',
  beach: 'https://sunflower-land.com/play/#/world/beach',
  retreat: 'https://sunflower-land.com/play/#/world/retreat',
  kingdom: 'https://sunflower-land.com/play/#/world/kingdom',
  infernos: 'https://sunflower-land.com/play/#/world/infernos',
  stream: 'https://sunflower-land.com/play/#/world/stream',
  love_island: 'https://sunflower-land.com/play/#/world/love_island',
};

/**
 * Карта відповідності NPC та їхніх локацій відкритого світу
 */
const NPC_LOCATION_MAP: Record<string, string> = {
  // Plaza NPCs
  blacksmith: 'plaza',
  коваль: 'plaza',
  кузнец: 'plaza',
  betty: 'plaza',
  бетті: 'plaza',
  бетти: 'plaza',
  grimbly: 'plaza',
  грімблі: 'plaza',
  grimtooth: 'plaza',
  грімтуз: 'plaza',
  chase: 'plaza',
  чейз: 'plaza',
  peggy: 'plaza',
  пеггі: 'plaza',
  'hammerin harry': 'plaza',
  harry: 'plaza',
  гаррі: 'plaza',
  poppy: 'plaza',
  поппі: 'plaza',
  stella: 'plaza',
  стелла: 'plaza',
  mayor: 'plaza',
  мер: 'plaza',
  bailey: 'plaza',
  бейлі: 'plaza',
  eins: 'plaza',
  айнс: 'plaza',
  "pumpkin' pete": 'plaza',
  'pumpkin pete': 'plaza',
  pete: 'plaza',
  піт: 'plaza',
  'гарбузовий піт': 'plaza',
  bert: 'plaza',
  берт: 'plaza',
  timmy: 'plaza',
  тіммі: 'plaza',
  raven: 'plaza',
  ворон: 'plaza',
  ворона: 'plaza',
  cornwell: 'plaza',
  корнуелл: 'plaza',
  tywin: 'plaza',
  тайвін: 'plaza',
  hank: 'plaza',
  ганк: 'plaza',

  // Beach NPCs
  miranda: 'beach',
  міранда: 'beach',
  finn: 'beach',
  фінн: 'beach',
  finley: 'beach',
  фінлі: 'beach',
  tango: 'beach',
  танго: 'beach',
  'old salty': 'beach',
  солоний: 'beach',
  corale: 'beach',
  корале: 'beach',
};

/**
 * Карта перекладу та аліасів імен NPC
 */
const NPC_ALIAS_MAP: Record<string, string> = {
  'коваль': 'blacksmith',
  'кузнец': 'blacksmith',
  'бетті': 'betty',
  'бетти': 'betty',
  'грімблі': 'grimbly',
  'грімтуз': 'grimtooth',
  'чейз': 'chase',
  'пеггі': 'peggy',
  'гаррі': 'hammerin harry',
  'поппі': 'poppy',
  'стелла': 'stella',
  'мер': 'mayor',
  'бейлі': 'bailey',
  'айнс': 'eins',
  'піт': "pumpkin' pete",
  'гарбузовий піт': "pumpkin' pete",
  'pumpkin pete': "pumpkin' pete",
  'берт': 'bert',
  'тіммі': 'timmy',
  'ворон': 'raven',
  'ворона': 'raven',
  'тайвін': 'tywin',
  'ганк': 'hank',
  'міранда': 'miranda',
  'фінн': 'finn',
  'фінлі': 'finley',
  'танго': 'tango',
  'солоний': 'old salty',
  'корале': 'corale',
};

/**
 * Очікує завантаження активної Phaser сцени світу.
 * Використовує DOM <script> ін'єкцію для повного обходу Firefox/Camoufox XrayWrappers.
 */
async function waitForWorldScene(
  page: Page,
  maxWaitMs = 15000,
  expectedLocation?: string
): Promise<{ sceneKey: string; npcs: string[] } | null> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const info = await page.evaluate((expectedLoc) => {
        try {
          if (!document || !document.documentElement || !document.body) {
            return null;
          }

          // Закриваємо модальні вікна/попапи якщо з'явилися
          try {
            const closeBtns = Array.from(document.querySelectorAll('img[src*="close"], button, .cursor-pointer')).filter(el => {
              const src = (el as HTMLImageElement).src || '';
              const text = (el as HTMLElement).innerText || '';
              return src.includes('close') || text.trim() === '✕' || text.trim() === 'X';
            });
            for (const btn of closeBtns) {
              try { (btn as HTMLElement).click(); } catch (_) {}
            }
          } catch (_) {}

          delete document.body.dataset.__sf_scene_info;
          const script = document.createElement('script');
          script.textContent = `
            (() => {
              try {
                const targetLoc = ${JSON.stringify(expectedLoc || null)};
                let game = window.__SF_GAME__;
                
                // Перевіряємо актуальність збереженого посилання на Phaser гру
                if (game && (game.isDestroyed || !game.scene || !game.scene.scenes || game.scene.scenes.length === 0)) {
                  game = null;
                  delete window.__SF_GAME__;
                }

                // 1. Пошук через React root fiber
                if (!game) {
                  const rootEl = document.getElementById('root');
                  if (rootEl) {
                    const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
                    if (fiberKey) {
                      let rootFiber = rootEl[fiberKey];
                      if (rootFiber && rootFiber.current) rootFiber = rootFiber.current;
                      let visited = 0;
                      const queue = [{ fiber: rootFiber, depth: 0 }];
                      while (queue.length > 0 && visited < 4000) {
                        visited++;
                        const item = queue.shift();
                        const curr = item.fiber;
                        if (!curr) continue;
                        let s = curr.memoizedState;
                        while (s) {
                          if (s.memoizedState) {
                            const val = s.memoizedState;
                            if (val.current && (val.current.scene || val.current.isBooted)) {
                              game = val.current;
                              break;
                            }
                            if (val.scene || val.isBooted) {
                              game = val;
                              break;
                            }
                          }
                          s = s.next;
                        }
                        if (game) break;
                        if (curr.stateNode && (curr.stateNode.scene || curr.stateNode.isBooted)) {
                          game = curr.stateNode;
                          break;
                        }
                        if (curr.child) queue.push({ fiber: curr.child, depth: item.depth + 1 });
                        if (curr.sibling) queue.push({ fiber: curr.sibling, depth: item.depth });
                      }
                    }
                  }
                }

                // 2. Якщо не знайдено через root fiber, пошук через canvas fiber
                if (!game) {
                  const canvas = document.querySelector('canvas');
                  if (canvas) {
                    const fiberKey = Object.keys(canvas).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactContainer'));
                    if (fiberKey) {
                      let curr = canvas[fiberKey];
                      let depth = 0;
                      while (curr && depth < 30) {
                        depth++;
                        let s = curr.memoizedState;
                        while (s) {
                          const val = s.memoizedState;
                          if (val?.current?.scene || val?.scene) {
                            game = val.current || val;
                            break;
                          }
                          s = s.next;
                        }
                        if (game) break;
                        curr = curr.return;
                      }
                    }
                  }
                }

                if (!game || !game.scene || !game.scene.scenes) {
                  document.body.dataset.__sf_scene_info = JSON.stringify({ ok: false });
                  return;
                }

                window.__SF_GAME__ = game;

                // Шукаємо сцену: або за очікуваним ключем, або будь-яку активну сцену з гравцем
                let activeScene = null;
                if (targetLoc && targetLoc !== 'current' && targetLoc !== 'custom') {
                  activeScene = game.scene.getScene(targetLoc);
                  if (activeScene && (!activeScene.sys?.settings?.active || !activeScene.currentPlayer || !activeScene.map)) {
                    activeScene = null;
                  }
                }

                if (!activeScene) {
                  activeScene = game.scene.scenes.find(s => s.sys && s.sys.settings && s.sys.settings.active && s.currentPlayer && s.map);
                }

                if (!activeScene) {
                  document.body.dataset.__sf_scene_info = JSON.stringify({ ok: false });
                  return;
                }

                const sceneKey = activeScene.sys.settings.key;
                const npcs = activeScene.npcs ? Object.keys(activeScene.npcs) : [];

                document.body.dataset.__sf_scene_info = JSON.stringify({
                  ok: true,
                  sceneKey,
                  npcs
                });
              } catch (e) {
                document.body.dataset.__sf_scene_info = JSON.stringify({ ok: false, error: e.message });
              }
            })();
          `;
          document.documentElement.appendChild(script);
          script.remove();

          const raw = document.body.dataset.__sf_scene_info;
          delete document.body.dataset.__sf_scene_info;
          if (raw) {
            const data = JSON.parse(raw);
            if (data && data.ok) {
              return { sceneKey: data.sceneKey, npcs: data.npcs };
            }
          }
          return null;
        } catch (_) {
          return null;
        }
      }, expectedLocation) as { sceneKey: string; npcs: string[] } | null;

      if (info && info.sceneKey) {
        if (!expectedLocation || expectedLocation === 'current' || expectedLocation === 'custom' || info.sceneKey === expectedLocation) {
          return info;
        }
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 400));
  }
  return null;
}

/**
 * Головний обробник ноди «Навігатор по світу / До NPC»
 */
export const worldNavigatorNodeHandler = async ({
  currentNode,
  activePage,
  logToClient,
  context,
  checkRunning,
}: NodeHandlerParams): Promise<NodeResult> => {
  try {
    const data = (currentNode.data || {}) as WorldNavigatorNodeData;
    const targetLocation = data.targetLocation || 'current';
    const targetNpc = (data.targetNpc || '').trim();
    const customNpcName = (data.customNpcName || '').trim();
    const autoInteract = data.autoInteract !== false;
    const interactionDistance = Number(data.interactionDistance) || 35;
    const timeoutSeconds = Number(data.timeoutSeconds) || 35;

    // Визначаємо ім'я цільового NPC або координати
    const effectiveNpcTarget = (targetNpc === 'custom' || !targetNpc) ? customNpcName : targetNpc;
    const rawCoords = data.customCoords;
    const hasValidCoords = rawCoords && typeof rawCoords.x === 'number' && typeof rawCoords.y === 'number' && (rawCoords.x !== 0 || rawCoords.y !== 0);
    const customCoords = hasValidCoords ? rawCoords : null;

    if (!effectiveNpcTarget && !customCoords) {
      logToClient('❌ [Навігатор] Не вказано цільового NPC або координати!', 'error');
      return { data: context, nextHandle: ['error'] };
    }

    const normTarget = effectiveNpcTarget.trim().toLowerCase();
    const canonicalNpc = NPC_ALIAS_MAP[normTarget] || normTarget;

    // Автоматичне визначення локації якщо встановлено 'current', але відомо де знаходиться цей NPC
    let effectiveTargetLocation = targetLocation;
    if (effectiveTargetLocation === 'current' && (NPC_LOCATION_MAP[normTarget] || NPC_LOCATION_MAP[canonicalNpc])) {
      const knownLoc = NPC_LOCATION_MAP[normTarget] || NPC_LOCATION_MAP[canonicalNpc];
      const curUrl = activePage && typeof activePage.url === 'function' ? activePage.url() : '';
      if (!curUrl.includes(`#/world/${knownLoc}`)) {
        logToClient(`💡 [Навігатор] NPC «${effectiveNpcTarget}» знаходиться у локації «${knownLoc}». Автовибір локації: ${knownLoc}`, 'info');
        effectiveTargetLocation = knownLoc as any;
      }
    }

    const targetDesc = effectiveNpcTarget ? `NPC «${effectiveNpcTarget}»` : `координати (${customCoords?.x}, ${customCoords?.y})`;
    logToClient(`🧭 [Навігатор] Старт навігації до ${targetDesc} (локація: ${effectiveTargetLocation})...`, 'info');

    // ─── 1. Перевірка локації та перехід за потреби ───────────────────────────
    let currentScene: { sceneKey: string; npcs: string[] } | null = null;

    if (effectiveTargetLocation !== 'current') {
      let targetUrl = WORLD_LOCATIONS[effectiveTargetLocation];
      if (effectiveTargetLocation === 'custom' && data.customLocationUrl) {
        targetUrl = data.customLocationUrl;
      }

      if (targetUrl) {
        const currentUrl = activePage && typeof activePage.url === 'function' ? activePage.url() : '';
        const targetHash = targetUrl.slice(targetUrl.indexOf('#'));
        
        // Перевіряємо, чи вже активна потрібна сцена на поточній сторінці
        if (currentUrl.includes(targetHash)) {
          currentScene = await waitForWorldScene(activePage, 2500, effectiveTargetLocation);
        }

        if (!currentScene) {
          logToClient(`🌐 [Навігатор] Перехід у локацію «${effectiveTargetLocation}» (${targetUrl})...`, 'info');
          
          if (typeof activePage.goto === 'function') {
            try {
              await activePage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            } catch (navErr) {
              logger.warn('activePage.goto timed out, trying reload...', { error: String(navErr) });
              if (typeof activePage.reload === 'function') {
                await activePage.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
              }
            }
          }

          logToClient(`⏳ [Навігатор] Очікування завантаження сцени Phaser для «${effectiveTargetLocation}»...`, 'debug');
          currentScene = await waitForWorldScene(activePage, 25000, effectiveTargetLocation);

          if (!currentScene && typeof activePage.reload === 'function') {
            logToClient('⚠️ [Навігатор] Сцена ще завантажується, виконується оновлення сторінки...', 'info');
            await activePage.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
            currentScene = await waitForWorldScene(activePage, 20000, effectiveTargetLocation);
          }

          if (!currentScene) {
            logToClient(`❌ [Навігатор] Не вдалося завантажити сцену світу для локації «${effectiveTargetLocation}»!`, 'error');
            return { data: context, nextHandle: ['error'] };
          }
          logToClient(`✅ [Навігатор] Сцена «${currentScene.sceneKey}» активна! (Доступно NPC: ${currentScene.npcs.length})`, 'success');
        }
      }
    }

    // Переконуємось, що сцена активна
    if (!currentScene) {
      currentScene = await waitForWorldScene(activePage, 8000, effectiveTargetLocation !== 'current' ? effectiveTargetLocation : undefined);
    }

    if (!currentScene) {
      logToClient('❌ [Навігатор] Активна сцена відкритого світу Phaser не знайдена! Переконайтеся, що бот знаходиться у відкритому світі (Plaza/Beach) або вкажіть відповідну локацію в налаштуваннях ноди.', 'error');
      return { data: context, nextHandle: ['error'] };
    }

    logToClient(`📍 [Навігатор] Поточна сцена: «${currentScene.sceneKey}». Пошук цілі та розрахунок шляху...`, 'info');

    // ─── 2. Виконання A* автопілота у браузері через DOM Script ──────────────
    const navPayload = {
      effectiveNpcTarget: effectiveNpcTarget.toLowerCase(),
      canonicalTarget: canonicalNpc,
      customCoords,
      interactionDistance,
      timeoutSeconds,
      autoInteract,
    };

    let startNavResult: any = null;
    try {
      startNavResult = await activePage.evaluate((params) => {
        if (!document || !document.body || !document.documentElement) {
          return null;
        }

        // Закриваємо блокуючі модальні вікна якщо відкриті
        try {
          const closeBtns = Array.from(document.querySelectorAll('img[src*="close"], button, .cursor-pointer')).filter(el => {
            const src = (el as HTMLImageElement).src || '';
            const text = (el as HTMLElement).innerText || '';
            return src.includes('close') || text.trim() === '✕' || text.trim() === 'X';
          });
          for (const btn of closeBtns) {
            try { (btn as HTMLElement).click(); } catch (_) {}
          }
        } catch (_) {}

        delete document.body.dataset.__sf_nav_res;
        const script = document.createElement('script');
        script.textContent = `
        (async (cfg) => {
          try {
            const game = window.__SF_GAME__;
            if (!game) {
              document.body.dataset.__sf_nav_res = JSON.stringify({ success: false, error: 'Phaser game instance not found' });
              return;
            }

            const scene = game.scene.scenes.find(s => s.sys && s.sys.settings && s.sys.settings.active);
            if (!scene) {
              document.body.dataset.__sf_nav_res = JSON.stringify({ success: false, error: 'No active scene found' });
              return;
            }

            const player = scene.currentPlayer;
            if (!player) {
              document.body.dataset.__sf_nav_res = JSON.stringify({ success: false, error: 'Player entity (currentPlayer) not found in scene' });
              return;
            }

            const map = scene.map;
            if (!map) {
              document.body.dataset.__sf_nav_res = JSON.stringify({ success: false, error: 'Map not found in scene' });
              return;
            }

            const targetNpcName = (cfg.effectiveNpcTarget || '').trim().toLowerCase();
            const canonicalTarget = (cfg.canonicalTarget || '').trim().toLowerCase();
            const customCoords = cfg.customCoords;
            let targetX = 0;
            let targetY = 0;
            let targetNpcObj = null;

            if (targetNpcName) {
              const npcs = scene.npcs || {};
              
              // 1. Точний збіг
              targetNpcObj = npcs[targetNpcName] || (canonicalTarget ? npcs[canonicalTarget] : null);

              // 2. Збіг з очищеними від спецсимволів назвами
              if (!targetNpcObj) {
                const cleanTarget = targetNpcName.replace(/[^a-z0-9]/g, '');
                const cleanCanon = canonicalTarget.replace(/[^a-z0-9]/g, '');
                for (const [key, obj] of Object.entries(npcs)) {
                  const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                  if (cleanKey === cleanTarget || (cleanCanon && cleanKey === cleanCanon) || (cleanTarget.length > 2 && (cleanKey.includes(cleanTarget) || cleanTarget.includes(cleanKey)))) {
                    targetNpcObj = obj;
                    break;
                  }
                }
              }

              // 3. Пошук в шарі об'єктів карти (Interactable)
              if (!targetNpcObj && map.getObjectLayer) {
                const interactables = map.getObjectLayer("Interactable")?.objects || [];
                const foundObj = interactables.find(o => 
                  (o.name && (o.name.toLowerCase().includes(targetNpcName) || (canonicalTarget && o.name.toLowerCase().includes(canonicalTarget)))) ||
                  (o.properties && o.properties.some(p => String(p.value).toLowerCase().includes(targetNpcName) || (canonicalTarget && String(p.value).toLowerCase().includes(canonicalTarget))))
                );
                if (foundObj) {
                  targetX = foundObj.x + (foundObj.width || 0) / 2;
                  targetY = foundObj.y + (foundObj.height || 0) / 2;
                }
              }

              if (targetNpcObj) {
                targetX = typeof targetNpcObj.x === 'number' ? targetNpcObj.x : (targetNpcObj.body?.x || 0);
                targetY = typeof targetNpcObj.y === 'number' ? targetNpcObj.y : (targetNpcObj.body?.y || 0);
              }
            }

            if (!targetX && !targetY && customCoords && typeof customCoords.x === 'number' && typeof customCoords.y === 'number' && (customCoords.x !== 0 || customCoords.y !== 0)) {
              targetX = customCoords.x;
              targetY = customCoords.y;
            }

            if (!targetX && !targetY && !targetNpcObj) {
              const availableNpcs = scene.npcs ? Object.keys(scene.npcs) : [];
              document.body.dataset.__sf_nav_res = JSON.stringify({
                success: false,
                error: 'NPC «' + targetNpcName + '» не знайдено на карті! Доступні NPC: ' + availableNpcs.join(', '),
                availableNpcs
              });
              return;
            }

            const startDist = Math.hypot(targetX - player.x, targetY - player.y);
            const reqDist = cfg.interactionDistance;

            if (startDist <= reqDist) {
              document.body.dataset.__sf_nav_res = JSON.stringify({
                success: true,
                alreadyThere: true,
                distToGoal: startDist,
                startPos: { x: Math.round(player.x), y: Math.round(player.y) },
                finalPos: { x: Math.round(player.x), y: Math.round(player.y) },
                targetNpcFound: !!targetNpcObj
              });
              return;
            }

            const collisionObjects = map.getObjectLayer ? (map.getObjectLayer("Collision")?.objects || []) : [];
            const CELL_SIZE = 8;
            const PADDING = 6;
            const cols = Math.ceil(map.widthInPixels / CELL_SIZE);
            const rows = Math.ceil(map.heightInPixels / CELL_SIZE);

            const grid = new Uint8Array(cols * rows);
            for (let i = 0; i < collisionObjects.length; i++) {
              const obj = collisionObjects[i];
              const minX = Math.max(0, Math.floor((obj.x - PADDING) / CELL_SIZE));
              const maxX = Math.min(cols - 1, Math.floor((obj.x + (obj.width || 16) + PADDING) / CELL_SIZE));
              const minY = Math.max(0, Math.floor((obj.y - PADDING) / CELL_SIZE));
              const maxY = Math.min(rows - 1, Math.floor((obj.y + (obj.height || 16) + PADDING) / CELL_SIZE));
              for (let y = minY; y <= maxY; y++) {
                const rowOffset = y * cols;
                for (let x = minX; x <= maxX; x++) {
                  grid[rowOffset + x] = 1;
                }
              }
            }

            function isWalkable(gx, gy) {
              if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) return false;
              return grid[gy * cols + gx] === 0;
            }

            function findNearestWalkable(gx, gy, maxRadius = 15) {
              if (isWalkable(gx, gy)) return { x: gx, y: gy };
              for (let r = 1; r <= maxRadius; r++) {
                for (let dy = -r; dy <= r; dy++) {
                  for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) === r || Math.abs(dy) === r) {
                      const nx = gx + dx;
                      const ny = gy + dy;
                      if (isWalkable(nx, ny)) return { x: nx, y: ny };
                    }
                  }
                }
              }
              return null;
            }

            const startG = findNearestWalkable(Math.floor(player.x / CELL_SIZE), Math.floor(player.y / CELL_SIZE));
            const goalG = findNearestWalkable(Math.floor(targetX / CELL_SIZE), Math.floor(targetY / CELL_SIZE));

            if (!startG || !goalG) {
              document.body.dataset.__sf_nav_res = JSON.stringify({ success: false, error: 'Start or goal position is completely blocked by collisions' });
              return;
            }

            const openSet = new Set();
            const startKey = startG.y * cols + startG.x;
            const goalKey = goalG.y * cols + goalG.x;

            openSet.add(startKey);
            const cameFrom = new Int32Array(cols * rows).fill(-1);
            const gScore = new Float32Array(cols * rows).fill(Infinity);
            const fScore = new Float32Array(cols * rows).fill(Infinity);

            gScore[startKey] = 0;
            const h = (x, y) => Math.hypot(goalG.x - x, goalG.y - y);
            fScore[startKey] = h(startG.x, startG.y);

            const neighbors = [
              { dx: 1, dy: 0, cost: 1 },
              { dx: -1, dy: 0, cost: 1 },
              { dx: 0, dy: 1, cost: 1 },
              { dx: 0, dy: -1, cost: 1 },
              { dx: 1, dy: 1, cost: 1.414 },
              { dx: -1, dy: 1, cost: 1.414 },
              { dx: 1, dy: -1, cost: 1.414 },
              { dx: -1, dy: -1, cost: 1.414 }
            ];

            let rawPath = null;
            let iterations = 0;
            const maxIterations = 8000;

            while (openSet.size > 0 && iterations < maxIterations) {
              iterations++;
              let currentKey = -1;
              let lowestF = Infinity;
              for (const k of openSet) {
                if (fScore[k] < lowestF) {
                  lowestF = fScore[k];
                  currentKey = k;
                }
              }

              if (currentKey === goalKey) {
                const p = [];
                let curr = currentKey;
                while (curr !== -1) {
                  const cx = curr % cols;
                  const cy = Math.floor(curr / cols);
                  p.unshift({
                    x: cx * CELL_SIZE + CELL_SIZE / 2,
                    y: cy * CELL_SIZE + CELL_SIZE / 2
                  });
                  curr = cameFrom[curr];
                }
                rawPath = p;
                break;
              }

              openSet.delete(currentKey);
              const cx = currentKey % cols;
              const cy = Math.floor(currentKey / cols);

              for (let i = 0; i < neighbors.length; i++) {
                const n = neighbors[i];
                const nx = cx + n.dx;
                const ny = cy + n.dy;
                if (!isWalkable(nx, ny)) continue;
                if (n.dx !== 0 && n.dy !== 0) {
                  if (!isWalkable(cx + n.dx, cy) || !isWalkable(cx, cy + n.dy)) continue;
                }

                const nKey = ny * cols + nx;
                const tentativeG = gScore[currentKey] + n.cost;
                if (tentativeG < gScore[nKey]) {
                  cameFrom[nKey] = currentKey;
                  gScore[nKey] = tentativeG;
                  fScore[nKey] = tentativeG + h(nx, ny);
                  openSet.add(nKey);
                }
              }
            }

            if (!rawPath || rawPath.length === 0) {
              document.body.dataset.__sf_nav_res = JSON.stringify({ success: false, error: 'A* не зміг побудувати шлях до цілі (перешкоди блокують доступ)' });
              return;
            }

            function hasLineOfSight(x0, y0, x1, y1) {
              const dist = Math.hypot(x1 - x0, y1 - y0);
              const steps = Math.ceil(dist / 4);
              for (let s = 1; s < steps; s++) {
                const t = s / steps;
                const px = x0 + (x1 - x0) * t;
                const py = y0 + (y1 - y0) * t;
                const gx = Math.floor(px / CELL_SIZE);
                const gy = Math.floor(py / CELL_SIZE);
                if (!isWalkable(gx, gy)) return false;
              }
              return true;
            }

            const waypoints = [rawPath[0]];
            let currIdx = 0;
            while (currIdx < rawPath.length - 1) {
              let furthest = currIdx + 1;
              for (let i = rawPath.length - 1; i > currIdx + 1; i--) {
                if (hasLineOfSight(rawPath[currIdx].x, rawPath[currIdx].y, rawPath[i].x, rawPath[i].y)) {
                  furthest = i;
                  break;
                }
              }
              waypoints.push(rawPath[furthest]);
              currIdx = furthest;
            }

            if (hasLineOfSight(waypoints[waypoints.length - 1].x, waypoints[waypoints.length - 1].y, targetX, targetY)) {
              waypoints.push({ x: targetX, y: targetY });
            }

            let currentWpIndex = 0;
            const startPos = { x: Math.round(player.x), y: Math.round(player.y) };
            const maxTimeMs = cfg.timeoutSeconds * 1000;
            const walkStartTime = Date.now();
            let lastProgressTime = Date.now();
            let lastPlayerPos = { x: player.x, y: player.y };

            const iv = setInterval(() => {
              const curX = player.x;
              const curY = player.y;
              const distToGoal = Math.hypot(targetX - curX, targetY - curY);

              if (distToGoal <= reqDist) {
                scene.joystick = undefined;
                clearInterval(iv);
                if (cfg.autoInteract && targetNpcObj) {
                  try {
                    targetNpcObj.emit('pointerdown', { downElement: { nodeName: 'CANVAS' } });
                    const h = targetNpcObj._events?.pointerdown;
                    if (typeof h === 'function') h.call(targetNpcObj, { downElement: { nodeName: 'CANVAS' } });
                    else if (h && typeof h.fn === 'function') h.fn.call(targetNpcObj, { downElement: { nodeName: 'CANVAS' } });
                  } catch (_) {}
                }
                document.body.dataset.__sf_nav_res = JSON.stringify({
                  success: true,
                  reachedGoal: true,
                  distToGoal,
                  finalPos: { x: Math.round(curX), y: Math.round(curY) },
                  startPos,
                  rawWpsCount: rawPath.length,
                  waypointsCount: waypoints.length,
                  durationMs: Date.now() - walkStartTime,
                  targetNpcFound: !!targetNpcObj
                });
                return;
              }

              if (currentWpIndex >= waypoints.length) {
                scene.joystick = undefined;
                clearInterval(iv);
                document.body.dataset.__sf_nav_res = JSON.stringify({
                  success: distToGoal <= (reqDist + 15),
                  reachedLastWp: true,
                  distToGoal,
                  finalPos: { x: Math.round(curX), y: Math.round(curY) },
                  startPos,
                  rawWpsCount: rawPath.length,
                  waypointsCount: waypoints.length,
                  durationMs: Date.now() - walkStartTime,
                  targetNpcFound: !!targetNpcObj
                });
                return;
              }

              const targetWp = waypoints[currentWpIndex];
              const distToWp = Math.hypot(targetWp.x - curX, targetWp.y - curY);
              if (distToWp < 10) {
                currentWpIndex++;
                if (currentWpIndex >= waypoints.length) {
                  scene.joystick = undefined;
                  clearInterval(iv);
                  document.body.dataset.__sf_nav_res = JSON.stringify({
                    success: distToGoal <= (reqDist + 15),
                    reachedLastWp: true,
                    distToGoal,
                    finalPos: { x: Math.round(curX), y: Math.round(curY) },
                    startPos,
                    rawWpsCount: rawPath.length,
                    waypointsCount: waypoints.length,
                    durationMs: Date.now() - walkStartTime,
                    targetNpcFound: !!targetNpcObj
                  });
                  return;
                }
              }

              const moved = Math.hypot(curX - lastPlayerPos.x, curY - lastPlayerPos.y);
              if (moved >= 4) {
                lastProgressTime = Date.now();
                lastPlayerPos = { x: curX, y: curY };
              } else if (Date.now() - lastProgressTime > 2500) {
                currentWpIndex++;
                lastProgressTime = Date.now();
              }

              if (Date.now() - walkStartTime > maxTimeMs) {
                scene.joystick = undefined;
                clearInterval(iv);
                document.body.dataset.__sf_nav_res = JSON.stringify({
                  success: false,
                  timeout: true,
                  distToGoal,
                  finalPos: { x: Math.round(curX), y: Math.round(curY) },
                  startPos,
                  rawWpsCount: rawPath.length,
                  waypointsCount: waypoints.length,
                  durationMs: Date.now() - walkStartTime
                });
                return;
              }

              const nextWp = waypoints[currentWpIndex];
              const angle = Math.atan2(nextWp.y - curY, nextWp.x - curX) * 180 / Math.PI;
              scene.joystick = { enable: true, force: 1, angle };
            }, 35);

          } catch (e) {
            document.body.dataset.__sf_nav_res = JSON.stringify({ success: false, error: e.message || String(e) });
          }
        })(${JSON.stringify(params)});
      `;
      document.documentElement.appendChild(script);
      script.remove();

      const rawSync = document.body.dataset.__sf_nav_res;
      if (rawSync) {
        delete document.body.dataset.__sf_nav_res;
        try {
          return JSON.parse(rawSync);
        } catch (_) {}
      }
      return { started: true };
    }, navPayload) as any;
  } catch (_) {}

    let navigationResult = (startNavResult && typeof startNavResult.success === 'boolean') ? startNavResult : null;

    if (!navigationResult) {
      const pollStartTime = Date.now();
      const maxWaitTimeMs = (timeoutSeconds + 8) * 1000;

      while (Date.now() - pollStartTime < maxWaitTimeMs) {
        if (!checkRunning()) {
          try {
            await activePage.evaluate(() => {
              const script = document.createElement('script');
              script.textContent = `
                if (window.__SF_GAME__) {
                  const s = window.__SF_GAME__.scene?.scenes?.find(sc => sc.sys?.settings?.active);
                  if (s) s.joystick = undefined;
                }
              `;
              document.documentElement.appendChild(script);
              script.remove();
            });
          } catch (_) {}
          return { data: context, nextHandle: ['error'] };
        }

        let rawRes = null;
        try {
          rawRes = await activePage.evaluate(() => {
            const raw = document.body ? document.body.dataset.__sf_nav_res : null;
            if (raw) {
              delete document.body.dataset.__sf_nav_res;
              return raw;
            }
            return null;
          });
        } catch (_) {}

        if (rawRes) {
          try {
            navigationResult = JSON.parse(rawRes);
            break;
          } catch (_) {}
        }

        await new Promise(r => setTimeout(r, 350));
      }
    }

    if (!checkRunning()) {
      return { data: context, nextHandle: ['error'] };
    }

    if (!navigationResult || !navigationResult.success) {
      const errMsg = navigationResult?.error || (navigationResult?.timeout ? 'Час очікування руху вичерпано (таймаут)' : 'Не вдалося дійти до цілі');
      logToClient(`❌ [Навігатор] Помилка: ${errMsg}`, 'error');
      return { data: context, nextHandle: ['error'] };
    }

    const { startPos, finalPos, waypointsCount, distToGoal, durationMs, alreadyThere } = navigationResult;
    
    if (alreadyThere) {
      logToClient(`🎯 [Навігатор] Персонаж уже знаходиться поруч із ${targetDesc} (дистанція: ${Math.round(distToGoal || 0)}px)`, 'info');
    } else {
      logToClient(`🏃 [Навігатор] Успішно пройдено: (${startPos?.x}, ${startPos?.y}) ➔ (${finalPos?.x}, ${finalPos?.y}) за ${(durationMs / 1000).toFixed(1)}с (${waypointsCount} вейпоінтів)`, 'success');
    }

    // ─── 3. Додаткова взаємодія (Space / PointerEvents) якщо увімкнено ─────────
    if (autoInteract) {
      logToClient(`💬 [Навігатор] Взаємодія з ${targetDesc}...`, 'info');
      await new Promise(r => setTimeout(r, 250));

      try {
        await activePage.keyboard.press('Space');
      } catch (_) {}

      try {
        await activePage.evaluate((targetName) => {
          const script = document.createElement('script');
          script.textContent = `
            ((npcName) => {
              const game = window.__SF_GAME__;
              const scene = game?.scene?.scenes?.find(s => s.sys?.settings?.active);
              const npc = scene?.npcs?.[npcName];
              if (npc) {
                try {
                  npc.emit('pointerdown', { downElement: { nodeName: 'CANVAS' } });
                  const h = npc._events?.pointerdown;
                  if (typeof h === 'function') h.call(npc, { downElement: { nodeName: 'CANVAS' } });
                  else if (h && typeof h.fn === 'function') h.fn.call(npc, { downElement: { nodeName: 'CANVAS' } });
                } catch (_) {}

                if (scene.cameras?.main && scene.game?.canvas) {
                  const cam = scene.cameras.main;
                  const canvas = scene.game.canvas;
                  const rect = canvas.getBoundingClientRect();
                  const screenX = (npc.x - cam.worldView.x) * cam.zoom;
                  const screenY = (npc.y - cam.worldView.y) * cam.zoom;
                  const clientX = rect.left + screenX;
                  const clientY = rect.top + screenY;

                  const pd = new PointerEvent('pointerdown', { clientX, clientY, bubbles: true, cancelable: true, button: 0 });
                  const pu = new PointerEvent('pointerup', { clientX, clientY, bubbles: true, cancelable: true, button: 0 });
                  canvas.dispatchEvent(pd);
                  canvas.dispatchEvent(pu);
                }
              }
            })(${JSON.stringify(targetName)});
          `;
          document.documentElement.appendChild(script);
          script.remove();
        }, effectiveNpcTarget.toLowerCase());
      } catch (_) {}

      await new Promise(r => setTimeout(r, 400));
      logToClient(`✅ [Навігатор] Взаємодію з ${targetDesc} виконано!`, 'success');
    }

    // Зберігаємо результати у контекст
    const updatedContext = {
      ...context,
      lastWorldNavigation: {
        targetLocation,
        targetNpc: effectiveNpcTarget,
        finalPos,
        durationMs,
        success: true
      }
    };

    return {
      data: updatedContext,
      nextHandle: ['success']
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`WorldNavigatorNode execution failed`, err instanceof Error ? err : new Error(String(err)));
    logToClient(`❌ [Навігатор] Критична помилка: ${errorMessage}`, 'error');
    return { data: context, nextHandle: ['error'] };
  }
};
