import { NodeHandlerParams } from './types';
import { Logger } from '../logger';

const logger = new Logger('KitchenNode');

export const KITCHEN_RECIPES_DATA: Record<string, Record<string, number>> = {
  "Surimi Rice Bowl": { "Fish Stick": 1, "Rice": 1, "Onion": 1 },
  "Creamy Crab Bite": { "Crab Stick": 1, "Cheese": 3 },
  "Crimstone Infused Fish Oil": { "Fish Oil": 1, "Crimstone": 1 },
  "Sunflower Crunch": { "Sunflower": 300 },
  "Mushroom Jacket Potatoes": { "Wild Mushroom": 10, "Potato": 5 },
  "Fruit Salad": { "Apple": 1, "Orange": 1, "Blueberry": 1 },
  "Pancakes": { "Wheat": 10, "Egg": 10, "Honey": 6 },
  "Roast Veggies": { "Cauliflower": 15, "Carrot": 10 },
  "Cauliflower Burger": { "Cauliflower": 15, "Wheat": 5 },
  "Club Sandwich": { "Sunflower": 100, "Carrot": 25, "Wheat": 5 },
  "Bumpkin Salad": { "Beetroot": 20, "Parsnip": 10 },
  "Bumpkin ganoush": { "Eggplant": 30, "Potato": 50, "Parsnip": 10 },
  "Goblin's Treat": { "Pumpkin": 10, "Radish": 20, "Cabbage": 10 },
  "Chowder": { "Beetroot": 10, "Wheat": 10, "Parsnip": 5, "Anchovy": 3 },
  "Bumpkin Roast": { "Mashed Potato": 20, "Roast Veggies": 5 },
  "Goblin Brunch": { "Boiled Eggs": 5, "Goblin's Treat": 1 },
  "Beetroot Blaze": { "Magic Mushroom": 2, "Beetroot": 50 },
  "Steamed Red Rice": { "Rice": 3, "Beetroot": 50 },
  "Tofu Scramble": { "Soybean": 20, "Egg": 20, "Cauliflower": 10 },
  "Fried Calamari": { "Sunflower": 200, "Wheat": 15, "Squid": 1 },
  "Fish Burger": { "Beetroot": 10, "Wheat": 10, "Horse Mackerel": 1 },
  "Fish Omelette": { "Egg": 40, "Surgeonfish": 1, "Butterflyfish": 2 },
  "Ocean's Olive": { "Olive Flounder": 1, "Olive": 2 },
  "Seafood Basket": { "Blowfish": 2, "Napoleanfish": 2, "Sunfish": 2 },
  "Fish n Chips": { "Fancy Fries": 1, "Halibut": 1 },
  "Sushi Roll": { "Angelfish": 1, "Seaweed": 1, "Rice": 2 },
  "Caprese Salad": { "Cheese": 1, "Tomato": 25, "Kale": 20 },
  "Spaghetti al Limone": { "Wheat": 10, "Lemon": 15, "Cheese": 3 }
};

interface KitchenRule {
  recipeName: string;
  enabled: boolean;
  maxDish: number;
  ingMultipliers: Record<string, number>;
  selector: string;
}

export const kitchenNodeHandler = async ({
  currentNode, context, logToClient, activePage
}: NodeHandlerParams) => {
  const rules: KitchenRule[] = currentNode.data.rules || [];

  const enabledRules = rules.filter(r => r.enabled);

  if (enabledRules.length === 0) {
    logToClient(`⚠️ Kitchen: Усі страви вимкнені (або список порожній). Передаю сигнал "Пропустити".`, 'info');
    return { data: context, nextHandle: ['skip'] };
  }

  // Отримуємо інвентар з API
  const apiData = context?.raw || context?.value;
  if (!apiData || typeof apiData !== 'object') {
    logToClient(`❌ Kitchen: В контексті немає JSON даних від API`, 'error');
    return { data: { ...context, error: 'No API data found in context' }, nextHandle: ['skip'] };
  }

  const inventory = apiData?.visitorFarmState?.inventory || apiData?.visitedFarmState?.inventory || {};

  // Проходимо по всіх УВІМКНЕНИХ правилах по черзі
  for (const rule of enabledRules) {
    const { recipeName, maxDish, ingMultipliers, selector } = rule;
    const recipeIngredients = KITCHEN_RECIPES_DATA[recipeName];

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

    if (selector && activePage) {
      try {
        logToClient(`🖱️ Kitchen: Клікаємо по селектору ${selector}`, 'info');
        await activePage.click(selector, { timeout: 5000 });
        await activePage.waitForTimeout(1000);
      } catch (err: any) {
        logToClient(`❌ Kitchen: Помилка кліку по ${selector}: ${err.message}`, 'error');
        return { data: { ...context, error: err.message }, nextHandle: ['skip'] };
      }
    } else if (!selector) {
      logToClient(`⚠️ Kitchen: Селектор не задано для [${recipeName}]`, 'info');
    }

    return { data: context, nextHandle: ['cook'] };
  }

  logToClient(`ℹ️ Kitchen: Жодна увімкнена страва не підійшла.`, 'info');
  return { data: context, nextHandle: ['skip'] };
};
