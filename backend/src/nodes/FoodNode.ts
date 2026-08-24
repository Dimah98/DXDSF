import { NodeHandlerParams } from './types';
import { recipeImagesConfig } from '../recipeImagesConfig';

export const foodNodeHandler = async ({
  currentNode, context, logToClient, activePage
}: NodeHandlerParams) => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const eatButtonSelector = (nodeData.eatButtonSelector as string) || '';

  // Отримуємо налаштування їжі з глобальної конфігурації
  const foodSettings = recipeImagesConfig.getFood();

  // Фільтруємо тільки увімкнені предмети з заповненим imageName
  const enabledItems = Object.entries(foodSettings).filter(
    ([, settings]) => settings.enabled && settings.imageName?.trim()
  );

  if (enabledItems.length === 0) {
    logToClient(`⚠️ Їжа: Жодного увімкненого предмету їжі не знайдено в налаштуваннях.`, 'info');
    return { data: context, nextHandle: ['skip'] };
  }

  if (!eatButtonSelector.trim()) {
    logToClient(`❌ Їжа: Не вказано CSS-селектор кнопки "з'їсти".`, 'error');
    return { data: context, nextHandle: ['skip'] };
  }

  if (!activePage) {
    logToClient(`❌ Їжа: Немає активної сторінки браузера.`, 'error');
    return { data: context, nextHandle: ['skip'] };
  }

  let ateCount = 0;

  for (const [itemName, settings] of enabledItems) {
    const imageName = settings.imageName.trim();
    logToClient(`🍽️ Їжа: Шукаю предмет "${itemName}" (зображення: "${imageName}")`, 'info');

    try {
      // Шукаємо зображення предмету на сторінці
      const imgLocator = activePage.locator(`img[src*="${imageName}"]`);
      const count = await imgLocator.count();

      if (count === 0) {
        logToClient(`ℹ️ Їжа: Зображення "${imageName}" не знайдено на сторінці — пропускаємо.`, 'debug');
        continue;
      }

      // Клікаємо ТІЛЬКИ по останньому зображенню з усіх знайдених
      try {
        logToClient(`🖱️ Їжа: Клік по зображенню "${imageName}" (останнє в списку з ${count})`, 'info');
        await imgLocator.last().click({ timeout: 5000 });
        await new Promise(r => setTimeout(r, 500));

        // Клікаємо по кнопці "з'їсти"
        const eatBtn = activePage.locator(eatButtonSelector).first();
        const btnVisible = await eatBtn.isVisible().catch(() => false);

        if (btnVisible) {
          logToClient(`🖱️ Їжа: Клік по кнопці з'їсти ("${eatButtonSelector}")`, 'info');
          await eatBtn.click({ timeout: 5000 });
          await new Promise(r => setTimeout(r, 500));
          ateCount++;
          logToClient(`✅ Їжа: Предмет "${itemName}" з'їдено`, 'success');
        } else {
          logToClient(`⚠️ Їжа: Кнопка з'їсти не знайдена після кліку по "${itemName}"`, 'info');
        }
      } catch (err: any) {
        logToClient(`❌ Їжа: Помилка при обробці "${itemName}": ${err.message}`, 'error');
      }
    } catch (err: any) {
      logToClient(`❌ Їжа: Помилка при обробці "${itemName}": ${err.message}`, 'error');
    }
  }

  if (ateCount > 0) {
    logToClient(`✅ Їжа: Всього з'їдено ${ateCount} одиниць їжі.`, 'success');
    return { data: context, nextHandle: ['success'] };
  } else {
    logToClient(`ℹ️ Їжа: Жодного предмету не вдалося з'їсти.`, 'info');
    return { data: context, nextHandle: ['skip'] };
  }
};
