import { NodeHandlerParams } from './types';
import path from 'path';
import fs from 'fs';

export interface FlowerRecipe {
  seed: string;
  resources: string[];
}

export const FLOWER_RECIPES: Record<string, FlowerRecipe> = {
  // Sunpetal Seed (1 день)
  "Red Pansy":    { seed: "Sunpetal Seed", resources: ["Radish", "Banana", "Red Cosmos", "Purple Daffodil", "Red Balloon Flower", "Red Lotus", "Primula Enigma"] },
  "Yellow Pansy": { seed: "Sunpetal Seed", resources: ["Sunflower", "Apple", "Red Pansy", "Red Daffodil", "Yellow Balloon Flower", "Yellow Carnation"] },
  "Purple Pansy": { seed: "Sunpetal Seed", resources: ["Blue Pansy", "Purple Balloon Flower", "Purple Carnation"] },
  "White Pansy":  { seed: "Sunpetal Seed", resources: ["Yellow Cosmos"] },
  "Blue Pansy":   { seed: "Sunpetal Seed", resources: ["Purple Cosmos", "White Pansy", "White Cosmos", "White Daffodil", "Blue Daffodil", "White Carnation"] },
  "Red Cosmos":   { seed: "Sunpetal Seed", resources: ["Yellow Daffodil", "Purple Lotus"] },
  "Yellow Cosmos":{ seed: "Sunpetal Seed", resources: ["Yellow Pansy", "White Balloon Flower", "Red Carnation"] },
  "Purple Cosmos":{ seed: "Sunpetal Seed", resources: ["Beetroot", "Eggplant", "Kale", "Blue Cosmos", "Blue Balloon Flower", "Celestial Frostbloom"] },
  "White Cosmos": { seed: "Sunpetal Seed", resources: ["Prism Petal", "Yellow Lotus"] },
  "Blue Cosmos":  { seed: "Sunpetal Seed", resources: ["Cauliflower", "Parsnip", "Blueberry", "Purple Pansy", "White Lotus", "Blue Carnation"] },
  "Prism Petal":  { seed: "Sunpetal Seed", resources: ["Blue Lotus"] },
  // Bloom Seed (2 дні)
  "Red Balloon Flower":    { seed: "Bloom Seed", resources: ["Sunflower", "Beetroot", "Apple", "Banana", "Purple Pansy", "Red Pansy", "Red Daffodil", "Yellow Daffodil", "Purple Daffodil", "Yellow Carnation"] },
  "Yellow Balloon Flower": { seed: "Bloom Seed", resources: ["Yellow Lotus"] },
  "Purple Balloon Flower": { seed: "Bloom Seed", resources: ["Blue Carnation"] },
  "White Balloon Flower":  { seed: "Bloom Seed", resources: ["White Cosmos", "Blue Daffodil", "White Daffodil", "White Balloon Flower"] },
  "Blue Balloon Flower":   { seed: "Bloom Seed", resources: ["Cauliflower", "Parsnip", "Eggplant", "Kale", "Blue Pansy", "Blue Cosmos", "Purple Cosmos", "Blue Balloon Flower", "Celestial Frostbloom"] },
  "Red Daffodil":    { seed: "Bloom Seed", resources: ["Yellow Pansy", "Yellow Balloon Flower", "Red Carnation", "Primula Enigma"] },
  "Yellow Daffodil": { seed: "Bloom Seed", resources: ["Red Cosmos", "White Carnation", "White Lotus"] },
  "Purple Daffodil": { seed: "Bloom Seed", resources: ["Radish", "Blueberry", "Red Balloon Flower", "Red Lotus", "Blue Lotus"] },
  "White Daffodil":  { seed: "Bloom Seed", resources: ["Yellow Cosmos", "Prism Petal"] },
  "Blue Daffodil":   { seed: "Bloom Seed", resources: ["Purple Balloon Flower", "Purple Carnation", "Purple Lotus"] },
  "Celestial Frostbloom": { seed: "Bloom Seed", resources: ["White Pansy"] },
  // Sprout Mix (5 днів)
  "Red Carnation":    { seed: "Sprout Mix", resources: ["Yellow Cosmos", "Red Balloon Flower", "Yellow Lotus"] },
  "Yellow Carnation": { seed: "Sprout Mix", resources: ["Yellow Pansy", "Red Balloon Flower", "Yellow Carnation"] },
  "Purple Carnation": { seed: "Sprout Mix", resources: ["Blue Pansy", "Purple Balloon Flower"] },
  "White Carnation":  { seed: "Sprout Mix", resources: ["Blue Pansy", "White Balloon Flower", "White Lotus", "White Daffodil"] },
  "Blue Carnation":   { seed: "Sprout Mix", resources: ["Purple Cosmos", "Purple Balloon Flower", "Blue Carnation"] },
  "Red Lotus":    { seed: "Sprout Mix", resources: ["Red Pansy", "Red Daffodil", "Red Lotus"] },
  "Yellow Lotus": { seed: "Sprout Mix", resources: ["Red Pansy", "Yellow Lotus"] },
  "Purple Lotus": { seed: "Sprout Mix", resources: ["Red Cosmos", "Purple Daffodil", "Purple Lotus"] },
  "White Lotus":  { seed: "Sprout Mix", resources: ["Yellow Daffodil", "White Lotus"] },
  "Blue Lotus":   { seed: "Sprout Mix", resources: ["Blue Pansy", "Blue Cosmos", "Blue Lotus", "Prism Petal"] },
  "Primula Enigma": { seed: "Sprout Mix", resources: ["Red Pansy", "Red Daffodil"] },
};

export interface FlowerResource {
  resourceName: string;
  enabled: boolean;
  selector: string;
  multiplier: number;
}

export interface FlowerRule {
  flowerName: string;
  seed: string;
  enabled: boolean;
  seedSelector: string;
  seedMultiplier: number;
  resources: FlowerResource[];
}

export const flowerPlanterNodeHandler = async ({
  currentNode, context, logToClient, activePage, projectName
}: NodeHandlerParams) => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const rules: FlowerRule[] = nodeData.rules as FlowerRule[] || [];
  const selectors: Record<string, string> = nodeData.selectors as Record<string, string> || {};
  const enabledRules = rules.filter(r => r.enabled);
  if (enabledRules.length === 0) {
    logToClient('Квітник: Жодна квітка не увімкнена -> Пропускаємо.', 'info');
    return { data: context, nextHandle: ['skip'] };
  }
  const saveFilePath = path.join(__dirname, '../../projects', `${projectName}_save.json`);
  let inventory: Record<string, unknown> = {};
  let flowers: Record<string, unknown> = {};
  try {
    if (fs.existsSync(saveFilePath)) {
      const rawData = fs.readFileSync(saveFilePath, 'utf-8');
      const apiDataObj = JSON.parse(rawData);
      const farmState = apiDataObj.visitorFarmState ?? apiDataObj.visitedFarmState ?? apiDataObj ?? {};
      inventory = (farmState.inventory as Record<string, unknown>) ?? {};
      flowers   = (farmState.flowers   as Record<string, unknown>) ?? {};
    } else {
      logToClient(`Квітник: Файл ${projectName}_save.json не знайдено`, 'error');
      return { data: { ...context, error: 'No save file found' }, nextHandle: ['skip'] };
    }
  } catch (err: any) {
    logToClient(`Квітник: Помилка читання файлу: ${err.message}`, 'error');
    return { data: { ...context, error: err.message }, nextHandle: ['skip'] };
  }
  const getQty = (name: string): number => Number(inventory[name] ?? flowers[name] ?? 0);
  interface Candidate { rule: FlowerRule; chosenResource: FlowerResource; flowerQty: number; }
  const candidates: Candidate[] = [];
  for (const rule of enabledRules) {
    const { flowerName, seedMultiplier, resources } = rule;
    const seedName = FLOWER_RECIPES[flowerName]?.seed;
    if (!seedName) continue;
    const seedQty = getQty(seedName);
    const seedNeeded = Math.max(1, seedMultiplier ?? 1);
    if (seedQty < seedNeeded) {
      logToClient(`Квітник: [${flowerName}] Насіння "${seedName}" ${seedQty}/${seedNeeded} - не вистачає`, 'debug');
      continue;
    }
    const seedSelector = selectors[seedName];
    if (!seedSelector) {
      logToClient(`Квітник: [${flowerName}] Не вказано глобальний селектор насіння "${seedName}"`, 'info');
      continue;
    }
    const enabledResources = resources.filter(r => r.enabled && selectors[r.resourceName]);
    let chosenResource: FlowerResource | null = null;
    for (const res of enabledResources) {
      const qty = getQty(res.resourceName);
      const needed = Math.max(1, res.multiplier ?? 1);
      if (qty >= needed) { chosenResource = res; break; }
      logToClient(`Квітник: [${flowerName}] Ресурс "${res.resourceName}" ${qty}/${needed} - не вистачає`, 'debug');
    }
    if (!chosenResource) {
      logToClient(`Квітник: [${flowerName}] Жоден ресурс не підходить -> пропускаємо`, 'debug');
      continue;
    }
    candidates.push({ rule, chosenResource, flowerQty: getQty(flowerName) });
  }
  if (candidates.length === 0) {
    logToClient('Квітник: Жодна квітка не підходить -> Пропускаємо', 'info');
    return { data: context, nextHandle: ['skip'] };
  }
  candidates.sort((a, b) => a.flowerQty - b.flowerQty);
  const { rule: chosen, chosenResource } = candidates[0];
  logToClient(`Квітник: Обрано [${chosen.flowerName}] (в инв: ${candidates[0].flowerQty}) + ресурс "${chosenResource.resourceName}"`, 'success');
  if (!activePage) {
    logToClient('Квітник: Браузер не підключено', 'error');
    return { data: { ...context, error: 'No active page' }, nextHandle: ['skip'] };
  }
  try {
    const seedSel = selectors[FLOWER_RECIPES[chosen.flowerName]?.seed || ''];
    logToClient(`Клик 1: Насіння -> "${seedSel}"`, 'info');
    const seedLoc = activePage.locator(seedSel).first();
    await seedLoc.click({ force: true, timeout: 5000 });
    await activePage.waitForTimeout(800);
  } catch (err: any) {
    logToClient(`Квітник: Помилка кліку по насінню: ${err.message}`, 'error');
    return { data: { ...context, error: err.message }, nextHandle: ['skip'] };
  }
  try {
    const resSel = selectors[chosenResource.resourceName];
    logToClient(`Клик 2: Ресурс -> "${resSel}"`, 'info');
    const resLoc = activePage.locator(resSel).first();
    await resLoc.click({ force: true, timeout: 5000 });
    await activePage.waitForTimeout(500);
  } catch (err: any) {
    logToClient(`Квітник: Помилка кліку по ресурсу: ${err.message}`, 'error');
    return { data: { ...context, error: err.message }, nextHandle: ['skip'] };
  }
  return {
    data: { ...context, chosenFlower: chosen.flowerName, chosenResource: chosenResource.resourceName },
    nextHandle: ['plant']
  };
};
