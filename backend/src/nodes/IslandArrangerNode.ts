import { NodeHandlerParams } from './types';
import { PROJECTS_DIR } from '../constants';
import * as fs from 'fs';
import * as path from 'path';

const BUILDING_SIZES: Record<string, [number, number]> = {
  // Будівлі
  'Tree': [2, 2], 'Water Well': [2, 2], 'Fruit Patch': [2, 2],
  'Compost Bin': [2, 2], 'Turbo Composter': [2, 2], 'Sunstone Rock': [2, 2],
  'Crimstone Rock': [2, 2], 'Big Apple': [2, 2], 'Big Orange': [2, 2],
  'Market': [3, 2], 'Workbench': [3, 2], 'Fire Pit': [3, 2],
  'Crafting Box': [3, 2], 'Smoothie Shack': [3, 2], 'Aging Shed': [3, 2],
  'Deli': [4, 3], 'Bakery': [4, 3], 'Hen House': [4, 3],
  'Kitchen': [4, 3], 'Town Center': [4, 3], 'Fish Market': [3, 3], 'House': [4, 4],
  // Ресурсні клітинки (grid types)
  'trees': [2, 2], 'crimstones': [2, 2], 'sunstones': [2, 2], 'fruitPatches': [2, 2],
  'flowerBeds': [3, 1],
  // Колекційні предмети
  "Farmer's Monument": [3, 3], 'Squirrel': [2, 1], 'Stone Beetle': [1, 2],
};

const getSize = (name: string): [number, number] => BUILDING_SIZES[name] ?? [1, 1];

export const islandArrangerNodeHandler = async ({
  currentNode, context, projectName, logToClient, activePage, smartSleep, ws
}: NodeHandlerParams) => {
  const { filterType = 'all', editModeSelector, step1Selector, step3Selector, step6Selector, step7Selector = '', step8Selector = '', step9Selector = '', step10Selector = '', tileSize = 40 } = currentNode.data as Record<string, unknown>;
  const step1 = (step1Selector as string) || (editModeSelector as string);
  const step3 = step3Selector as string;
  const step6 = step6Selector as string;
  const step7 = step7Selector as string;
  const step8 = step8Selector as string;
  const step9 = step9Selector as string;
  const step10 = step10Selector as string;

  logToClient(`Начинаю Дизайнер Острова (Filter: ${filterType})`, 'info');

  const saveFilePath = path.join(PROJECTS_DIR, `${projectName}_save.json`);
  const layoutFilePath = path.join(PROJECTS_DIR, `${projectName}_layout.json`);
  const globalTypesPath = path.join(PROJECTS_DIR, `global_building_types.json`);

  try {
    let saveData: any;
    let layoutRaw: any;
    let globalBuildingTypes = {};

    try {
      saveData = JSON.parse(await fs.promises.readFile(saveFilePath, 'utf-8'));
      layoutRaw = JSON.parse(await fs.promises.readFile(layoutFilePath, 'utf-8'));
    } catch (err: any) {
      logToClient(`❌ Відсутній або пошкоджений файл _save.json чи _layout.json: ${err.message}`, 'error');
      return { data: { ...context, error: 'Missing layout or save file' }, nextHandle: ['error'] };
    }

    try {
      globalBuildingTypes = JSON.parse(await fs.promises.readFile(globalTypesPath, 'utf-8'));
    } catch (e) {}

    // Підтримуємо обидва формати: старий масив і новий { items, buildingTypes }
    const layoutData: any[] = Array.isArray(layoutRaw) ? layoutRaw : (layoutRaw.items ?? []);
    // Якщо в самому layout є buildingTypes (старе збереження), беремо їх, інакше глобальні
    const buildingTypes: Record<string, any> = Array.isArray(layoutRaw) ? globalBuildingTypes : (layoutRaw.buildingTypes ?? globalBuildingTypes);

    // Extract current items from save
    const farm = saveData.visitedFarmState || saveData;
    const currentItemsMap = new Map();

    const addItems = (category: string, type: string) => {
      if (farm[category]) {
        Object.entries(farm[category]).forEach(([name, itemsArray]: [string, any]) => {
          itemsArray.forEach((item: any) => {
            if (item.coordinates) {
              const compId = `${category}_${name}_${item.id}`;
              currentItemsMap.set(compId, {
                id: compId,
                originalId: item.id,
                name: name,
                type: type,
                x: item.coordinates.x,
                y: item.coordinates.y,
                category: category // Store category to reconstruct save later
              });
            }
          });
        });
      }
    };

    addItems('buildings', 'building');
    addItems('collectibles', 'collectible');

    const gridTypes = ['crops', 'trees', 'stones', 'iron', 'gold', 'crimstones', 'sunstones', 'fruitPatches', 'beehives'];
    gridTypes.forEach(type => {
      if (farm[type]) {
        Object.entries(farm[type]).forEach(([id, item]: [string, any]) => {
          if (item.x !== undefined && item.y !== undefined) {
            const compId = `${type}_${type}_${id}`;
            currentItemsMap.set(compId, { id: compId, originalId: id, name: type, type, x: item.x, y: item.y, category: type });
          }
        });
      }
    });

    // flowerBeds -- вкладено в farm.flowers.flowerBeds
    const flowerBedsData = farm.flowers?.flowerBeds;
    if (flowerBedsData) {
      Object.entries(flowerBedsData).forEach(([id, item]: [string, any]) => {
        if (item.x !== undefined && item.y !== undefined) {
          const compId = `flowerBeds_flowerBeds_${id}`;
          currentItemsMap.set(compId, { id: compId, originalId: id, name: 'flowerBeds', type: 'flowerBeds', x: item.x, y: item.y, category: 'flowerBeds' });
        }
      });
    }

    const differences: any[] = [];

    // Compare layout to current save
    let newItemsCount = 0;
    
    layoutData.forEach((targetItem: any) => {
      // Filter logic
      if (filterType !== 'all' && targetItem.type !== filterType && filterType !== targetItem.type + 's') {
        return;
      }

      const currentItem = currentItemsMap.get(targetItem.id);
      if (currentItem) {
        if (currentItem.x !== targetItem.x || currentItem.y !== targetItem.y) {
          differences.push({
            id: targetItem.id,
            name: targetItem.name,
            type: targetItem.type,
            from: { x: currentItem.x, y: currentItem.y },
            to: { x: targetItem.x, y: targetItem.y }
          });
        }
      } else {
        // Item is in layout but not on the map (newly placed from inventory)
        newItemsCount++;
      }
    });

    if (differences.length === 0 && newItemsCount === 0) {
      logToClient(`✅ Острів вже відповідає макету!`, 'success');
      return { data: context, nextHandle: ['success'] };
    }

    if (differences.length > 0) {
      logToClient(`Знайдено розбіжності: ${differences.length} об'єктів не на своїх місцях.`, 'info');
    }
    if (newItemsCount > 0) {
      logToClient(`Знайдено ${newItemsCount} нових об'єктів для розміщення з інвентаря.`, 'info');
    }

    if (step1) {
      logToClient(`Включаю режим розміщення (селектор: ${step1})`, 'info');
      try {
        await activePage.waitForSelector(step1, { timeout: 5000 });
      } catch {
        logToClient(`⚠️ Не вдалося знайти селектор кроку 1: ${step1}`, 'info');
      }
    }

    const vSize = activePage.viewportSize() || { width: 960, height: 540 };
    const size = typeof tileSize === 'number' ? tileSize : parseInt(tileSize as string) || 40;

    // Шукаємо Workbench для використання як "якоря" (Anchor)
    const uniqueItems: any[] = [];
    currentItemsMap.forEach((item: any) => {
      if (item.name === 'Workbench') {
        uniqueItems.push({ name: item.name, x: item.x, y: item.y });
      }
    });

    // Шукаємо якір через Playwright locator (працює навіть з CSS transform)
    let anchor: any = null;
    const frame = activePage.mainFrame();
    logToClient(`🔍 Шукаю якір через Playwright locator...`, 'debug');

    for (const item of uniqueItems) {
      const key = item.name.toLowerCase().replace(/ /g, '_');
      try {
        const loc = frame.locator(`img[src*="${key}"]`).first();
        const count = await loc.count();
        if (count === 0) continue;

        const box = await loc.boundingBox();
        if (box) {
          anchor = {
            screenX: box.x + box.width / 2,
            screenY: box.y + box.height / 2,
            gameX: item.x,
            gameY: item.y,
            matchedName: item.name,
            matchedSrc: key
          };
          break;
        }
      } catch (e) { /* не знайдено */ }
    }

    let originX = vSize.width / 2;
    let originY = vSize.height / 2;

    if (anchor) {
      logToClient(`🎯 Якір знайдено: "${anchor.matchedName}" (${anchor.matchedSrc.split('/').pop()}) на (${Math.round(anchor.screenX)}, ${Math.round(anchor.screenY)}), ігрові координати (${anchor.gameX}, ${anchor.gameY})`, 'success');
      originX = anchor.screenX - (anchor.gameX * size);
      originY = anchor.screenY + (anchor.gameY * size);
    } else {
      logToClient(`⚠️ Якір не знайдено. Унікальні назви для пошуку: ${uniqueItems.map(i => i.name).join(', ')}`, 'info');
      logToClient(`⚠️ URL зображень на екрані не співпадають з назвами будівель. Запустіть нову ноду щоб побачити URL з логів.`, 'info');
    }

    // --- DEBUG SCREENSHOT ---
    try {
      const boxes: any[] = [];
      currentItemsMap.forEach(item => {
        const [bw, bh] = getSize(item.name);
        const cx = item.x + (bw - 1) / 2;
        const cy = item.y - (bh - 1) / 2;
        const px = originX + cx * size;
        const py = originY - cy * size;
        
        // Зсув для коректного відображення (1 клітинка вліво, 0.4 вгору)
        const offsetX = -1 * size;
        const offsetY = -0.4 * size;

        boxes.push({
          left: px - (bw * size) / 2 + offsetX,
          top: py - (bh * size) / 2 + offsetY,
          width: bw * size,
          height: bh * size,
          name: item.name
        });
      });

      await activePage.evaluate((boxesData) => {
        const container = document.createElement('div');
        container.id = 'debug-bounding-boxes';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '999999';
        
        boxesData.forEach((box: any) => {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.left = box.left + 'px';
          div.style.top = box.top + 'px';
          div.style.width = box.width + 'px';
          div.style.height = box.height + 'px';
          div.style.border = '2px solid #10b981';
          div.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
          div.style.color = 'white';
          div.style.fontSize = '12px';
          div.style.fontWeight = 'bold';
          div.style.textShadow = '1px 1px 2px #000';
          div.style.display = 'flex';
          div.style.alignItems = 'center';
          div.style.justifyContent = 'center';
          div.style.textAlign = 'center';
          div.innerText = box.name;
          container.appendChild(div);
        });
        document.body.appendChild(container);
      }, boxes);

      const screenshotBuf = await activePage.screenshot({ type: 'jpeg', quality: 70 });
      
      await activePage.evaluate(() => {
        const el = document.getElementById('debug-bounding-boxes');
        if (el) el.remove();
      });

      if (ws?.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'DEBUG_SNAPSHOT',
          nodeId: currentNode.id,
          nodeTitle: `Дизайнер Острова (${boxes.length} буд.)`,
          image: `data:image/jpeg;base64,${screenshotBuf.toString('base64')}`,
          timestamp: Date.now()
        }));
      }
      logToClient(`📸 Скріншот з обведеними будівлями відправлено в фото-дебаг.`, 'info');
    } catch (err: any) {
      logToClient(`⚠️ Помилка створення скріншоту: ${err.message}`, 'info');
    }
    // ------------------------

    for (const diff of differences) {
      const [bw, bh] = getSize(diff.name);
      const fromCX = diff.from.x + (bw - 1) / 2;
      const fromCY = diff.from.y - (bh - 1) / 2;
      const toCX   = diff.to.x   + (bw - 1) / 2;
      const toCY   = diff.to.y   - (bh - 1) / 2;

      const offsetX = -1 * size;
      const offsetY = -0.4 * size;

      const fromX = originX + fromCX * size + offsetX;
      const fromY = originY - fromCY * size + offsetY;
      const toX   = originX + toCX   * size + offsetX;
      const toY   = originY - toCY   * size + offsetY;

      logToClient(`🔄 ${diff.name} [${bw}×${bh}] (${diff.from.x},${diff.from.y})->(${diff.to.x},${diff.to.y}) | px (${Math.round(fromX)},${Math.round(fromY)})->(${Math.round(toX)},${Math.round(toY)})`, 'debug');

      await activePage.mouse.move(fromX, fromY);
      await activePage.mouse.down();
      await smartSleep(300, ws);
      await activePage.mouse.move(toX, toY, { steps: 30 });
      await smartSleep(300, ws);
      await activePage.mouse.up();
      await smartSleep(1000, ws);
    }

    // ── Фаза 2: Розміщення будівель з інвентаря ───────────────────────────────
    if (step1) {
      const inventory = (farm.inventory as Record<string, any>) || {};

      // Рахуємо скільки кожної будівлі вже на карті
      const placedCounts: Record<string, number> = {};
      currentItemsMap.forEach((item: any) => {
        placedCounts[item.name] = (placedCounts[item.name] || 0) + 1;
      });

      // Рахуємо скільки кожної будівлі потрібно за layout та їх позиції
      const layoutCounts: Record<string, number> = {};
      const layoutPositions: Record<string, { w: number; h: number; x: number; y: number }[]> = {};
      layoutData.forEach((targetItem: any) => {
        const typeCfg = buildingTypes[targetItem.name];
        if (!typeCfg?.inventoryImage) return; // пропускаємо якщо не вказано inventoryImage
        layoutCounts[targetItem.name] = (layoutCounts[targetItem.name] || 0) + 1;
        if (!layoutPositions[targetItem.name]) layoutPositions[targetItem.name] = [];
        layoutPositions[targetItem.name].push({
          w: typeCfg.w || getSize(targetItem.name)[0],
          h: typeCfg.h || getSize(targetItem.name)[1],
          x: targetItem.x,
          y: targetItem.y
        });
      });

      for (const [buildingName, targetCount] of Object.entries(layoutCounts)) {
        const placed = placedCounts[buildingName] || 0;
        const needed = targetCount - placed;
        if (needed <= 0) continue;

        const typeCfg = buildingTypes[buildingName];
        const inventoryImage = typeCfg?.inventoryImage || '';
        const inventoryName = typeCfg?.inventoryName || buildingName;

        // Перевіряємо інвентар за inventoryName
        const invCount = Number(inventory[inventoryName] ?? inventory[buildingName] ?? 0);
        if (invCount < needed) {
          logToClient(`📦 ${buildingName}: потрібно ${needed}, в інвентарі "${inventoryName}" ${invCount} — пропускаємо`, 'info');
          continue;
        }

        const toPlace = (layoutPositions[buildingName] || []).slice(placed, placed + needed);

        for (const target of toPlace) {
          logToClient(`📦 Розміщую ${buildingName} на (${target.x}, ${target.y}) | img: "${inventoryImage}"`, 'info');
          const { w, h } = target;

          try {
            // Крок 1: клік по селектору
            logToClient(`⏳ Крок 1: Відкриття меню будівництва (селектор: ${step1})`, 'debug');
            await activePage.click(step1, { timeout: 5000 });
            await smartSleep(500, ws);
            
            // Крок 2: клік по зображенню в інвентарі
            logToClient(`⏳ Крок 2: Вибір будівлі в інвентарі (зображення: ${inventoryImage})`, 'debug');
            const images = await activePage.$$(`img[src*="${inventoryImage}"]`);
            if (images.length > 0) {
              await images[images.length - 1].click();
              await smartSleep(500, ws);
            } else {
               throw new Error(`Не знайдено зображення в інвентарі: ${inventoryImage}`);
            }

            // Крок 3: клік по селектору
            if (step3) {
              logToClient(`⏳ Крок 3: Натискання кнопки (селектор: ${step3})`, 'debug');
              await activePage.click(step3, { timeout: 5000 });
              await smartSleep(1000, ws);
            }

            const offsetX = -1 * size;
            const offsetY = -0.4 * size;

            // Будівля з'явилась на (0,0) (відносно Workbench), тобто на `originX, originY`.
            const fromCX = 0 + (w - 1) / 2;
            const fromCY = 0 - (h - 1) / 2;
            
            const fromX = originX + fromCX * size + offsetX;
            const fromY = originY - fromCY * size + offsetY;

            const toCX = target.x + (w - 1) / 2;
            const toCY = target.y - (h - 1) / 2;
            
            const toX = originX + toCX * size + offsetX;
            const toY = originY - toCY * size + offsetY;

            // Крок 5: перемістити постройку на потрібне місце
            logToClient(`⏳ Крок 4-5: Розміщення будівлі на мапі з (0,0) до (${target.x},${target.y})`, 'debug');
            await activePage.mouse.move(fromX, fromY);
            await activePage.mouse.down();
            await smartSleep(400, ws);
            await activePage.mouse.move(toX, toY, { steps: 30 });
            await smartSleep(400, ws);
            await activePage.mouse.up();
            await smartSleep(1000, ws);

            // Крок 6: клік по селектору
            if (step6) {
              logToClient(`⏳ Крок 6: Натискання селектора (${step6})`, 'debug');
              await activePage.click(step6, { timeout: 30000 });
              await smartSleep(400, ws);
            }
            // Крок 7: клік по селектору (опціонально)
            if (step7) {
              logToClient(`⏳ Крок 7: Натискання селектора (${step7})`, 'debug');
              await activePage.click(step7, { timeout: 30000 });
              await smartSleep(600, ws);
            }
            // Крок 8: клік по селектору (опціонально)
            if (step8) {
              logToClient(`⏳ Крок 8: Натискання селектора (${step8})`, 'debug');
              await smartSleep(2000, ws);
              await activePage.click(step8, { timeout: 30000 });
              await smartSleep(600, ws);
            }
            // Крок 9: клік по селектору (опціонально)
            if (step9) {
              logToClient(`⏳ Крок 9: Натискання селектора (${step9})`, 'debug');
              await smartSleep(2000, ws);
              await activePage.click(step9, { timeout: 30000 });
              await smartSleep(600, ws);
            }
            // Крок 10: клік по селектору (опціонально)
            if (step10) {
              logToClient(`⏳ Крок 10: Натискання селектора (${step10})`, 'debug');
              await smartSleep(2000, ws);
              await activePage.click(step10, { timeout: 30000 });
              await smartSleep(600, ws);
            }

          } catch (err: any) {
            logToClient(`⚠️ Помилка розміщення ${buildingName}: ${err.message}`, 'info');
            // Recovery: try to close modals or cancel placement
            try {
              logToClient(`🔄 Спроба відновити нормальний стан екрану...`, 'debug');
              await activePage.keyboard.press('Escape');
              await smartSleep(500, ws);
              // Якщо активне розміщення, натиснути хрестик
              const cancelBtn = await activePage.$(`div:has(> img[src*="cancel.png"])`);
              if (cancelBtn) {
                 await cancelBtn.click();
                 await smartSleep(500, ws);
              }
            } catch (e) {
              // ignore recovery errors
            }
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    logToClient(`✅ Завершено обробку Дизайнера Острова.`, 'success');

    return { data: context, nextHandle: ['success'] };

  } catch (e: any) {
    logToClient(`❌ Ошибка в Дизайнере: ${e.message}`, 'error');
    return { data: { ...context, error: e.message }, nextHandle: ['error'] };
  }
};
