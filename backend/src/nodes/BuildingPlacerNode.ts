import { NodeHandlerParams, NodeResult } from './types';
import { PROJECTS_DIR } from '../constants';
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_BUILDINGS_CATALOG } from '../data/buildingsCatalog';
import { getProjectSaveData } from '../utils/saveStorage';
import { getDbProjectLayout } from '../db/schema';

const BUILDING_SIZES: Record<string, [number, number]> = {
  'Tree': [2, 2], 'Water Well': [2, 2], 'Fruit Patch': [2, 2],
  'Compost Bin': [2, 2], 'Turbo Composter': [2, 2], 'Sunstone Rock': [2, 2],
  'Crimstone Rock': [2, 2], 'Big Apple': [2, 2], 'Big Orange': [2, 2],
  'Market': [3, 2], 'Workbench': [3, 2], 'Fire Pit': [3, 2],
  'Crafting Box': [3, 2], 'Smoothie Shack': [3, 2], 'Aging Shed': [3, 2],
  'Deli': [4, 3], 'Bakery': [4, 3], 'Hen House': [4, 3],
  'Kitchen': [4, 3], 'Town Center': [4, 3], 'Fish Market': [3, 3], 'House': [4, 4],
  'Greenhouse': [4, 3], 'Crop Machine': [4, 3], 'Toolshed': [3, 3], 'Warehouse': [3, 3],
  'Barn': [4, 4], 'Basic Scarecrow': [1, 1], 'Scary Mike': [1, 1], 'Laurie the Chuckle Crow': [1, 1],
  'Bale': [2, 2], 'Immortal Pear': [1, 1], 'Squirrel': [2, 1], 'Stone Beetle': [1, 2],
  'Iron Beetle': [1, 2], 'Gold Beetle': [1, 2], 'Fairy Circle': [1, 1], 'Macaw': [1, 1], 'Butterfly': [1, 1]
};

const getSize = (name: string): [number, number] => BUILDING_SIZES[name] ?? [1, 1];

/**
 * Надійний клік по цілі (картинка або селектор).
 * Якщо є однакові елементи або зображення, ЗАВЖДИ вибирається ОСТАННЄ в списку.
 */
export async function clickTarget(
  page: any,
  target: string,
  preferInPortal = false
): Promise<{ success: boolean; method?: string; tag?: string }> {
  if (!target || !target.trim()) return { success: false };
  const clean = target.trim().toLowerCase();

  try {
    const res = await page.evaluate(({ val, inPortal }: { val: string; inPortal: boolean }) => {
      function getClickable(el: HTMLElement): HTMLElement {
        return (el.closest('.cursor-pointer, button, [role="tab"], [role="button"], a') as HTMLElement) || el.parentElement || el;
      }

      const portal = document.querySelector('#headlessui-portal-root');
      const root = (inPortal && portal && portal.children.length > 0) ? portal : document;

      // 1. Пошук картинок по src (або елементів з [src])
      const imgs = Array.from(root.querySelectorAll('img, [src]')).filter(el => {
        const src = ((el as HTMLImageElement).src || el.getAttribute('src') || '').toLowerCase();
        return src.includes(val);
      }) as HTMLElement[];
      if (imgs.length > 0) {
        const visible = imgs.filter(i => i.offsetParent !== null || i.getBoundingClientRect().width > 0);
        // Завжди вибираємо ОСТАННЄ знайдено в списку
        const chosen = visible.length > 0 ? visible[visible.length - 1] : imgs[imgs.length - 1];
        const clk = getClickable(chosen);
        clk.click();
        return { success: true, method: 'img-src-last', tag: clk.tagName };
      }

      // 2. Пошук картинок по alt
      const altImgs = Array.from(root.querySelectorAll('img[alt]')).filter(el => {
        const alt = ((el as HTMLImageElement).alt || el.getAttribute('alt') || '').toLowerCase();
        return alt.includes(val);
      }) as HTMLElement[];
      if (altImgs.length > 0) {
        const visible = altImgs.filter(i => i.offsetParent !== null || i.getBoundingClientRect().width > 0);
        // Завжди вибираємо ОСТАННЄ знайдено в списку
        const chosen = visible.length > 0 ? visible[visible.length - 1] : altImgs[altImgs.length - 1];
        const clk = getClickable(chosen);
        clk.click();
        return { success: true, method: 'img-alt-last', tag: clk.tagName };
      }

      // 3. Пошук кнопок та табів за точним текстом
      const textEls = Array.from(root.querySelectorAll('button, [role="tab"], [role="button"], div.cursor-pointer, span, p')) as HTMLElement[];
      const exacts = textEls.filter(el => el.textContent && el.textContent.trim().toLowerCase() === val);
      if (exacts.length > 0) {
        const visible = exacts.filter(i => i.offsetParent !== null || i.getBoundingClientRect().width > 0);
        const chosen = visible.length > 0 ? visible[visible.length - 1] : exacts[exacts.length - 1];
        const clk = getClickable(chosen);
        clk.click();
        return { success: true, method: 'text-exact-last', tag: clk.tagName };
      }

      // 4. Пошук за частковим текстом
      const partials = textEls.filter(el => el.textContent && el.textContent.trim().toLowerCase().includes(val));
      if (partials.length > 0) {
        const visible = partials.filter(i => i.offsetParent !== null || i.getBoundingClientRect().width > 0);
        const chosen = visible.length > 0 ? visible[visible.length - 1] : partials[partials.length - 1];
        const clk = getClickable(chosen);
        clk.click();
        return { success: true, method: 'text-partial-last', tag: clk.tagName };
      }

      // 5. QuerySelector якщо це валідний CSS селектор
      try {
        const queryEls = Array.from(root.querySelectorAll(val)) as HTMLElement[];
        if (queryEls.length > 0) {
          const visible = queryEls.filter(i => i.offsetParent !== null || i.getBoundingClientRect().width > 0);
          const chosen = visible.length > 0 ? visible[visible.length - 1] : queryEls[queryEls.length - 1];
          const clk = getClickable(chosen);
          clk.click();
          return { success: true, method: 'query-selector-last', tag: clk.tagName };
        }
      } catch (e) {}

      return { success: false };
    }, { val: clean, inPortal: preferInPortal });

    if (res?.success) return res;
  } catch (err) {}

  // Playwright fallback: завжди вибираємо останній елемент (.last())
  try {
    const loc = page.locator(`img[src*="${clean}"], [src*="${clean}"], button:has-text("${clean}"), ${clean}`);
    const count = await loc.count();
    if (count > 0) {
      const lastEl = loc.last();
      const box = await lastEl.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        return { success: true, method: 'mouse-click-last' };
      }
      await lastEl.click({ force: true, timeout: 5000 });
      return { success: true, method: 'playwright-force-last' };
    }
  } catch (err) {}

  return { success: false };
}

export const buildingPlacerNodeHandler = async ({
  currentNode,
  context,
  projectName,
  logToClient,
  activePage,
  smartSleep,
  ws
}: NodeHandlerParams): Promise<NodeResult> => {
  const nodeData = (currentNode.data || {}) as Record<string, any>;
  const {
    shopImage = '',
    categoryImage = '',
    buildingImage = '',
    craftSelector = '',
    buildingName: initialBuildingName = '',
    targetX: customTargetX,
    targetY: customTargetY,
    width: customW,
    height: customH,
    confirmImage1 = '',
    confirmImage2 = '',
    saveSelector = '',
    tileSize = 40
  } = nodeData;

  logToClient(`🏗️ Початок ноди «Розміщення Будівлі» (Проект: ${projectName})`, 'info');

  if (!activePage) {
    logToClient(`❌ Браузер не активний або сторінка недоступна`, 'error');
    return { data: { ...context, error: 'Browser not active' }, nextHandle: ['error'] };
  }

  const saveFilePath = path.join(PROJECTS_DIR, `${projectName}_save.json`);
  const layoutFilePath = path.join(PROJECTS_DIR, `${projectName}_layout.json`);
  const globalTypesPath = path.join(PROJECTS_DIR, `global_building_types.json`);
  const catalogSettingsPath = path.join(PROJECTS_DIR, `buildings_catalog_settings.json`);

  try {
    let saveData: any = null;
    let layoutRaw: any = null;
    let globalBuildingTypes: Record<string, any> = {};
    let customCatalogSettings: Record<string, any> = {};

    try {
      saveData = await getProjectSaveData(projectName);
      if (!saveData && fs.existsSync(saveFilePath)) {
        saveData = JSON.parse(await fs.promises.readFile(saveFilePath, 'utf-8'));
      }
      layoutRaw = getDbProjectLayout(projectName);
      if (!layoutRaw && fs.existsSync(layoutFilePath)) {
        layoutRaw = JSON.parse(await fs.promises.readFile(layoutFilePath, 'utf-8'));
      }
      if (fs.existsSync(globalTypesPath)) {
        globalBuildingTypes = JSON.parse(await fs.promises.readFile(globalTypesPath, 'utf-8'));
      }
      if (fs.existsSync(catalogSettingsPath)) {
        customCatalogSettings = JSON.parse(await fs.promises.readFile(catalogSettingsPath, 'utf-8'));
      }
    } catch (err: any) {
      logToClient(`⚠️ Попередження під час читання файлів: ${err.message}`, 'debug');
    }

    const farm = saveData?.visitedFarmState || saveData || {};
    const layoutItems: any[] = Array.isArray(layoutRaw) ? layoutRaw : (layoutRaw?.items ?? []);
    const buildingTypes: Record<string, any> = Array.isArray(layoutRaw)
      ? globalBuildingTypes
      : (layoutRaw?.buildingTypes ?? globalBuildingTypes);

    // 1. Визначаємо цільову будівлю та координати з макету (_layout.json)
    let targetBuildingItem: any = null;
    let effectiveBuildingName = initialBuildingName ? initialBuildingName.trim() : '';

    if (effectiveBuildingName && effectiveBuildingName !== 'auto' && effectiveBuildingName !== 'Авто') {
      targetBuildingItem = layoutItems.find((item: any) =>
        item.name?.toLowerCase() === effectiveBuildingName.toLowerCase() ||
        (buildingImage && item.image && item.image.toLowerCase().includes(buildingImage.toLowerCase()))
      );
    } else {
      // Автоматичний пошук нерозміщеної будівлі в макеті
      // Спочатку шукаємо предмети з префіксами _new_ або _inv_ (щойно розміщені через кнопку «Построїти» або карту)
      targetBuildingItem = layoutItems.find((item: any) =>
        typeof item.id === 'string' && (item.id.includes('_new_') || item.id.includes('_inv_'))
      );

      // Якщо за id не знайдено, шукаємо будівлю з макета, якої ще немає на фермі
      if (!targetBuildingItem) {
        const existingFarmBuildings = new Set<string>();
        if (farm.buildings) {
          Object.keys(farm.buildings).forEach(bName => existingFarmBuildings.add(bName.toLowerCase()));
        }
        targetBuildingItem = layoutItems.find((item: any) =>
          item.type === 'building' && !existingFarmBuildings.has(item.name?.toLowerCase())
        );
      }

      if (targetBuildingItem) {
        effectiveBuildingName = targetBuildingItem.name;
        logToClient(`🏗️ Автоматично обрано будівлю з макету: «${effectiveBuildingName}»`, 'info');
      }
    }

    let targetX = typeof customTargetX === 'number' ? customTargetX : undefined;
    let targetY = typeof customTargetY === 'number' ? customTargetY : undefined;
    let [w, h] = getSize(effectiveBuildingName);

    if (targetBuildingItem) {
      if (targetX === undefined) targetX = targetBuildingItem.x;
      if (targetY === undefined) targetY = targetBuildingItem.y;
      if (!customW && targetBuildingItem.w) w = targetBuildingItem.w;
      if (!customH && targetBuildingItem.h) h = targetBuildingItem.h;
      logToClient(`📍 Знайдено координати у макеті для «${targetBuildingItem.name}»: (${targetX}, ${targetY}) [${w}×${h}]`, 'info');
    }

    if (customW && customH) {
      w = Number(customW);
      h = Number(customH);
    } else if (effectiveBuildingName && buildingTypes[effectiveBuildingName]) {
      const typeCfg = buildingTypes[effectiveBuildingName];
      if (typeCfg.w) w = typeCfg.w;
      if (typeCfg.h) h = typeCfg.h;
    }

    if (targetX === undefined || targetY === undefined) {
      targetX = 0;
      targetY = 0;
      logToClient(`⚠️ Координати розміщення не вказано і не знайдено в макеті, використовується (0, 0)`, 'info');
    }

    // 2. Підтягуємо параметри та зображення з каталогу
    let finalShopImage = shopImage ? shopImage.trim() : '';
    let finalCategoryImage = categoryImage ? categoryImage.trim() : '';
    let finalBuildingImage = buildingImage ? buildingImage.trim() : '';

    const catalogItem = DEFAULT_BUILDINGS_CATALOG.find(c =>
      c.name.toLowerCase() === effectiveBuildingName.toLowerCase() ||
      c.id.toLowerCase() === effectiveBuildingName.toLowerCase().replace(/ /g, '_')
    );
    const customItemSettings = customCatalogSettings[effectiveBuildingName] || {};

    if (catalogItem) {
      if (!w && catalogItem.w) w = catalogItem.w;
      if (!h && catalogItem.h) h = catalogItem.h;
    }

    // Розумні дефолти для Sunflower Land:
    // Магазин: на фермі це 'workbench'
    if (!finalShopImage || finalShopImage === 'buildings_shop.png' || finalShopImage === 'buildings_shop') {
      finalShopImage = customItemSettings.shopImage || 'workbench';
    }
    // Категорія: у верстаку вкладка будівництва це 'hammer' (Build)
    if (!finalCategoryImage || finalCategoryImage === 'buildings_category.png' || finalCategoryImage === 'buildings_category') {
      finalCategoryImage = customItemSettings.categoryImage || 'hammer';
    }
    // Картинка будівлі: назва будівлі (наприклад, 'kitchen' знаходить kitchen_icon.png)
    if (!finalBuildingImage) {
      finalBuildingImage = customItemSettings.buildingImage || (effectiveBuildingName ? effectiveBuildingName.toLowerCase().replace(/ /g, '_') : 'kitchen');
    }

    // 3. Збираємо координати існуючих об'єктів з ферми для прив'язки координат
    const currentItemsMap = new Map();
    const addItems = (category: string, _type: string) => {
      if (farm[category]) {
        Object.entries(farm[category]).forEach(([name, itemsArray]: [string, any]) => {
          if (Array.isArray(itemsArray)) {
            itemsArray.forEach((item: any) => {
              if (item.coordinates) {
                const compId = `${category}_${name}_${item.id}`;
                currentItemsMap.set(compId, { name, x: item.coordinates.x, y: item.coordinates.y });
              }
            });
          }
        });
      }
    };
    addItems('buildings', 'building');
    addItems('collectibles', 'collectible');

    // ── Крок 1: Клік на зображення магазину / верстака ────────────────────────
    const isModalAlreadyOpen = await activePage.evaluate(() => {
      const p = document.querySelector('#headlessui-portal-root');
      return !!(p && p.children.length > 0 && p.querySelector('button, [role="tab"]'));
    });

    if (isModalAlreadyOpen) {
      logToClient(`ℹ️ Меню магазину/верстака вже відкрите`, 'info');
    } else if (finalShopImage) {
      logToClient(`⏳ Крок 1: Клік на магазин/верстак («${finalShopImage}»)`, 'info');
      const shopRes = await clickTarget(activePage, finalShopImage, false);
      if (!shopRes.success) {
        const wbLoc = activePage.locator('img[src*="workbench"]');
        if (await wbLoc.count() > 0) {
          await wbLoc.last().click({ force: true, timeout: 5000 }).catch(() => {});
        }
      }
      await smartSleep(1200, ws);
    }

    // ── Крок 2: Клік на категорію (вкладка Build / hammer) ───────────────────
    if (finalCategoryImage) {
      logToClient(`⏳ Крок 2: Клік на категорію («${finalCategoryImage}»)`, 'info');
      const catRes = await clickTarget(activePage, finalCategoryImage, true);
      if (!catRes.success) {
        await clickTarget(activePage, 'build', true);
      }
      await smartSleep(1000, ws);
    }

    // ── Крок 3: Клік на зображення постройки ──────────────────────────────────
    if (finalBuildingImage) {
      logToClient(`⏳ Крок 3: Клік на будівлю («${finalBuildingImage}»)`, 'info');
      const bldRes = await clickTarget(activePage, finalBuildingImage, true);
      if (!bldRes.success && effectiveBuildingName) {
        await clickTarget(activePage, effectiveBuildingName, true);
      }
      await smartSleep(1000, ws);
    }

    // ── Крок 4: Клік кнопки Craft / Build ─────────────────────────────────────
    logToClient(`⏳ Крок 4: Натискання кнопки будівництва (Build / Craft)`, 'info');
    const defaultCraftSelector = 'button:has-text("Build"), button:has-text("Craft"), button:has-text("Buy"), button:has-text("Скрафтити")';
    const finalCraftSelector = (craftSelector && craftSelector.trim() !== '') ? craftSelector : defaultCraftSelector;

    // Спроба безпосереднього кліку по активній кнопці Build всередині модалки (остання активна кнопка)
    const craftClicked = await activePage.evaluate(() => {
      const p = document.querySelector('#headlessui-portal-root');
      if (!p) return false;
      const btns = Array.from(p.querySelectorAll('button'));
      const matching = btns.filter(b => {
        const txt = b.textContent?.trim().toLowerCase() || '';
        return (txt === 'build' || txt === 'craft' || txt.startsWith('craft') || txt === 'buy') && !b.disabled;
      });
      if (matching.length > 0) {
        matching[matching.length - 1].click();
        return true;
      }
      return false;
    });

    if (!craftClicked) {
      await clickTarget(activePage, finalCraftSelector, true);
    }
    await smartSleep(2000, ws);

    // ── Крок 5: Розміщення будівлі на карті (як у Дизайнері Острова) ────────────
    logToClient(`⏳ Крок 5: Розпізнавання будівель острова та розміщення «${effectiveBuildingName || 'Building'}» на координати (${targetX}, ${targetY}) [${w}×${h}]`, 'info');

    // Список типових будівель для пошуку на карті острова
    const knownBuildingsList = [
      { name: 'Workbench', key: 'workbench' },
      { name: 'Market', key: 'market' },
      { name: 'Fire Pit', key: 'fire_pit' },
      { name: 'Town Center', key: 'town_center' },
      { name: 'Water Well', key: 'water_well' },
      { name: 'Basic Scarecrow', key: 'scarecrow' }
    ];

    const buildingsWithCoords: any[] = [];
    currentItemsMap.forEach((item: any) => {
      const match = knownBuildingsList.find(b => b.name.toLowerCase() === item.name.toLowerCase());
      if (match) {
        buildingsWithCoords.push({
          name: item.name,
          key: match.key,
          gx: item.x,
          gy: item.y
        });
      }
    });

    // Очищаємо назву будівлі від розширень (.png, .webp тощо) для точного пошуку в DOM
    const cleanBldKey = (finalBuildingImage || effectiveBuildingName || 'kitchen')
      .toLowerCase()
      .replace(/\.(png|webp|jpg|jpeg|gif)$/i, '')
      .replace(/ /g, '_');

    // Скануємо екран: знаходимо координати видимих будівель та нової будівлі в центрі
    const screenData = await activePage.evaluate(({ buildings, bldKey }: { buildings: any[]; bldKey: string }) => {
      const imgs = Array.from(document.querySelectorAll('img'));
      const found: any[] = [];

      for (const b of buildings) {
        const matching = imgs.filter(i => {
          const s = (i.src || '').toLowerCase();
          const a = (i.alt || '').toLowerCase();
          return (s.includes(b.key) || a.includes(b.key)) && (i.offsetParent !== null || i.getBoundingClientRect().width > 0);
        });
        if (matching.length > 0) {
          const img = matching[matching.length - 1];
          const r = img.getBoundingClientRect();
          found.push({
            name: b.name,
            gx: b.gx,
            gy: b.gy,
            sx: Math.round(r.x + r.width / 2),
            sy: Math.round(r.y + r.height / 2)
          });
        }
      }

      // Шукаємо нову будівлю, яка з'явилася на екрані для перетягування
      let spawnedEl: { x: number; y: number } | null = null;

      // 1) Пріоритет: шукаємо безпосередньо зображення будівлі на острові
      if (bldKey) {
        const bldImgs = imgs.filter(i => {
          const s = (i.src || '').toLowerCase();
          const a = (i.alt || '').toLowerCase();
          const r = i.getBoundingClientRect();
          return (s.includes(bldKey) || a.includes(bldKey)) &&
                 (i.offsetParent !== null || r.width > 0) &&
                 r.width >= 30 && r.height >= 30;
        });
        if (bldImgs.length > 0) {
          const img = bldImgs[bldImgs.length - 1];
          const r = img.getBoundingClientRect();
          spawnedEl = { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }

      // 2) Якщо за картинкою не знайдено, шукаємо листовий елемент тегу 'Drag me' (children.length === 0)
      if (!spawnedEl) {
        const allEls = Array.from(document.querySelectorAll('*'));
        const dragTag = allEls.find(el => {
          return el.children.length === 0 &&
                 el.textContent && el.textContent.trim().toLowerCase() === 'drag me' &&
                 (el as HTMLElement).offsetParent !== null;
        });
        if (dragTag) {
          const r = dragTag.getBoundingClientRect();
          spawnedEl = { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height + 35) };
        }
      }

      return {
        foundBuildings: found,
        spawnedBuilding: spawnedEl,
        viewport: { w: window.innerWidth, h: window.innerHeight }
      };
    }, {
      buildings: buildingsWithCoords,
      bldKey: cleanBldKey
    });

    // Динамічний розрахунок розміру клітинки (tileSize) на основі відстані між будівлями
    let dynamicTileSize = typeof tileSize === 'number' && tileSize !== 40 ? tileSize : 21.33;
    const wb = screenData.foundBuildings.find(b => b.name === 'Workbench');
    const market = screenData.foundBuildings.find(b => b.name === 'Market');
    const firePit = screenData.foundBuildings.find(b => b.name === 'Fire Pit');
    const townCenter = screenData.foundBuildings.find(b => b.name === 'Town Center');

    if (wb && market && Math.abs(market.gx - wb.gx) > 0) {
      dynamicTileSize = Math.abs(market.sx - wb.sx) / Math.abs(market.gx - wb.gx);
    } else if (wb && firePit && Math.abs(firePit.gx - wb.gx) > 0) {
      dynamicTileSize = Math.abs(firePit.sx - wb.sx) / Math.abs(firePit.gx - wb.gx);
    } else if (wb && townCenter && Math.abs(townCenter.gx - wb.gx) > 0) {
      dynamicTileSize = Math.abs(townCenter.sx - wb.sx) / Math.abs(townCenter.gx - wb.gx);
    } else if (screenData.foundBuildings.length >= 2) {
      const b1 = screenData.foundBuildings[0];
      const b2 = screenData.foundBuildings[1];
      if (Math.abs(b2.gx - b1.gx) > 0) {
        dynamicTileSize = Math.abs(b2.sx - b1.sx) / Math.abs(b2.gx - b1.gx);
      }
    }

    logToClient(`📐 Визначений розмір клітинки (tileSize): ${dynamicTileSize.toFixed(2)}px`, 'info');

    // Визначаємо якір та точку відліку (originX, originY)
    const activeAnchor = wb || screenData.foundBuildings[0];
    let dynOriginX = (screenData.viewport?.w || 1280) / 2;
    let dynOriginY = (screenData.viewport?.h || 720) / 2;

    if (activeAnchor) {
      dynOriginX = activeAnchor.sx - (activeAnchor.gx * dynamicTileSize);
      dynOriginY = activeAnchor.sy + (activeAnchor.gy * dynamicTileSize);
      logToClient(`🎯 Опорна будівля: "${activeAnchor.name}" (${activeAnchor.sx}, ${activeAnchor.sy}), центр острова (0,0): (${Math.round(dynOriginX)}, ${Math.round(dynOriginY)})`, 'success');
    } else {
      logToClient(`⚠️ Відомих будівель на екрані не знайдено, використовується центр екрану`, 'info');
    }

    // Точні координати цілі на екрані (як у Дизайнері Острова)
    const offsetX = -1 * dynamicTileSize;
    const offsetY = -0.4 * dynamicTileSize;

    const toCX = targetX + (w - 1) / 2;
    const toCY = targetY - (h - 1) / 2;
    const toX = dynOriginX + toCX * dynamicTileSize + offsetX;
    const toY = dynOriginY - toCY * dynamicTileSize + offsetY;

    // Початкова точка: де на екрані з'явилася нова будівля
    let fromX = dynOriginX;
    let fromY = dynOriginY;

    if (screenData.spawnedBuilding) {
      fromX = screenData.spawnedBuilding.x;
      fromY = screenData.spawnedBuilding.y;
      logToClient(`📍 Нову будівлю зафіксовано на екрані на (${Math.round(fromX)}, ${Math.round(fromY)})`, 'info');
    } else {
      fromX = (screenData.viewport?.w || 1280) / 2;
      fromY = (screenData.viewport?.h || 720) / 2;
      logToClient(`📍 Початкова точка будівлі по центру екрану: (${Math.round(fromX)}, ${Math.round(fromY)})`, 'info');
    }

    logToClient(`🖱️ Перетягування з (${Math.round(fromX)}, ${Math.round(fromY)}) до (${Math.round(toX)}, ${Math.round(toY)})`, 'info');
    await activePage.mouse.move(fromX, fromY);
    await activePage.mouse.down();
    await smartSleep(400, ws);
    await activePage.mouse.move(toX, toY, { steps: 35 });
    await smartSleep(400, ws);
    await activePage.mouse.up();
    await smartSleep(1500, ws);

    // ── Крок 6: Клік на 1-ше підтвердження ───────────────────────────────────
    const c1 = confirmImage1 || 'confirm';
    logToClient(`⏳ Крок 6: Клік на 1-ше підтвердження («${c1}»)`, 'info');
    
    // Спроба прямого кліку по активній кнопці з картинкою confirm в DOM
    const confirmed = await activePage.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img')).filter(i => (i.src || '').includes('confirm') || (i.src || '').includes('tick'));
      if (imgs.length === 0) return false;
      const img = imgs[imgs.length - 1];
      const btn = (img.closest('button, .cursor-pointer') as HTMLElement) || img.parentElement || img;
      btn.click();
      return true;
    });

    if (!confirmed) {
      const c1Res = await clickTarget(activePage, c1, false);
      if (!c1Res.success) {
        const confLoc = activePage.locator('img[src*="confirm"], img[src*="tick"], button:has(img[src*="confirm"])');
        if (await confLoc.count() > 0) {
          await confLoc.last().click({ force: true, timeout: 5000 }).catch(() => {});
        }
      }
    }
    await smartSleep(1000, ws);

    // ── Крок 7: Клік на 2-ге підтвердження (якщо задано) ─────────────────────
    if (confirmImage2 && confirmImage2.trim() !== '') {
      logToClient(`⏳ Крок 7: Клік на 2-ге підтвердження («${confirmImage2}»)`, 'info');
      await clickTarget(activePage, confirmImage2, false);
      await smartSleep(800, ws);
    }

    // ── Крок 8: Кнопка Save / Зберегти (якщо задано) ─────────────────────────
    if (saveSelector && saveSelector.trim() !== '') {
      logToClient(`⏳ Крок 8: Натискання кнопки Save («${saveSelector}»)`, 'info');
      await clickTarget(activePage, saveSelector, false);
      await smartSleep(1000, ws);
    }

    logToClient(`✅ Будівлю «${effectiveBuildingName || 'Building'}» успішно розміщено та збережено на (${targetX}, ${targetY})!`, 'success');
    return { data: context, nextHandle: ['success'] };

  } catch (err: any) {
    logToClient(`❌ Помилка під час розміщення будівлі: ${err.message}`, 'error');
    return { data: { ...context, error: err.message }, nextHandle: ['error'] };
  }
};
