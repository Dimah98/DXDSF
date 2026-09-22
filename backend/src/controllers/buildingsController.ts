import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { PROJECTS_DIR } from '../constants';
import { DEFAULT_BUILDINGS_CATALOG, BuildingCatalogItem } from '../data/buildingsCatalog';

const SETTINGS_FILE = path.join(PROJECTS_DIR, 'buildings_catalog_settings.json');
const GLOBAL_BUILDING_TYPES_FILE = path.join(PROJECTS_DIR, 'global_building_types.json');

const XP_TABLE_MAP: Record<number, number> = {
  1: 0, 2: 2, 3: 22, 4: 205, 5: 555, 6: 1155, 7: 2155, 8: 3405, 9: 5405, 10: 7905,
  11: 10905, 12: 14405, 13: 18405, 14: 22905, 15: 27905, 16: 33655, 17: 40155, 18: 47405, 19: 55405, 20: 64155,
  21: 73905, 22: 84655, 23: 96405, 24: 109155, 25: 122905, 26: 137405, 27: 152905, 28: 169405, 29: 186905, 30: 205405,
  31: 225405, 32: 246905, 33: 269905, 34: 294405, 35: 320405, 36: 348405, 37: 378405, 38: 410405, 39: 444405, 40: 480405,
  41: 518905, 42: 559905, 43: 603405, 44: 649405, 45: 697905, 46: 749405, 47: 803905, 48: 861405, 49: 921905, 50: 985405,
  51: 1053905, 52: 1127405, 53: 1205905, 54: 1289405, 55: 1377905, 56: 1476405, 57: 1584905, 58: 1703405, 59: 1831905, 60: 1970405,
  61: 2128905, 62: 2287405, 63: 2485905, 64: 2704405, 65: 2942905, 66: 3221405, 67: 3539905, 68: 3898405, 69: 4296905, 70: 4735405,
  71: 5233905, 72: 5743905, 73: 6263905, 74: 6793905, 75: 7333905, 76: 7883905, 77: 8443905, 78: 9013905, 79: 9593905, 80: 10183905,
  81: 10783905, 82: 11393905, 83: 12013905, 84: 12643905, 85: 13283905, 86: 13933905, 87: 14593905, 88: 15263905, 89: 15943905, 90: 16633905,
  91: 17333905, 92: 18043905, 93: 18763905, 94: 19493905, 95: 20233905, 96: 20983905, 97: 21743905, 98: 22513905, 99: 23293905, 100: 24083905
};

function calculateBumpkinLevel(experience: number | null | undefined): number {
  if (experience === undefined || experience === null) return 1;
  const exp = Number(experience) || 0;
  let level = 1;
  for (let l = 1; l <= 150; l++) {
    const req = XP_TABLE_MAP[l];
    if (req !== undefined && exp >= req) {
      level = l;
    } else {
      break;
    }
  }
  return level;
}

// Завантаження актуального каталогу з урахуванням кастомних налаштувань
export async function getMergedCatalog(): Promise<BuildingCatalogItem[]> {
  let settings: Record<string, Partial<BuildingCatalogItem>> = {};
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      settings = JSON.parse(await fs.promises.readFile(SETTINGS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error reading buildings_catalog_settings.json:', e);
  }

  return DEFAULT_BUILDINGS_CATALOG.map((item) => {
    const custom = settings[item.name] || settings[item.id];
    const bImg = custom?.buildingImage ?? item.buildingImage;
    return {
      ...item,
      image: (bImg || item.mapImage || `${item.name}.png`).replace(/\.png$/i, ''),
      buildingImage: bImg,
      categoryImage: custom?.categoryImage ?? item.categoryImage,
      shopImage: custom?.shopImage ?? item.shopImage,
      mapImage: custom?.mapImage ?? item.mapImage,
    };
  });
}

// GET /api/buildings-catalog
export const getBuildingsCatalogHandler = async (_req: Request, res: Response) => {
  try {
    const catalog = await getMergedCatalog();
    res.json({ success: true, catalog });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// POST /api/buildings-catalog
export const saveBuildingsCatalogHandler = async (req: Request, res: Response) => {
  try {
    const rawList = req.body.catalog || req.body.items || req.body.buildings || (Array.isArray(req.body) ? req.body : null);
    let settingsToSave: Record<string, any> = req.body.settings || {};

    if (fs.existsSync(SETTINGS_FILE)) {
      try {
        const existing = JSON.parse(await fs.promises.readFile(SETTINGS_FILE, 'utf-8'));
        settingsToSave = { ...existing, ...settingsToSave };
      } catch (_) {}
    }

    if (Array.isArray(rawList)) {
      rawList.forEach((item: any) => {
        if (!item || !item.name) return;
        const bImg = item.buildingImage || item.image;
        settingsToSave[item.name] = {
          ...(settingsToSave[item.name] || {}),
          buildingImage: bImg ? String(bImg).trim() : undefined,
          categoryImage: item.categoryImage ? String(item.categoryImage).trim() : undefined,
          shopImage: item.shopImage ? String(item.shopImage).trim() : undefined,
          mapImage: item.mapImage || `${item.name}.png`,
        };
      });
    }

    await fs.promises.writeFile(SETTINGS_FILE, JSON.stringify(settingsToSave, null, 2), 'utf-8');

    // Також оновлюємо global_building_types.json для сумісності з картою
    try {
      let globalTypes: Record<string, any> = {};
      if (fs.existsSync(GLOBAL_BUILDING_TYPES_FILE)) {
        globalTypes = JSON.parse(await fs.promises.readFile(GLOBAL_BUILDING_TYPES_FILE, 'utf-8'));
      }
      DEFAULT_BUILDINGS_CATALOG.forEach((defItem) => {
        const cfg = settingsToSave[defItem.name] || {};
        globalTypes[defItem.name] = {
          ...(globalTypes[defItem.name] || {}),
          w: defItem.w,
          h: defItem.h,
          mapImage: cfg.mapImage || `${defItem.name}.png`,
          inventoryImage: cfg.buildingImage || globalTypes[defItem.name]?.inventoryImage || `${defItem.name}.png`,
          inventoryName: defItem.name
        };
      });
      await fs.promises.writeFile(GLOBAL_BUILDING_TYPES_FILE, JSON.stringify(globalTypes, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error updating global_building_types.json:', e);
    }

    res.json({ success: true, message: 'Налаштування будівель збережено' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /api/projects/:projectName/buildings-status
export const getProjectBuildingsStatusHandler = async (req: Request, res: Response) => {
  const { projectName } = req.params;
  try {
    const findFile = (prefix: string, suffix: string) => {
      const exact = path.join(PROJECTS_DIR, `${prefix}${suffix}`);
      if (fs.existsSync(exact)) return exact;
      try {
        const files = fs.readdirSync(PROJECTS_DIR);
        const match = files.find(f => f.toLowerCase() === `${prefix.toLowerCase()}${suffix.toLowerCase()}`);
        if (match) return path.join(PROJECTS_DIR, match);
      } catch (_) {}
      return null;
    };

    const saveFilePath = findFile(projectName, '_save.json');
    const projFilePath = findFile(projectName, '.json');

    let saveData: any = null;
    let projData: any = null;
    if (saveFilePath && fs.existsSync(saveFilePath)) {
      try {
        saveData = JSON.parse(await fs.promises.readFile(saveFilePath, 'utf-8'));
      } catch (_) {}
    }
    if (projFilePath && fs.existsSync(projFilePath)) {
      try {
        projData = JSON.parse(await fs.promises.readFile(projFilePath, 'utf-8'));
      } catch (_) {}
      if (!saveData) saveData = projData;
    }

    const extractVFarm = (data: any): any => {
      if (!data || typeof data !== 'object') return null;
      if (data.visitedFarmState) return data.visitedFarmState;
      if (Array.isArray(data.nodes)) {
        for (const node of data.nodes) {
          if (node.data?.visitedFarmState) return node.data.visitedFarmState;
          if (Array.isArray(node.data?.subNodes)) {
            for (const sub of node.data.subNodes) {
              if (sub.data?.visitedFarmState) return sub.data.visitedFarmState;
            }
          }
        }
      }
      return null;
    };

    let farm = extractVFarm(saveData) || saveData?.visitedFarmState || saveData || {};
    if (projData) {
      const projVFarm = extractVFarm(projData) || projData.visitedFarmState || projData;
      if (projVFarm && typeof projVFarm === 'object') {
        farm = { ...projVFarm, ...farm };
        if (!farm.bumpkin && projVFarm.bumpkin) farm.bumpkin = projVFarm.bumpkin;
      }
    }

    const inventory = farm.inventory || {};
    let projectCoins = 0;
    if (farm.coins !== undefined) {
      projectCoins = Number(farm.coins) || 0;
    } else if (inventory.Gold !== undefined) {
      projectCoins = Number(inventory.Gold) || 0;
    }

    let projectLevel = 1;
    const experience = farm.bumpkin?.experience;
    if (experience !== undefined && experience !== null) {
      projectLevel = calculateBumpkinLevel(experience);
    }

    // Збираємо список наявних будівель (на карті або в інвентарі)
    const placedCounts: Record<string, number> = {};
    if (farm.buildings) {
      Object.entries(farm.buildings).forEach(([bName, arr]: [string, any]) => {
        if (Array.isArray(arr)) placedCounts[bName] = (placedCounts[bName] || 0) + arr.length;
      });
    }
    if (farm.collectibles) {
      Object.entries(farm.collectibles).forEach(([cName, arr]: [string, any]) => {
        if (Array.isArray(arr)) placedCounts[cName] = (placedCounts[cName] || 0) + arr.length;
      });
    }

    const catalog = await getMergedCatalog();

    const statusItems = catalog.map((item) => {
      const invCount = Number(inventory[item.name] ?? 0);
      const placedCount = placedCounts[item.name] ?? 0;
      const totalOwned = invCount + placedCount;
      const isPurchased = totalOwned > 0;

      const levelMet = projectLevel >= item.level;
      const reqCoins = Number(item.ingredients.coins || 0);
      const coinsMet = projectCoins >= reqCoins;

      const ingredientStatus: Record<string, { required: number; available: number; met: boolean }> = {};
      const ingredientsOnly: Record<string, number> = {};
      const userIngredients: Record<string, number> = {};
      let allIngredientsMet = true;

      Object.entries(item.ingredients).forEach(([resName, reqAmount]) => {
        if (resName === 'coins') {
          ingredientStatus['coins'] = {
            required: reqAmount,
            available: projectCoins,
            met: projectCoins >= reqAmount
          };
          if (projectCoins < reqAmount) allIngredientsMet = false;
        } else {
          const avail = Number(inventory[resName] ?? 0);
          const met = avail >= reqAmount;
          ingredientsOnly[resName] = reqAmount;
          userIngredients[resName] = avail;
          ingredientStatus[resName] = {
            required: reqAmount,
            available: avail,
            met
          };
          if (!met) allIngredientsMet = false;
        }
      });

      const canBuild = !isPurchased && levelMet && coinsMet && allIngredientsMet;

      const cleanImage = (item.buildingImage || item.mapImage || `${item.name}.png`).replace(/\.png$/i, '');

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        coins: reqCoins,
        ingredients: ingredientsOnly,
        userIngredients,
        requiredLevel: item.level,
        bumpkinLevel: projectLevel,
        userCoins: projectCoins,
        isPurchased,
        canBuild,
        width: item.w,
        height: item.h,
        image: cleanImage,
        categoryImage: item.categoryImage ? item.categoryImage.replace(/\.png$/i, '') : undefined,
        shopImage: item.shopImage ? item.shopImage.replace(/\.png$/i, '') : undefined,
        mapImage: item.mapImage,
        // Поля сумісності зі старими назвами
        w: item.w,
        h: item.h,
        level: item.level,
        buildingImage: item.buildingImage,
        totalOwned,
        levelMet,
        coinsMet,
        projectCoins,
        projectLevel,
        ingredientStatus
      };
    });

    // Сортуємо: доступні/некуплені зверху, куплені — сірі та внизу
    statusItems.sort((a, b) => {
      if (a.isPurchased && !b.isPurchased) return 1;
      if (!a.isPurchased && b.isPurchased) return -1;
      if (a.canBuild && !b.canBuild) return -1;
      if (!a.canBuild && b.canBuild) return 1;
      return (a.requiredLevel || a.level) - (b.requiredLevel || b.level);
    });

    res.json({
      success: true,
      projectName,
      bumpkinLevel: projectLevel,
      coins: projectCoins,
      buildings: statusItems,
      // Дублюємо поля для зворотної сумісності
      projectCoins,
      projectLevel,
      items: statusItems
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
