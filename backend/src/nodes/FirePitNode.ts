import { NodeHandlerParams } from './types';
import { Logger } from '../logger';

const logger = new Logger('FirePitNode');

// Повний словник страв з їхніми базовими інгредієнтами (виправлено)
const RECIPES_DATA: Record<string, Record<string, number>> = {
  "Furikake Sprinkle": { "Fish Flake": 1, "Seaweed": 1 },
  "Mashed Potato": { "Potato": 8 },
  "Pumpkin Soup": { "Pumpkin": 10 },
  "Reindeer Carrot": { "Carrot": 5 },
  "Mushroom Soup": { "Wild Mushroom": 5 },
  "Popcorn": { "Sunflower": 100, "Corn": 5 },
  "Bumpkin Broth": { "Carrot": 10, "Cabbage": 5 },
  "Cabbers n Mash": { "Mashed Potato": 10, "Cabbage": 20 },
  "Boiled Eggs": { "Egg": 10 },
  "Kale Stew": { "Kale": 10 },
  "Kale Omelette": { "Egg": 40, "Kale": 5 },
  "Gumbo": { "Potato": 50, "Pumpkin": 30, "Carrot": 20, "Red Snapper": 3 },
  "Rapid Roast": { "Magic Mushroom": 1, "Pumpkin": 40 },
  "Fried Tofu": { "Soybean": 15, "Sunflower": 200 },
  "Rice Bun": { "Rice": 2, "Wheat": 50 },
  "Antipasto": { "Olive": 2, "Grape": 2 },
  "Pizza Margherita": { "Tomato": 30, "Cheese": 5, "Wheat": 20 },
  "Rhubarb Tart": { "Rhubarb": 3 }
};

interface FirePitRule {
  recipeName: string;
  enabled: boolean;
  maxDish: number;
  ingMultipliers: Record<string, number>;
  selector: string;
}

export const firePitNodeHandler = async ({
  currentNode, context, logToClient, activePage
}: NodeHandlerParams) => {
  const rules: FirePitRule[] = currentNode.data.rules || [];

  const enabledRules = rules.filter(r => r.enabled);

  if (enabledRules.length === 0) {
    logToClient(`⚠️ Fire Pit: Усі страви вимкнені (або список порожній). Передаю сигнал "Пропустити".`, 'info');
    return { data: context, nextHandle: ['skip'] };
  }

  // Отримуємо інвентар з API
  const apiData = context?.raw || context?.value;
  if (!apiData || typeof apiData !== 'object') {
    logToClient(`❌ Fire Pit: В контексті немає JSON даних від API`, 'error');
    return { data: { ...context, error: 'No API data found in context' }, nextHandle: ['skip'] };
  }

  const inventory = apiData?.visitorFarmState?.inventory || apiData?.visitedFarmState?.inventory || {};

  // Проходимо по всіх УВІМКНЕНИХ правилах по черзі
  for (const rule of enabledRules) {
    const { recipeName, maxDish, ingMultipliers, selector } = rule;
    const recipeIngredients = RECIPES_DATA[recipeName];

    if (!recipeIngredients) {
      logToClient(`❌ Fire Pit: Невідома страва "${recipeName}" у списку`, 'error');
      continue; // Йдемо до наступної страви
    }

    // 1. Перевіряємо кількість самої страви в інвентарі
    const currentDishAmount = Number(inventory[recipeName] || 0);
    if (currentDishAmount >= maxDish) {
      logToClient(`ℹ️ Fire Pit: [${recipeName}] вже є ${currentDishAmount} шт. (Ліміт: ${maxDish}) -> Пропускаємо`, 'debug');
      continue; // Йдемо до наступної страви
    }

    // 2. Перевіряємо наявність інгредієнтів (з індивідуальними множниками)
    let hasAllIngredients = true;
    const missingLog = [];

    for (const [ingName, baseQty] of Object.entries(recipeIngredients)) {
      const currentIngAmount = Number(inventory[ingName] || 0);
      const mult = ingMultipliers?.[ingName] ?? 1; // За замовчуванням множник 1
      const minRequired = baseQty * mult;

      if (currentIngAmount < minRequired) {
        hasAllIngredients = false;
        missingLog.push(`${ingName} (${currentIngAmount}/${minRequired})`);
      }
    }

    if (!hasAllIngredients) {
      logToClient(`ℹ️ Fire Pit: [${recipeName}] Не вистачає: ${missingLog.join(', ')} -> Пропускаємо`, 'debug');
      continue; // Йдемо до наступної страви
    }

    // Якщо ми дійшли сюди — умови виконані!
    logToClient(`✅ Fire Pit: Умови для [${recipeName}] виконано! Готуємо.`, 'success');

    // Виконуємо клік, якщо задано селектор
    if (selector && activePage) {
      try {
        logToClient(`🖱️ Fire Pit: Клікаємо по селектору ${selector}`, 'info');
        await activePage.click(selector, { timeout: 5000 });
        await activePage.waitForTimeout(1000); // Очікування на UI
      } catch (err: any) {
        logToClient(`❌ Fire Pit: Помилка кліку по ${selector}: ${err.message}`, 'error');
        // Можемо продовжити шукати іншу страву або одразу вийти?
        // Логічніше вийти, бо селектор скоріш за все не на екрані
        return { data: { ...context, error: err.message }, nextHandle: ['skip'] };
      }
    } else if (!selector) {
      logToClient(`⚠️ Fire Pit: Селектор не задано для [${recipeName}]`, 'info');
    }

    // Після першої успішної страви — зупиняємо цикл і йдемо на "Готувати"
    return { data: context, nextHandle: ['cook'] };
  }

  // Якщо цикл завершився і жодна страва не підійшла
  logToClient(`ℹ️ Fire Pit: Жодна увімкнена страва не підійшла.`, 'info');
  return { data: context, nextHandle: ['skip'] };
};
