import { NodeHandlerParams } from './types';
import { FIRE_PIT_RECIPES } from '../plugins/sunflower-land/data/recipes';
import { recipeImagesConfig } from '../recipeImagesConfig';
import { getProjectInventory } from '../utils/saveStorage';

interface FirePitRule {
  recipeName: string;
  enabled: boolean;
  maxDish: number;
  ingMultipliers: Record<string, number>;
}

export const firePitNodeHandler = async ({
  currentNode, context, logToClient, activePage, projectName
}: NodeHandlerParams) => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const rules: FirePitRule[] = Array.isArray(nodeData.rules) ? nodeData.rules as FirePitRule[] : [];

  const enabledRules = rules.filter(r => r.enabled);

  if (enabledRules.length === 0) {
    logToClient(`⚠️ Fire Pit: Усі страви вимкнені (або список порожній). Передаю сигнал "Пропустити".`, 'info');
    return { data: context, nextHandle: ['skip'] };
  }

  // Зчитуємо інвентар з швидкого SQLite сховища
  let inventory: Record<string, unknown> = {};
  try {
    inventory = await getProjectInventory(projectName);
  } catch (err: any) {
    logToClient(`❌ Fire Pit: Помилка читання інвентарю: ${err.message}`, 'error');
    return { data: { ...context, error: err.message }, nextHandle: ['skip'] };
  }

  if (Object.keys(inventory).length === 0) {
    logToClient(`❌ Fire Pit: Дані інвентарю для ${projectName} порожні або не знайдені`, 'error');
    return { data: { ...context, error: 'No inventory data found' }, nextHandle: ['skip'] };
  }

  // Завантажуємо глобальні назви зображень для Fire Pit
  const firePitImages = recipeImagesConfig.getFirePit();

  // Проходимо по всіх УВІМКНЕНИХ правилах по черзі
  for (const rule of enabledRules) {
    const { recipeName, maxDish, ingMultipliers } = rule;
    const recipeIngredients = FIRE_PIT_RECIPES[recipeName];

    if (!recipeIngredients) {
      logToClient(`❌ Fire Pit: Невідома страва "${recipeName}" у списку`, 'error');
      continue;
    }

    // 1. Перевіряємо кількість самої страви в інвентарі
    const currentDishAmount = Number(inventory[recipeName] || 0);
    if (currentDishAmount >= maxDish) {
      logToClient(`ℹ️ Fire Pit: [${recipeName}] вже є ${currentDishAmount} шт. (Ліміт: ${maxDish}) -> Пропускаємо`, 'debug');
      continue;
    }

    // 2. Перевіряємо наявність інгредієнтів (з індивідуальними множниками)
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
      logToClient(`ℹ️ Fire Pit: [${recipeName}] Не вистачає: ${missingLog.join(', ')} -> Пропускаємо`, 'debug');
      continue;
    }

    // Якщо ми дійшли сюди — умови виконані!
    logToClient(`✅ Fire Pit: Умови для [${recipeName}] виконано! Готуємо.`, 'success');

    // Виконуємо клік по зображенню страви
    const imgName = firePitImages[recipeName];
    if (imgName && activePage) {
      try {
        logToClient(`🖱️ Fire Pit: Клікаємо по зображенню "${imgName}" для [${recipeName}]`, 'info');
        // Шукаємо <img> або елемент з src/background що містить назву файлу
        const locator = activePage.locator(`img[src*="${imgName}"]`).last();
        await locator.click({ timeout: 5000 });
        await new Promise(r => setTimeout(r, 800));
      } catch (err: any) {
        logToClient(`❌ Fire Pit: Зображення "${imgName}" не знайдено для [${recipeName}]: ${err.message}`, 'error');
        return { data: { ...context, error: err.message }, nextHandle: ['skip'] };
      }
    } else if (!imgName) {
      logToClient(`⚠️ Fire Pit: Зображення не задано для [${recipeName}] у глобальних налаштуваннях`, 'info');
      // Продовжуємо без кліку — node передає сигнал "cook"
    }

    // Після першої успішної страви — зупиняємо цикл і йдемо на "Готувати"
    return { data: context, nextHandle: ['cook'] };
  }

  // Якщо цикл завершився і жодна страва не підійшла
  logToClient(`ℹ️ Fire Pit: Жодна увімкнена страва не підійшла.`, 'info');
  return { data: context, nextHandle: ['skip'] };
};
