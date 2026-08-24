import { NodeHandlerParams } from './types';
import { BAKERY_RECIPES } from '../plugins/sunflower-land/data/recipes';
import { recipeImagesConfig } from '../recipeImagesConfig';
import path from 'path';
import fs from 'fs';

interface BakeryRule {
  recipeName: string;
  enabled: boolean;
  maxDish: number;
  ingMultipliers: Record<string, number>;
}

export const bakeryNodeHandler = async ({
  currentNode, context, logToClient, activePage, projectName
}: NodeHandlerParams) => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const rules: BakeryRule[] = Array.isArray(nodeData.rules) ? nodeData.rules as BakeryRule[] : [];

  const enabledRules = rules.filter(r => r.enabled);

  if (enabledRules.length === 0) {
    logToClient(`⚠️ Bakery: Усі страви вимкнені (або список порожній). Передаю сигнал "Пропустити".`, 'info');
    return { data: context, nextHandle: ['skip'] };
  }

  // Зчитуємо інвентар з файлу _save.json
  const saveFilePath = path.join(__dirname, '../../projects', `${projectName}_save.json`);
  let inventory: Record<string, unknown> = {};

  try {
    if (fs.existsSync(saveFilePath)) {
      const rawData = fs.readFileSync(saveFilePath, 'utf-8');
      const apiDataObj = JSON.parse(rawData);
      const visitorFarmState = apiDataObj.visitorFarmState as Record<string, unknown> | undefined;
      const visitedFarmState = apiDataObj.visitedFarmState as Record<string, unknown> | undefined;
      inventory = (visitorFarmState?.inventory as Record<string, unknown>) || (visitedFarmState?.inventory as Record<string, unknown>) || {};
    } else {
      logToClient(`❌ Bakery: Файл збереження ${projectName}_save.json не знайдено`, 'error');
      return { data: { ...context, error: 'No save file found' }, nextHandle: ['skip'] };
    }
  } catch (err: any) {
    logToClient(`❌ Bakery: Помилка читання файлу збереження: ${err.message}`, 'error');
    return { data: { ...context, error: err.message }, nextHandle: ['skip'] };
  }

  // Завантажуємо глобальні назви зображень для Bakery
  const bakeryImages = recipeImagesConfig.getBakery();

  // Проходимо по всіх УВІМКНЕНИХ правилах по черзі
  for (const rule of enabledRules) {
    const { recipeName, maxDish, ingMultipliers } = rule;
    const recipeIngredients = BAKERY_RECIPES[recipeName];

    if (!recipeIngredients) {
      logToClient(`❌ Bakery: Невідома страва "${recipeName}" у списку`, 'error');
      continue;
    }

    const currentDishAmount = Number(inventory[recipeName] || 0);
    if (currentDishAmount >= maxDish) {
      logToClient(`ℹ️ Bakery: [${recipeName}] вже є ${currentDishAmount} шт. (Ліміт: ${maxDish}) -> Пропускаємо`, 'debug');
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
      logToClient(`ℹ️ Bakery: [${recipeName}] Не вистачає: ${missingLog.join(', ')} -> Пропускаємо`, 'debug');
      continue;
    }

    logToClient(`✅ Bakery: Умови для [${recipeName}] виконано! Готуємо.`, 'success');

    // Виконуємо клік по зображенню страви
    const imgName = bakeryImages[recipeName] || `${recipeName.replace(/ /g, '_').toLowerCase()}.webp`;
    if (activePage) {
      try {
        logToClient(`🖱️ Bakery: Клікаємо по зображенню "${imgName}" для [${recipeName}]`, 'info');
        const locator = activePage.locator(`img[src*="${imgName}"]`).first();
        await locator.click({ timeout: 5000 });
        await new Promise(r => setTimeout(r, 800));
      } catch (err: any) {
        logToClient(`❌ Bakery: Зображення "${imgName}" не знайдено для [${recipeName}]: ${err.message}`, 'error');
        return { data: { ...context, error: err.message }, nextHandle: ['skip'] };
      }
    }

    return { data: context, nextHandle: ['cook'] };
  }

  logToClient(`ℹ️ Bakery: Жодна увімкнена страва не підійшла.`, 'info');
  return { data: context, nextHandle: ['skip'] };
};
