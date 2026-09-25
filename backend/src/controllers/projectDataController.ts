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
        const farmActivity: Record<string, number> = farm.farmActivity || {};

        // 1. Назва проекту, Lvl, острів
        const experience = typeof bumpkin.experience === 'number' ? bumpkin.experience : parseFloat(String(bumpkin.experience || 0)) || 0;
        const level = getBumpkinLevel(experience);
        const islandType = farm.island?.type || 'basic';
        const islandExpansions = inventory['Basic Land'] || farm.island?.previousExpansions || 0;

        // 2. Доставки за типами, допомога гравцям, міні-ігри
        const deliveries = {
          coins: farmActivity['Coins Order Delivered'] || 0,
          flower: farmActivity['FLOWER Order Delivered'] || 0,
          ticket: farmActivity['Ticket Order Delivered'] || 0,
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

        // 4 & 9. Насіння рослин та квітів поточного сезону в інвентарі
        const flowerSeedNames = new Set([
          'Sunpetal Seed', 'Bloom Seed', 'Lily Seed', 'Edelweiss Seed', 'Gladiolus Seed', 'Lavender Seed', 'Clover Seed'
        ]);
        const fruitSeedNames = new Set([
          'Apple Seed', 'Orange Seed', 'Blueberry Seed', 'Banana Plant', 'Tomato Seed', 'Lemon Seed'
        ]);

        const seasonalCropSeeds: { name: string; count: number }[] = [];
        const seasonalFlowerSeeds: { name: string; count: number }[] = [];

        const inSeasonSeeds = Object.keys(stock).filter(k => k.endsWith(' Seed') || k.endsWith(' Plant'));
        for (const sName of inSeasonSeeds) {
          const invCount = Number(inventory[sName]) || 0;
          if (flowerSeedNames.has(sName)) {
            seasonalFlowerSeeds.push({ name: sName, count: invCount });
          } else if (!fruitSeedNames.has(sName)) {
            seasonalCropSeeds.push({ name: sName, count: invCount });
          }
        }

        // Якщо stock не завантажений, дивимося всі наявні насіння
        if (seasonalCropSeeds.length === 0) {
          for (const [k, v] of Object.entries(inventory)) {
            const numVal = Number(v) || 0;
            if ((k.endsWith(' Seed') || k.endsWith(' Plant')) && !flowerSeedNames.has(k) && !fruitSeedNames.has(k) && numVal > 0) {
              seasonalCropSeeds.push({ name: k, count: numVal });
            }
          }
        }
        if (seasonalFlowerSeeds.length === 0) {
          for (const sName of Array.from(flowerSeedNames)) {
            const count = Number(inventory[sName]) || 0;
            if (count > 0) {
              seasonalFlowerSeeds.push({ name: sName, count });
            }
          }
        }

        // 5. Фруктові дерева (квадрати)
        const fruitPatches = Object.entries(farm.fruitPatches || {}) as [string, any][];
        const fruitGrowthMap: Record<string, number> = {
          Apple: 24 * 3600 * 1000,
          Orange: 24 * 3600 * 1000,
          Blueberry: 24 * 3600 * 1000,
          Banana: 24 * 3600 * 1000,
          Tomato: 2 * 3600 * 1000,
          Lemon: 24 * 3600 * 1000,
        };
        const fruitTrees = fruitPatches.map(([id, patch]) => {
          const fruit = patch?.fruit;
          const fName = fruit?.name || 'Apple';
          const harvestsLeft = typeof fruit?.harvestsLeft === 'number' ? fruit.harvestsLeft : 3;
          const amount = typeof fruit?.amount === 'number' ? fruit.amount : 1;
          const growthMs = fruitGrowthMap[fName] || (24 * 3600 * 1000);
          const lastActivity = (fruit?.harvestedAt && fruit.harvestedAt > 0) ? fruit.harvestedAt : (fruit?.plantedAt || 0);
          const readyAt = lastActivity + growthMs;
          const remainingMs = Math.max(0, readyAt - now);
          const isReady = remainingMs === 0;

          return {
            id,
            name: fName,
            harvestsLeft,
            amount,
            isReady,
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

        // 14. Ресурси для покращення острова
        let islandUpgrade: any = null;
        if (islandType === 'basic') {
          const resCount = Number(inventory['Gold']) || 0;
          islandUpgrade = {
            currentLevel: level,
            requiredLevel: 10,
            resourceName: 'Gold',
            currentResource: resCount,
            requiredResource: 5,
            nextIslandType: 'spring',
            canUpgrade: level >= 10 && resCount >= 5,
          };
        } else if (islandType === 'spring') {
          const resCount = Number(inventory['Crimstone']) || 0;
          islandUpgrade = {
            currentLevel: level,
            requiredLevel: 40,
            resourceName: 'Crimstone',
            currentResource: resCount,
            requiredResource: 20,
            nextIslandType: 'desert',
            canUpgrade: level >= 40 && resCount >= 20,
          };
        } else if (islandType === 'desert') {
          const resCount = Number(inventory['Oil']) || 0;
          islandUpgrade = {
            currentLevel: level,
            requiredLevel: 70,
            resourceName: 'Oil',
            currentResource: resCount,
            requiredResource: 200,
            nextIslandType: 'volcano',
            canUpgrade: level >= 70 && resCount >= 200,
          };
        } else if (islandType === 'volcano') {
          const resCount = Number(inventory['Crimstone']) || 0;
          islandUpgrade = {
            currentLevel: level,
            requiredLevel: 150,
            resourceName: 'Crimstone',
            currentResource: resCount,
            requiredResource: 30,
            nextIslandType: 'ascension',
            canUpgrade: level >= 150 && resCount >= 30,
          };
        }

        cards.push({
          projectName,
          level,
          experience,
          islandType,
          islandExpansions,
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


