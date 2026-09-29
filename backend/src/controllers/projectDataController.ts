import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';
import { PROJECTS_DIR } from '../constants';
import { inputValidator } from '../validation/InputValidator';
import { getProjectSaveData } from '../utils/saveStorage';
import { getDbProjectLayout, saveDbProjectLayout, deleteDbProjectLayout, getProjects as getDbProjects } from '../db/schema';
import { loadProjectVariables } from '../utils/variableStorage';
import { getImageUrl } from '../inventory-overview/InventoryReader';
import { getBumpkinLevel } from '../utils/bumpkinLevel';
import { BASE_GROWTH_TIMES } from '../plugins/sunflower-land/data/crops';

const logger = new Logger('ProjectDataController');

export async function getProjectSave(req: Request, res: Response): Promise<void> {
  try {
    const { projectName } = req.params;
    const data = await getProjectSaveData(projectName);
    
    if (data) {
      res.json({ success: true, data });
      return;
    }

    res.status(404).json({ success: false, error: 'Файл збереження не знайдено' });
  } catch (err) {
    logger.error('Failed to get project save', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Помилка завантаження збереження' });
  }
}

export async function getProjectMap(req: Request, res: Response): Promise<void> {
  try {
    const { projectName } = req.params;
    const layoutPath = path.join(PROJECTS_DIR, `${projectName}_layout.json`);
    const globalTypesPath = path.join(PROJECTS_DIR, 'global_building_types.json');
    let globalBuildingTypes = {};
    if (fs.existsSync(globalTypesPath)) {
      try {
        globalBuildingTypes = JSON.parse(await fs.promises.readFile(globalTypesPath, 'utf-8'));
      } catch (e) {}
    }

    // 1. Спочатку перевіряємо SQLite
    let data = getDbProjectLayout(projectName);

    // 2. Fallback на диск, якщо в SQLite ще немає
    if (!data && fs.existsSync(layoutPath)) {
      try {
        const content = await fs.promises.readFile(layoutPath, 'utf-8');
        data = JSON.parse(content);
        if (data) {
          try { saveDbProjectLayout(projectName, data); } catch (_) {}
        }
      } catch (_) {}
    }

    if (!data) {
      res.json({
        success: true,
        data: { items: [], buildingTypes: globalBuildingTypes }
      });
      return;
    }
    
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (!data.buildingTypes || Object.keys(data.buildingTypes).length === 0) {
        data.buildingTypes = globalBuildingTypes;
      }
    }

    res.json({ success: true, data });
  } catch (err) {
    logger.error('Failed to get project map layout', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Помилка завантаження карти острова' });
  }
}

export async function saveProjectMap(req: Request, res: Response): Promise<void> {
  try {
    const { projectName } = req.params;
    
    // 1. Зберігаємо в SQLite
    try {
      saveDbProjectLayout(projectName, req.body);
    } catch (dbErr) {
      logger.warn(`Failed to save layout to SQLite for ${projectName}`, { error: String(dbErr) });
    }

    // 2. Зберігаємо на диск
    const layoutPath = path.join(PROJECTS_DIR, `${projectName}_layout.json`);
    await fs.promises.writeFile(layoutPath, JSON.stringify(req.body, null, 2), 'utf-8');
    logger.info(`Saved island layout for project ${projectName}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to save project map layout', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Помилка збереження карти острова' });
  }
}

export async function deleteProjectMap(req: Request, res: Response): Promise<void> {
  try {
    const { projectName } = req.params;
    
    // 1. Видаляємо з SQLite
    deleteDbProjectLayout(projectName);

    // 2. Видаляємо з диска
    const layoutPath = path.join(PROJECTS_DIR, `${projectName}_layout.json`);
    if (fs.existsSync(layoutPath)) {
      await fs.promises.unlink(layoutPath);
      logger.info(`Deleted island layout for project ${projectName}`);
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to delete project map layout', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Помилка видалення карти острова' });
  }
}

export async function getProjectDeliveries(req: Request, res: Response): Promise<void> {
  try {
    const { projectName } = req.params;
    const validation = inputValidator.validateProjectName(projectName);
    if (!validation.isValid) {
      res.status(400).json({ success: false, error: validation.error });
      return;
    }

    let orders: any[] = [];
    let timestamp: number = Date.now();

    const saveData = await getProjectSaveData(projectName);
    if (saveData) {
      const rawOrders =
        saveData.visitedFarmState?.delivery?.orders ||
        saveData.visitorFarmState?.delivery?.orders ||
        saveData.delivery?.orders ||
        [];

      if (Array.isArray(rawOrders)) {
        orders = rawOrders.map((order: any) => ({
          id: String(order.id || ''),
          from: String(order.from || ''),
          items: order.items || {},
          readyAt: typeof order.readyAt === 'number' ? order.readyAt : (typeof order.createdAt === 'number' ? order.createdAt : 0),
          createdAt: typeof order.createdAt === 'number' ? order.createdAt : 0,
          completedAt: typeof order.completedAt === 'number' ? order.completedAt : null,
          reward: {
            coins: order.reward?.coins ?? null,
            sfl: order.reward?.sfl ?? null,
            items: order.reward?.items ?? {}
          }
        }));
      }
    }

    res.json({
      data: orders,
      timestamp,
      projectName
    });
  } catch (err: any) {
    logger.error('Failed to get deliveries for project', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load deliveries' });
  }
}

export async function getAllProjectsDeliveries(_req: Request, res: Response): Promise<void> {
  try {
    const dbProjects = getDbProjects();
    const projectNames = (dbProjects && dbProjects.length > 0)
      ? dbProjects.map(p => p.name).filter(n =>
          !n.endsWith('_vars') && !n.endsWith('_save') && !n.endsWith('_layout') &&
          !n.endsWith('_stats') && !n.endsWith('_logs') && !n.endsWith('_inventory') &&
          !['categories', 'global_building_types', 'buildings_catalog_settings', 'schedule', 'notifications', 'configs', 'mass_launches'].includes(n)
        )
      : [];

    const allDeliveries: Record<string, any[]> = {};
    const allInventories: Record<string, any[]> = {};
    const allMarked: Record<string, string[]> = {};

    for (const projectName of projectNames) {
      try {
        const saveData = await getProjectSaveData(projectName);
        if (saveData) {
          const rawOrders =
            saveData.visitedFarmState?.delivery?.orders ||
            saveData.visitorFarmState?.delivery?.orders ||
            saveData.delivery?.orders ||
            [];

          if (Array.isArray(rawOrders) && rawOrders.length > 0) {
            allDeliveries[projectName] = rawOrders.map((order: any) => ({
              id: String(order.id || ''),
              from: String(order.from || ''),
              items: order.items || {},
              readyAt: typeof order.readyAt === 'number' ? order.readyAt : (typeof order.createdAt === 'number' ? order.createdAt : 0),
              createdAt: typeof order.createdAt === 'number' ? order.createdAt : 0,
              completedAt: typeof order.completedAt === 'number' ? order.completedAt : null,
              reward: {
                coins: order.reward?.coins ?? null,
                sfl: order.reward?.sfl ?? null,
                items: order.reward?.items ?? {}
              }
            }));
          }

          const rawInventory: Record<string, any> =
            (saveData.visitedFarmState && saveData.visitedFarmState.inventory) ||
            (saveData.visitorFarmState && saveData.visitorFarmState.inventory) ||
            saveData.inventory ||
            {};

          if (Object.keys(rawInventory).length > 0) {
            allInventories[projectName] = Object.entries(rawInventory)
              .map(([key, val]) => ({
                image: getImageUrl(key),
                number: typeof val === 'number' ? val : parseFloat(String(val)) || 0,
                selector: '',
                coords: { x: 0, y: 0 }
              }))
              .filter(item => item.number > 0);
          }
        }

        const variables = await loadProjectVariables(projectName);
        const markedSet = new Set<string>();
        const legacyRaw = variables['__markedDeliveries'];
        if (Array.isArray(legacyRaw)) {
          legacyRaw.forEach(k => { if (typeof k === 'string') markedSet.add(k); });
        }
        for (const [key, value] of Object.entries(variables)) {
          if (key === '__markedDeliveries' || key.startsWith('__markedItems_')) continue;
          const numVal = typeof value === 'number' ? value : (typeof value === 'boolean' ? (value ? 1 : 0) : parseInt(String(value), 10));
          if (numVal === 1) markedSet.add(key);
        }
        if (markedSet.size > 0) {
          allMarked[projectName] = Array.from(markedSet);
        }
      } catch (projErr) {
        logger.warn(`Failed to process deliveries for ${projectName}`, { error: String(projErr) });
      }
    }

    res.json({
      success: true,
      timestamp: Date.now(),
      deliveries: allDeliveries,
      inventories: allInventories,
      marked: allMarked
    });
  } catch (err: any) {
    logger.error('Failed to get all deliveries', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load all deliveries' });
  }
}

const FLOWER_NPCS = new Set(['miranda', 'poppy', 'raven', 'finn', 'flora', 'florence']);
const FLOWER_ITEMS_REGEX = /(balloon flower|pansy|cosmos|carnation|lotus|daffodil|edelweiss|gladiolus|lavender|clover|anemone|primrose|dahlia|marigold|camellia|hyacinth|hibiscus|poppy)/i;

function isDeliveredToday(completedAt?: number | null): boolean {
  if (!completedAt) return false;
  const date = new Date(completedAt);
  const now = new Date();
  return (
    date.toISOString().split('T')[0] === now.toISOString().split('T')[0] ||
    date.toLocaleDateString() === now.toLocaleDateString() ||
    Math.abs(now.getTime() - completedAt) < 24 * 3600 * 1000
  );
}

function classifyDeliveryOrder(order: any): 'coins' | 'flower' | 'ticket' {
  const from = (order.from || '').toLowerCase();
  const reward = order.reward || {};
  const rewardItems = Object.keys(reward.items || {});
  const isTicketReward = rewardItems.some(name => /ticket|scroll|feather/i.test(name));

  // 1. Квитки / Chores / Івентові (Pumpkin Pete тощо)
  if (from.includes('pete') || from === 'hank' || isTicketReward) {
    return 'ticket';
  }

  // 2. Квіткові NPC або замовлення з квітами
  const itemNames = Object.keys(order.items || {});
  const isFlowerItem = itemNames.some(name => FLOWER_ITEMS_REGEX.test(name));
  if (FLOWER_NPCS.has(from) || isFlowerItem) {
    return 'flower';
  }

  // 3. Грошові (Coins / SFL)
  return 'coins';
}

const SEASON_CROPS_MAP: Record<string, string[]> = {
  spring: ['Sunflower', 'Rhubarb', 'Carrot', 'Cabbage', 'Soybean', 'Cauliflower', 'Parsnip', 'Eggplant', 'Corn', 'Radish', 'Wheat'],
  summer: ['Sunflower', 'Potato', 'Zucchini', 'Yam', 'Soybean', 'Pepper', 'Broccoli', 'Corn', 'Onion', 'Radish', 'Wheat'],
  autumn: ['Sunflower', 'Pumpkin', 'Carrot', 'Cabbage', 'Beetroot', 'Parsnip', 'Eggplant', 'Artichoke', 'Wheat'],
  winter: ['Sunflower', 'Potato', 'Yam', 'Cabbage', 'Beetroot', 'Onion', 'Turnip', 'Kale', 'Barley', 'Wheat']
};

const SEASON_FLOWERS_MAP: Record<string, string[]> = {
  spring: ['Sunpetal Seed', 'Bloom Seed', 'Lily Seed'],
  summer: ['Gladiolus Seed', 'Edelweiss Seed'],
  autumn: ['Lavender Seed', 'Clover Seed'],
  winter: ['Lotus Seed', 'Daffodil Seed']
};

interface ExpansionReq {
  level: number;
  coins?: number;
  resources: Record<string, number>;
}

const BASIC_EXPANSIONS: Record<number, ExpansionReq> = {
  4: { level: 1, resources: { Wood: 3 } },
  5: { level: 1, resources: { Wood: 5 }, coins: 0.25 },
  6: { level: 2, resources: { Stone: 1 }, coins: 60 },
  7: { level: 5, resources: { Stone: 5, Iron: 1 }, coins: 100 },
  8: { level: 8, resources: { Iron: 3, Gold: 1 }, coins: 200 },
  9: { level: 11, resources: { Wood: 100, Stone: 40, Iron: 5 }, coins: 300 },
};

const SPRING_EXPANSIONS: Record<number, ExpansionReq> = {
  5: { level: 11, resources: { Wood: 20 }, coins: 100 },
  6: { level: 13, resources: { Wood: 10, Stone: 5, Gold: 2 }, coins: 200 },
  7: { level: 16, resources: { Wood: 30, Stone: 20, Iron: 5, Gem: 15 }, coins: 300 },
  8: { level: 20, resources: { Wood: 20, Crimstone: 1, Gem: 15 }, coins: 400 },
  9: { level: 23, resources: { Wood: 50, Gold: 5, Gem: 15 }, coins: 500 },
  10: { level: 25, resources: { Stone: 10, Crimstone: 3, Gem: 15 }, coins: 500 },
  11: { level: 27, resources: { Wood: 100, Stone: 25, Gold: 5, Crimstone: 1, Gem: 15 }, coins: 500 },
  12: { level: 29, resources: { Wood: 50, Iron: 5, Crimstone: 3, Gem: 30 }, coins: 500 },
  13: { level: 32, resources: { Wood: 50, Stone: 25, Iron: 10, Gold: 10, Gem: 30 }, coins: 500 },
  14: { level: 36, resources: { Wood: 100, Stone: 10, Crimstone: 5, Gem: 30 }, coins: 500 },
  15: { level: 40, resources: { Wood: 150, Stone: 10, Iron: 10, Gold: 5, Crimstone: 5, Gem: 30 }, coins: 500 },
  16: { level: 43, resources: { Wood: 100, Stone: 10, Gold: 5, Crimstone: 8, Gem: 30 }, coins: 500 },
};

const DESERT_EXPANSIONS: Record<number, ExpansionReq> = {
  5: { level: 40, resources: { Wood: 50, Stone: 10, Iron: 5, Gold: 5 }, coins: 500 },
  6: { level: 40, resources: { Wood: 100, Stone: 20, Iron: 10, Gold: 5 }, coins: 500 },
  7: { level: 41, resources: { Wood: 150, Stone: 20, Iron: 10, Gold: 5, Gem: 15 }, coins: 500 },
  8: { level: 42, resources: { Wood: 150, Stone: 10, Iron: 5, Gold: 5, Crimstone: 3, Oil: 5, Gem: 30 }, coins: 500 },
  9: { level: 43, resources: { Wood: 50, Stone: 5, Iron: 5, Gold: 5, Crimstone: 6, Oil: 5, Gem: 30 }, coins: 500 },
  10: { level: 44, resources: { Wood: 100, Stone: 50, Iron: 10, Gold: 5, Crimstone: 12, Oil: 10, Gem: 45 }, coins: 384 },
  11: { level: 45, resources: { Wood: 150, Stone: 75, Iron: 10, Gold: 5, Crimstone: 15, Oil: 30, Gem: 45 }, coins: 768 },
  12: { level: 47, resources: { Wood: 100, Stone: 100, Iron: 5, Gold: 10, Crimstone: 18, Oil: 30, Gem: 45 }, coins: 1536 },
  13: { level: 50, resources: { Wood: 200, Stone: 50, Iron: 15, Gold: 10, Crimstone: 21, Oil: 40, Gem: 45 }, coins: 3072 },
  14: { level: 53, resources: { Wood: 200, Stone: 100, Iron: 15, Gold: 10, Crimstone: 24, Oil: 50, Gem: 45 }, coins: 3840 },
  15: { level: 56, resources: { Wood: 300, Stone: 50, Iron: 20, Gold: 10, Crimstone: 27, Oil: 75, Gem: 45 }, coins: 3840 },
  16: { level: 58, resources: { Wood: 250, Stone: 125, Iron: 15, Gold: 15, Crimstone: 30, Oil: 100, Gem: 60 }, coins: 3840 },
  17: { level: 60, resources: { Wood: 350, Stone: 75, Iron: 20, Gold: 10, Crimstone: 33, Oil: 125, Gem: 60 }, coins: 5760 },
  18: { level: 63, resources: { Wood: 400, Stone: 125, Iron: 25, Gold: 15, Crimstone: 36, Oil: 150, Gem: 75 }, coins: 5760 },
  19: { level: 65, resources: { Wood: 450, Stone: 150, Iron: 30, Gold: 20, Crimstone: 39, Oil: 200, Gem: 60 }, coins: 7680 },
  20: { level: 68, resources: { Wood: 525, Stone: 200, Iron: 35, Gold: 30, Crimstone: 42, Oil: 250, Gem: 60 }, coins: 7680 },
  21: { level: 70, resources: { Wood: 550, Stone: 150, Iron: 30, Gold: 25, Crimstone: 45, Oil: 350, Gem: 60 }, coins: 9600 },
  22: { level: 72, resources: { Wood: 600, Stone: 200, Iron: 35, Gold: 30, Crimstone: 48, Oil: 450, Gem: 75 }, coins: 9600 },
  23: { level: 73, resources: { Wood: 650, Stone: 250, Iron: 40, Gold: 35, Crimstone: 51, Oil: 500, Gem: 75 }, coins: 9600 },
  24: { level: 74, resources: { Wood: 700, Stone: 300, Iron: 50, Gold: 45, Crimstone: 54, Oil: 550, Gem: 75 }, coins: 11520 },
  25: { level: 75, resources: { Wood: 750, Stone: 350, Iron: 50, Gold: 50, Crimstone: 60, Oil: 650, Gem: 75 }, coins: 13440 },
};

function calculateIslandProgression(
  islandType: string,
  level: number,
  expansionsCountRaw: any,
  inventory: Record<string, any>
) {
  const expansionsCount = Number(expansionsCountRaw) || 0;
  const RESOURCE_PRIORITY = ['Crimstone', 'Sunstone', 'Oil', 'Gold', 'Iron', 'Stone', 'Wood', 'Gem'];

  const pickPrimaryResource = (resMap: Record<string, number>) => {
    for (const res of RESOURCE_PRIORITY) {
      if (resMap[res] !== undefined && resMap[res] > 0) {
        return { name: res, required: resMap[res], current: Number(inventory[res]) || 0 };
      }
    }
    const firstKey = Object.keys(resMap)[0];
    if (firstKey) {
      return { name: firstKey, required: resMap[firstKey], current: Number(inventory[firstKey]) || 0 };
    }
    return { name: '', required: 0, current: 0 };
  };

  const buildTooltip = (target: string, reqLvl: number, resMap: Record<string, number>, coins?: number) => {
    const parts = [target, `Lvl: ${reqLvl}`];
    if (coins) parts.push(`Coins: ${coins}`);
    for (const [rName, rAmt] of Object.entries(resMap)) {
      parts.push(`${rName}: ${Number(inventory[rName]) || 0}/${rAmt}`);
    }
    return parts.join(' | ');
  };

  if (islandType === 'basic') {
    const nextLand = Math.max(4, expansionsCount + 1);
    if (expansionsCount < 9 && BASIC_EXPANSIONS[nextLand]) {
      const req = BASIC_EXPANSIONS[nextLand];
      const prim = pickPrimaryResource(req.resources);
      const isLvlOk = level >= req.level;
      const allResOk = Object.entries(req.resources).every(([rName, rAmt]) => (Number(inventory[rName]) || 0) >= Number(rAmt));
      return {
        targetLabel: `🏝️ Basic L${nextLand}`,
        currentLevel: level,
        requiredLevel: req.level,
        resourceName: prim.name,
        currentResource: prim.current,
        requiredResource: prim.required,
        nextIslandType: 'spring',
        tooltip: buildTooltip(`Basic Land ${nextLand}`, req.level, req.resources, req.coins),
        isMaxLevel: false,
        isLastUpgrade: false,
        canUpgrade: isLvlOk && allResOk,
      };
    }
    const goldCount = Number(inventory['Gold']) || 0;
    const canUpgrade = level >= 10 && goldCount >= 10;
    return {
      targetLabel: '🏝️ → Spring',
      currentLevel: level,
      requiredLevel: 10,
      resourceName: 'Gold',
      currentResource: goldCount,
      requiredResource: 10,
      nextIslandType: 'spring',
      tooltip: `Покращення острова: Basic → Spring (Lvl 10, Gold: ${goldCount}/10)`,
      isMaxLevel: false,
      isLastUpgrade: false,
      canUpgrade,
    };
  }

  if (islandType === 'spring') {
    const nextLand = Math.max(5, expansionsCount + 1);
    if (expansionsCount < 16 && SPRING_EXPANSIONS[nextLand]) {
      const req = SPRING_EXPANSIONS[nextLand];
      const prim = pickPrimaryResource(req.resources);
      const isLvlOk = level >= req.level;
      const allResOk = Object.entries(req.resources).every(([rName, rAmt]) => (Number(inventory[rName]) || 0) >= Number(rAmt));
      return {
        targetLabel: `🏝️ Spring L${nextLand}`,
        currentLevel: level,
        requiredLevel: req.level,
        resourceName: prim.name,
        currentResource: prim.current,
        requiredResource: prim.required,
        nextIslandType: 'desert',
        tooltip: buildTooltip(`Spring Land ${nextLand}`, req.level, req.resources, req.coins),
        isMaxLevel: false,
        isLastUpgrade: false,
        canUpgrade: isLvlOk && allResOk,
      };
    }
    const crimCount = Number(inventory['Crimstone']) || 0;
    const canUpgrade = level >= 40 && crimCount >= 20;
    return {
      targetLabel: '🏝️ → Desert',
      currentLevel: level,
      requiredLevel: 40,
      resourceName: 'Crimstone',
      currentResource: crimCount,
      requiredResource: 20,
      nextIslandType: 'desert',
      tooltip: `Покращення острова: Spring → Desert (Lvl 40, Crimstone: ${crimCount}/20)`,
      isMaxLevel: false,
      isLastUpgrade: true,
      canUpgrade,
    };
  }

  if (islandType === 'desert') {
    const nextLand = Math.max(5, expansionsCount + 1);
    if (expansionsCount < 25 && DESERT_EXPANSIONS[nextLand]) {
      const req = DESERT_EXPANSIONS[nextLand];
      const prim = pickPrimaryResource(req.resources);
      const isLvlOk = level >= req.level;
      const allResOk = Object.entries(req.resources).every(([rName, rAmt]) => (Number(inventory[rName]) || 0) >= Number(rAmt));
      return {
        targetLabel: `🏝️ Desert L${nextLand}`,
        currentLevel: level,
        requiredLevel: req.level,
        resourceName: prim.name,
        currentResource: prim.current,
        requiredResource: prim.required,
        nextIslandType: 'desert',
        tooltip: buildTooltip(`Desert Land ${nextLand}`, req.level, req.resources, req.coins),
        isMaxLevel: false,
        isLastUpgrade: true,
        canUpgrade: isLvlOk && allResOk,
      };
    }
    return {
      targetLabel: '🏝️ Desert (макс. рівень)',
      currentLevel: level,
      requiredLevel: level,
      resourceName: '',
      currentResource: 0,
      requiredResource: 0,
      nextIslandType: 'desert',
      tooltip: 'Desert — острів повністю розширено',
      isMaxLevel: true,
      isLastUpgrade: true,
      canUpgrade: false,
    };
  }

  return {
    targetLabel: `🏝️ ${islandType}`,
    currentLevel: level,
    requiredLevel: level,
    resourceName: '',
    currentResource: 0,
    requiredResource: 0,
    nextIslandType: islandType,
    tooltip: '',
    isMaxLevel: true,
    isLastUpgrade: true,
    canUpgrade: false,
  };
}

/**
 * Отримує повну інформацію для карточок усіх проектів ферми
 * (14 інформаційних блоків: рівні, доставки, грядки, дерева, ресурси, інструменти, квіти, страви, компостери, великі фрукти, риболовля, покращення островів)
 */
export async function getAllFarmCardsOverview(_req: Request, res: Response): Promise<void> {
  try {
    const dbProjects = getDbProjects();
    const diskFiles = (await fs.promises.readdir(PROJECTS_DIR)).filter(
      f => f.endsWith('.json') && !f.endsWith('_save.json') && !f.endsWith('_layout.json') && !f.startsWith('global_')
    );
    const diskProjectNames = diskFiles.map(f => f.replace(/\.json$/, ''));
    const projectNames = Array.from(new Set([...dbProjects.map(p => p.name), ...diskProjectNames]))
      .filter(name => Boolean(name) && name !== 'default');

    // Природне сортування проектів (SF1, SF2, ... SF10, Dimah)
    projectNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const cards: any[] = [];
    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];

    for (const projectName of projectNames) {
      try {
        const rawSave = await getProjectSaveData(projectName);
        if (!rawSave) continue;
        const farm = rawSave.visitedFarmState || rawSave.visitorFarmState || rawSave.farm || rawSave;
        const inventory: Record<string, number> = farm.inventory || {};
        const stock: Record<string, number> = farm.stock || {};
        const bumpkin = farm.bumpkin || {};

        // 1. Назва проекту, Lvl, острів, сезон
        const experience = typeof bumpkin.experience === 'number' ? bumpkin.experience : parseFloat(String(bumpkin.experience || 0)) || 0;
        const level = getBumpkinLevel(experience);
        const islandType = farm.island?.type || 'basic';
        const islandExpansions = inventory['Basic Land'] || farm.island?.previousExpansions || 0;
        const farmSeason = (
          farm.season?.season ||
          rawSave.season?.season ||
          farm.island?.type ||
          'spring'
        ).toLowerCase();

        // 2. Доставки за типами, виконані СЬОГОДНІ
        let coinsDeliveredToday = 0;
        let flowerDeliveredToday = 0;
        let ticketDeliveredToday = 0;

        const orders = farm.delivery?.orders || [];
        for (const order of orders) {
          if (order && order.completedAt && isDeliveredToday(order.completedAt)) {
            const cat = classifyDeliveryOrder(order);
            if (cat === 'coins') coinsDeliveredToday++;
            else if (cat === 'flower') flowerDeliveredToday++;
            else if (cat === 'ticket') ticketDeliveredToday++;
          }
        }

        const deliveries = {
          coins: coinsDeliveredToday,
          flower: flowerDeliveredToday,
          ticket: ticketDeliveredToday,
        };

        const helpedPlayers = {
          current: typeof rawSave.totalHelpedToday === 'number'
            ? rawSave.totalHelpedToday
            : (farm.socialFarming?.waves?.farms?.length || 0),
          max: 5,
        };

        const minigamePrizes = farm.minigames?.prizes || {};
        const minigameGames = farm.minigames?.games || {};
        const prizeKeys = Object.keys(minigamePrizes);
        let completedMinigames = 0;
        for (const gName of prizeKeys) {
          const target = minigamePrizes[gName]?.score || 0;
          const game = minigameGames[gName];
          if (game) {
            if ((game.highscore || 0) >= target) {
              completedMinigames++;
            } else if (game.history && game.history[todayStr]?.attempts > 0) {
              completedMinigames++;
            }
          }
        }
        const totalMinigames = prizeKeys.length || 6;

        // 3. Рослини на грядках
        const cropsMap: Record<string, { totalAmount: number; minRemainingMs: number; isReady: boolean; count: number }> = {};
        const plots = Object.values(farm.crops || {}) as any[];
        for (const plot of plots) {
          if (!plot?.crop) continue;
          const cName = plot.crop.name;
          if (!cName) continue;
          const plantedAt = plot.crop.plantedAt || 0;
          const boostedTime = plot.crop.boostedTime || 0;
          const baseGrowthMs = BASE_GROWTH_TIMES[cName] || (30 * 60 * 1000);
          const actualGrowthMs = Math.max(0, baseGrowthMs - boostedTime);
          const readyAt = plantedAt + actualGrowthMs;
          const remainingMs = Math.max(0, readyAt - now);
          const amount = typeof plot.crop.amount === 'number' ? plot.crop.amount : 1;

          if (!cropsMap[cName]) {
            cropsMap[cName] = { totalAmount: 0, minRemainingMs: remainingMs, isReady: remainingMs === 0, count: 0 };
          }
          cropsMap[cName].totalAmount += amount;
          cropsMap[cName].count += 1;
          if (remainingMs < cropsMap[cName].minRemainingMs) {
            cropsMap[cName].minRemainingMs = remainingMs;
          }
          if (remainingMs > 0) {
            cropsMap[cName].isReady = false;
          }
        }

        const cropsList = Object.entries(cropsMap).map(([name, data]) => ({
          name,
          totalAmount: Math.round(data.totalAmount * 10) / 10,
          remainingMs: data.minRemainingMs,
          isReady: data.isReady,
          count: data.count,
        }));

        // 4 & 9. Насіння рослин та квітів поточного сезону в інвентарі (тільки залишок count > 0)
        const seasonCrops = SEASON_CROPS_MAP[farmSeason] || SEASON_CROPS_MAP.spring;
        const seasonalCropSeeds: { name: string; count: number }[] = [];

        for (const cropName of seasonCrops) {
          const seedName = `${cropName} Seed`;
          const count = Number(inventory[seedName]) || 0;
          if (count > 0) {
            seasonalCropSeeds.push({ name: seedName, count });
          }
        }

        // Fallback: якщо насіння офіційного сезону не знайдено, але в інвентарі є будь-яке насіння культур
        if (seasonalCropSeeds.length === 0) {
          for (const [k, v] of Object.entries(inventory)) {
            const numVal = Number(v) || 0;
            if (k.endsWith(' Seed') && !k.endsWith('Flower Seed') && numVal > 0) {
              seasonalCropSeeds.push({ name: k, count: numVal });
            }
          }
        }

        // Квіти поточного сезону в інвентарі
        const seasonFlowers = SEASON_FLOWERS_MAP[farmSeason] || [];
        const seasonalFlowerSeeds: { name: string; count: number }[] = [];

        for (const flowerSeed of seasonFlowers) {
          const count = Number(inventory[flowerSeed]) || 0;
          if (count > 0) {
            seasonalFlowerSeeds.push({ name: flowerSeed, count });
          }
        }

        // Fallback: якщо за поточним сезоном квіткових насінин немає, але є інші насіння квітів > 0
        if (seasonalFlowerSeeds.length === 0) {
          const allFlowerSeeds = [
            'Sunpetal Seed', 'Bloom Seed', 'Lily Seed', 'Edelweiss Seed',
            'Gladiolus Seed', 'Lavender Seed', 'Clover Seed'
          ];
          for (const sName of allFlowerSeeds) {
            const count = Number(inventory[sName]) || 0;
            if (count > 0) {
              seasonalFlowerSeeds.push({ name: sName, count });
            }
          }
        }

        // 5. Фруктові дерева (квадрати)
        const fruitPatches = Object.entries(farm.fruitPatches || {}) as [string, any][];
        const fruitGrowthMap: Record<string, number> = {
          Tomato: 2 * 3600 * 1000,     // 2 години (7200с)
          Lemon: 4 * 3600 * 1000,      // 4 години (14400с)
          Blueberry: 6 * 3600 * 1000,  // 6 годин (21600с)
          Orange: 8 * 3600 * 1000,     // 8 годин (28800с)
          Apple: 12 * 3600 * 1000,     // 12 годин (43200с)
          Banana: 12 * 3600 * 1000,    // 12 годин (43200с)
          Celestine: 6 * 3600 * 1000,  // 6 годин
          Lunara: 12 * 3600 * 1000,    // 12 годин
          Duskberry: 24 * 3600 * 1000, // 24 години
        };
        const skills = farm.bumpkin?.skills || {};
        const fruitTrees = fruitPatches.map(([id, patch]) => {
          const fruit = patch?.fruit;
          const fName = fruit?.name || 'Apple';
          const harvestsLeft = typeof fruit?.harvestsLeft === 'number' ? fruit.harvestsLeft : 3;
          const amount = typeof fruit?.amount === 'number' ? fruit.amount : 1;

          let multiplier = 1;
          if (skills['Short Pickings']) {
            if (fName === 'Blueberry' || fName === 'Orange') multiplier *= 0.75;
            else if (fName === 'Apple' || fName === 'Banana') multiplier *= 1.1;
          }
          if (skills['Long Pickings']) {
            if (fName === 'Apple' || fName === 'Banana') multiplier *= 0.75;
            else if (fName === 'Blueberry' || fName === 'Orange') multiplier *= 1.1;
          }

          const baseGrowthMs = fruitGrowthMap[fName] || (12 * 3600 * 1000);
          const growthMs = baseGrowthMs * multiplier;
          const lastActivity = (fruit?.harvestedAt && fruit.harvestedAt > 0) ? fruit.harvestedAt : (fruit?.plantedAt || 0);

          let remainingMs = 0;
          let readyAt = 0;
          let isReady = false;
          let isDead = false;

          if (harvestsLeft <= 0) {
            isDead = true;
            isReady = false;
            remainingMs = 0;
          } else if (lastActivity === 0) {
            isReady = true;
            remainingMs = 0;
          } else {
            readyAt = lastActivity + growthMs;
            remainingMs = Math.max(0, readyAt - now);
            isReady = remainingMs === 0;
          }

          return {
            id,
            name: fName,
            harvestsLeft,
            amount,
            isReady,
            isDead,
            readyAt,
            remainingMs,
          };
        });

        // 6. Ресурси для збору
        const resourceConfig: { key: string; name: string; recoveryMs: number; actKey: string }[] = [
          { key: 'trees', name: 'Wood', recoveryMs: 2 * 3600 * 1000, actKey: 'choppedAt' },
          { key: 'stones', name: 'Stone', recoveryMs: 4 * 3600 * 1000, actKey: 'minedAt' },
          { key: 'iron', name: 'Iron', recoveryMs: 12 * 3600 * 1000, actKey: 'minedAt' },
          { key: 'gold', name: 'Gold', recoveryMs: 24 * 3600 * 1000, actKey: 'minedAt' },
          { key: 'crimstones', name: 'Crimstone', recoveryMs: 24 * 3600 * 1000, actKey: 'minedAt' },
          { key: 'sunstones', name: 'Sunstone', recoveryMs: 72 * 3600 * 1000, actKey: 'minedAt' },
          { key: 'oilReserves', name: 'Oil', recoveryMs: 20 * 3600 * 1000, actKey: 'drilledAt' },
        ];

        const resourcesList = resourceConfig.map(rc => {
          const nodesObj = farm[rc.key] || {};
          const nodes = Object.values(nodesObj) as any[];
          const totalCount = nodes.length;
          let readyCount = 0;
          let minRemainingMs = Infinity;

          for (const node of nodes) {
            const nodeData = node.wood || node.stone || node.oil || node;
            const time = nodeData[rc.actKey] || 0;
            if (time === 0) {
              readyCount++;
              minRemainingMs = 0;
            } else {
              const readyAt = time + rc.recoveryMs;
              const rem = Math.max(0, readyAt - now);
              if (rem === 0) {
                readyCount++;
              } else if (rem < minRemainingMs) {
                minRemainingMs = rem;
              }
            }
          }

          return {
            name: rc.name,
            readyCount,
            totalCount,
            remainingMs: minRemainingMs === Infinity ? 0 : minRemainingMs,
          };
        }).filter(r => r.totalCount > 0);

        // 7. Інструменти в інвентарі та на складі
        const toolNames = ['Axe', 'Pickaxe', 'Stone Pickaxe', 'Iron Pickaxe', 'Gold Pickaxe', 'Shovel', 'Rusty Shovel', 'Sand Shovel', 'Rod', 'Oil Drill'];
        const toolsList = toolNames.map(tName => ({
          name: tName,
          inventoryCount: Number(inventory[tName]) || 0,
          stockCount: Number(stock[tName]) || 0,
        })).filter(t => t.inventoryCount > 0 || t.stockCount > 0);

        // 8. Квіти що ростуть
        const flowerBeds = Object.values(farm.flowers?.flowerBeds || {}) as any[];
        const growingFlowers = flowerBeds.map(bed => {
          const fl = bed?.flower;
          if (!fl) return null;
          const flName = fl.name || 'Flower';
          const plantedAt = fl.plantedAt || 0;
          const growthMs = 24 * 3600 * 1000;
          const readyAt = plantedAt + growthMs;
          const remainingMs = Math.max(0, readyAt - now);
          return {
            name: flName,
            readyAt,
            remainingMs,
            isReady: remainingMs === 0,
          };
        }).filter(Boolean);

        // 10. Страви що готуються
        const cookingBuildings = ['Fire Pit', 'Kitchen', 'Bakery', 'Deli', 'Smoothie Shack'];
        const cookingDishes: any[] = [];
        for (const bName of cookingBuildings) {
          const bList = farm.buildings?.[bName] || [];
          for (const b of bList) {
            const queue = b.crafting || [];
            for (const dish of queue) {
              const dishName = dish.name;
              const readyAt = dish.readyAt || 0;
              const remainingMs = Math.max(0, readyAt - now);
              cookingDishes.push({
                name: dishName,
                buildingName: bName,
                readyAt,
                remainingMs,
                isReady: remainingMs === 0,
              });
            }
          }
        }

        // 11. Компостери (3 компостери)
        const composterTypes: ('Compost Bin' | 'Turbo Composter' | 'Premium Composter')[] = [
          'Compost Bin', 'Turbo Composter', 'Premium Composter'
        ];
        const compostersList = composterTypes.map(cName => {
          const bList = farm.buildings?.[cName] || [];
          const comp = bList[0];
          if (!comp) {
            return {
              name: cName,
              status: 'idle_ready',
              remainingMs: 0,
            };
          }
          if (comp.producing) {
            const readyAt = comp.producing.readyAt || 0;
            const remainingMs = Math.max(0, readyAt - now);
            if (remainingMs === 0) {
              return {
                name: cName,
                status: 'ready', // Зелений
                producingItem: Object.keys(comp.producing.items || {})[0] || 'Fertiliser',
                readyAt,
                remainingMs: 0,
              };
            } else {
              return {
                name: cName,
                status: 'producing', // Жовтий
                producingItem: Object.keys(comp.producing.items || {})[0] || 'Fertiliser',
                readyAt,
                remainingMs,
              };
            }
          }

          const reqs = comp.requires || {};
          let missing = false;
          for (const [resName, reqAmount] of Object.entries(reqs)) {
            if ((Number(inventory[resName]) || 0) < (reqAmount as number)) {
              missing = true;
              break;
            }
          }

          return {
            name: cName,
            status: missing ? 'idle_missing_resources' : 'idle_ready', // Червоний або сірий
            remainingMs: 0,
          };
        });

        // 12. Великі фрукти Project на острові
        const villageProjects = farm.socialFarming?.villageProjects || {};
        const bigFruitProjects = Object.entries(villageProjects).map(([vpName, vpData]: [string, any]) => ({
          name: vpName,
          cheers: vpData?.cheers || 0,
          goal: 25,
          isCompleted: (vpData?.cheers || 0) >= 25 || Boolean(vpData?.winnerId),
        }));

        // 13. Риболовля
        const fishingObj = farm.fishing || {};
        const fishingAttemptsObj = fishingObj.dailyAttempts || {};
        const attemptsToday = fishingAttemptsObj[todayStr] || 0;
        const baitsList = ['Earthworm', 'Grub', 'Red Wiggler', 'Fishing Lure'].map(b => ({
          name: b,
          count: Number(inventory[b]) || 0,
        })).filter(b => b.count > 0);

        const fishing = {
          dailyAttempts: attemptsToday,
          dailyLimit: 30,
          rodsCount: Number(inventory['Rod']) || 0,
          baits: baitsList,
        };

        // 14. Ресурси для розширення або покращення острова
        const islandUpgrade = calculateIslandProgression(islandType, level, islandExpansions, inventory);

        cards.push({
          projectName,
          level,
          experience,
          islandType,
          islandExpansions,
          season: farmSeason,
          deliveries,
          helpedPlayers,
          minigames: {
            completed: completedMinigames,
            total: totalMinigames,
          },
          crops: cropsList,
          seasonalCropSeeds,
          fruitTrees,
          resources: resourcesList,
          tools: toolsList,
          growingFlowers,
          seasonalFlowerSeeds,
          cookingDishes,
          composters: compostersList,
          bigFruitProjects,
          fishing,
          islandUpgrade,
        });
      } catch (projErr) {
        logger.warn(`Failed to process farm card for ${projectName}`, { error: String(projErr) });
      }
    }

    res.json({
      success: true,
      timestamp: Date.now(),
      cards,
    });
  } catch (err: any) {
    logger.error('Failed to get farm cards overview', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load farm cards overview' });
  }
}


