import { NodeHandlerParams } from './types';
import { SMOOTHIE_SHACK_RECIPES } from '../plugins/sunflower-land/data/recipes';
import { recipeImagesConfig } from '../recipeImagesConfig';
import { PROJECTS_DIR } from '../constants';
import path from 'path';
import fs from 'fs';

interface SmoothieShackRule {
  recipeName: string;
  enabled: boolean;
  maxDish: number;
  ingMultipliers: Record<string, number>;
}

export const smoothieShackNodeHandler = async ({
  currentNode, context, logToClient, activePage, projectName
}: NodeHandlerParams) => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const rules: SmoothieShackRule[] = Array.isArray(nodeData.rules) ? nodeData.rules as SmoothieShackRule[] : [];

  const enabledRules = rules.filter(r => r.enabled);

  if (enabledRules.length === 0) {
    logToClient(`⚠️ Smoothie Shack: Усі страви вимкнені (або список порожній). Передаю сигнал "Пропустити".`, 'info');
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
      logToClient(`❌ Smoothie Shack: Файл збереження ${projectName}_save.json не знайдено`, 'error');
      return { data: { ...context, error: 'No save file found' }, nextHandle: ['skip'] };
    }
    logToClient(`❌ Smoothie Shack: Помилка читання файлу збереження: ${err.message}`, 'error');
    return { data: { ...context, error: err.message }, nextHandle: ['skip'] };
  }

  // Завантажуємо глобальні назви зображень для Smoothie Shack
  const smoothieShackImages = recipeImagesConfig.getSmoothieShack();

  // Проходимо по всіх УВІМКНЕНИХ правилах по черзі
  for (const rule of enabledRules) {
    const { recipeName, maxDish, ingMultipliers } = rule;
    const recipeIngredients = SMOOTHIE_SHACK_RECIPES[recipeName];

    if (!recipeIngredients) {
      logToClient(`❌ Smoothie Shack: Невідома страва "${recipeName}" у списку`, 'error');
      continue;
    }

    const currentDishAmount = Number(inventory[recipeName] || 0);
    if (currentDishAmount >= maxDish) {
      logToClient(`ℹ️ Smoothie Shack: [${recipeName}] вже є ${currentDishAmount} шт. (Ліміт: ${maxDish}) -> Пропускаємо`, 'debug');
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
      logToClient(`ℹ️ Smoothie Shack: [${recipeName}] Не вистачає: ${missingLog.join(', ')} -> Пропускаємо`, 'debug');
      continue;
    }

    logToClient(`✅ Smoothie Shack: Умови для [${recipeName}] виконано! Готуємо.`, 'success');

    // Виконуємо клік по зображенню страви
    const imgName = smoothieShackImages[recipeName] || `${recipeName.replace(/ /g, '_').toLowerCase()}.webp`;
    if (activePage) {
      try {
        logToClient(`🖱️ Smoothie Shack: Клікаємо по зображенню "${imgName}" для [${recipeName}]`, 'info');
        const locator = activePage.locator(`img[src*="${imgName}"]`).first();
        await locator.click({ timeout: 5000 });
        await new Promise(r => setTimeout(r, 800));
      } catch (err: any) {
        logToClient(`❌ Smoothie Shack: Зображення "${imgName}" не знайдено для [${recipeName}]: ${err.message}`, 'error');
        return { data: { ...context, error: err.message }, nextHandle: ['skip'] };
      }
    }

    return { data: context, nextHandle: ['cook'] };
  }

  logToClient(`ℹ️ Smoothie Shack: Жодна увімкнена страва не підійшла.`, 'info');
  return { data: context, nextHandle: ['skip'] };
};
