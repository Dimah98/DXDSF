import { NodeHandlerParams } from './types';
import { KITCHEN_RECIPES } from '../plugins/sunflower-land/data/recipes';
import { recipeImagesConfig } from '../recipeImagesConfig';
import { PROJECTS_DIR } from '../constants';
import path from 'path';
import fs from 'fs';

interface KitchenRule {
  recipeName: string;
  enabled: boolean;
  maxDish: number;
  ingMultipliers: Record<string, number>;
}

export const kitchenNodeHandler = async ({
  currentNode, context, logToClient, activePage, projectName
}: NodeHandlerParams) => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const rules: KitchenRule[] = Array.isArray(nodeData.rules) ? nodeData.rules as KitchenRule[] : [];

  const enabledRules = rules.filter(r => r.enabled);

  if (enabledRules.length === 0) {
    logToClient(`⚠️ Kitchen: Усі страви вимкнені (або список порожній). Передаю сигнал "Пропустити".`, 'info');
    return { data: context, nextHandle: ['skip'] };
  }

  // Зчитуємо інвентар з файлу _save.json
  const saveFilePath = path.join(PROJECTS_DIR, `${projectName}_save.json`);
  let inventory: Record<string, unknown> = {};

  try {
    const rawData = await fs.promises.readFile(saveFilePath, 'utf-8');
    const apiDataObj = JSON.parse(rawData);
    const visitorFarmState = apiDataObj.visitorFarmState as Record<string, unknown> | undefined;
    const visitedFarmState = apiDataObj.visitedFarmState as Record<string, unknown> | undefined;
    inventory = (visitorFarmState?.inventory as Record<string, unknown>) || (visitedFarmState?.inventory as Record<string, unknown>) || {};
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      logToClient(`❌ Kitchen: Файл збереження ${projectName}_save.json не знайдено`, 'error');
      return { data: { ...context, error: 'No save file found' }, nextHandle: ['skip'] };
    }
    logToClient(`❌ Kitchen: Помилка читання файлу збереження: ${err.message}`, 'error');
    return { data: { ...context, error: err.message }, nextHandle: ['skip'] };
  }

  // Завантажуємо глобальні назви зображень для Kitchen
  const kitchenImages = recipeImagesConfig.getKitchen();

  // Проходимо по всіх УВІМКНЕНИХ правилах по черзі
  for (const rule of enabledRules) {
    const { recipeName, maxDish, ingMultipliers } = rule;
    const recipeIngredients = KITCHEN_RECIPES[recipeName];

    if (!recipeIngredients) {
      logToClient(`❌ Kitchen: Невідома страва "${recipeName}" у списку`, 'error');
      continue;
    }

    const currentDishAmount = Number(inventory[recipeName] || 0);
    if (currentDishAmount >= maxDish) {
      logToClient(`ℹ️ Kitchen: [${recipeName}] вже є ${currentDishAmount} шт. (Ліміт: ${maxDish}) -> Пропускаємо`, 'debug');
      continue;
    }

    let hasAllIngredients = true;
    const missingLog = [];

    for (const [ingName, baseQty] of Object.entries(recipeIngredients)) {
      const currentIngAmount = Number(inventory[ingName] || 0);
      const mult = ingMultipliers?.[ingName] ?? 1;
      const minRequired = baseQty * mult;

      if (currentIngAmount < minRequired) {
        hasAllIngredients = false;
        missingLog.push(`${ingName} (${currentIngAmount}/${minRequired})`);
      }
    }

    if (!hasAllIngredients) {
      logToClient(`ℹ️ Kitchen: [${recipeName}] Не вистачає: ${missingLog.join(', ')} -> Пропускаємо`, 'debug');
      continue;
    }

    logToClient(`✅ Kitchen: Умови для [${recipeName}] виконано! Готуємо.`, 'success');

    // Виконуємо клік по зображенню страви
    const imgName = kitchenImages[recipeName];
    if (imgName && activePage) {
      try {
        logToClient(`🖱️ Kitchen: Клікаємо по зображенню "${imgName}" для [${recipeName}]`, 'info');
        const locator = activePage.locator(`img[src*="${imgName}"]`).first();
        await locator.click({ timeout: 5000 });
        await new Promise(r => setTimeout(r, 800));
      } catch (err: any) {
        logToClient(`❌ Kitchen: Зображення "${imgName}" не знайдено для [${recipeName}]: ${err.message}`, 'error');
        return { data: { ...context, error: err.message }, nextHandle: ['skip'] };
      }
    } else if (!imgName) {
      logToClient(`⚠️ Kitchen: Зображення не задано для [${recipeName}] у глобальних налаштуваннях`, 'info');
      // Продовжуємо без кліку — node передає сигнал "cook"
    }

    return { data: context, nextHandle: ['cook'] };
  }

  logToClient(`ℹ️ Kitchen: Жодна увімкнена страва не підійшла.`, 'info');
  return { data: context, nextHandle: ['skip'] };
};
