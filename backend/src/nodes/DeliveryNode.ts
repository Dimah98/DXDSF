import { NodeHandlerParams } from './types';

interface DeliveryConfig {
  name?: string;
  image: string;
  enabled: boolean;
}

export const deliveryNodeHandler = async ({
  currentNode, context, logToClient, activePage, smartSleep, ws,
  globalVariables, broadcastVariables, nodeTitle, takeDebugSnapshot
}: NodeHandlerParams) => {
  const {
    deliveries = [],
    step2Selector = '',
    step3Selector = '',
  } = currentNode.data as {
    deliveries?: DeliveryConfig[];
    step2Selector?: string;
    step3Selector?: string;
  };

  try {
    // Читаємо відмічені доставки з globalVariables проекту
    const markedDeliveries = new Set<string>();
    const MARKED_KEY = '__markedDeliveries';

    const legacyList = globalVariables?.[MARKED_KEY];
    if (Array.isArray(legacyList)) {
      legacyList.forEach((item: string) => markedDeliveries.add(item));
    }

    if (markedDeliveries.size === 0) {
      logToClient(`✅ Немає відмічених доставок — пропускаємо.`, 'success');
      return { data: context, nextHandle: ['no_deliveries'] };
    }

    logToClient(`📦 Знайдено ${markedDeliveries.size} відмічених доставок: ${Array.from(markedDeliveries).join(', ')}`, 'info');

    // Перевіряємо ввімкнені доставки з конфігурації
    const enabledDeliveries = (deliveries as DeliveryConfig[]).filter(d => d.enabled && (d.image || d.name));

    // Функція перевірки чи відмічена конкретна доставка
    const isMarked = (d: DeliveryConfig): boolean => {
      const nameKey = d.name?.trim().toLowerCase();
      const imageKey = d.image?.trim().toLowerCase();
      const imageWithoutExt = imageKey ? imageKey.replace(/\.[^/.]+$/, "") : "";

      for (const marked of markedDeliveries) {
        const lowerMarked = marked.toLowerCase();
        if (nameKey && lowerMarked === nameKey) return true;
        if (imageKey && lowerMarked === imageKey) return true;
        if (imageWithoutExt && lowerMarked === imageWithoutExt) return true;
        if (nameKey && lowerMarked === nameKey + '.png') return true;
      }
      return false;
    };

    const toProcess = enabledDeliveries.filter(isMarked);

    if (toProcess.length === 0) {
      logToClient(`⚠️ Відмічені доставки не відповідають жодному запису в конфігурації ноди.`, 'info');
      return { data: context, nextHandle: ['no_deliveries'] };
    }

    logToClient(`🎯 Буду обробляти ${toProcess.length} доставок.`, 'info');
    await takeDebugSnapshot(currentNode.id, nodeTitle || 'Доставки');

    for (const delivery of toProcess) {
      const deliveryName = (delivery.name || delivery.image || '').trim();
      const deliveryImage = (delivery.image || delivery.name || '').trim();

      logToClient(`🖱️ Обробляю доставку: "${deliveryName}" (зображення: "${deliveryImage}")`, 'info');

      try {
        // Крок 1: клік на зображення доставки
        const imgSelector = `img[src*="${deliveryImage}"]`;
        await takeDebugSnapshot(currentNode.id, nodeTitle || 'Доставки', { selector: imgSelector });
        try {
          await activePage.click(imgSelector, { timeout: 5000, force: true });
        } catch (e1) {
          const clicked = await activePage.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const target = el.closest('button') || el.closest('div') || (el as HTMLElement);
            target.click();
            return true;
          }, imgSelector);
          if (!clicked) throw e1;
        }
        await smartSleep(800, ws);

        // Крок 2: клік Deliver (якщо передано)
        if (step2Selector) {
          await takeDebugSnapshot(currentNode.id, nodeTitle || 'Доставки', { selector: step2Selector });
          try {
            await activePage.click(step2Selector, { timeout: 3000, force: true });
          } catch (e2) {
            const clicked = await activePage.evaluate((sel) => {
              const el = document.querySelector(sel);
              if (!el) return false;
              (el as HTMLElement).click();
              return true;
            }, step2Selector);
            if (!clicked) throw e2;
          }
          await smartSleep(1000, ws);
        }

        let step3Clicked = false;
        // Крок 3: клік Skip/Close (якщо передано)
        if (step3Selector) {
          await takeDebugSnapshot(currentNode.id, nodeTitle || 'Доставки', { selector: step3Selector });
          try {
            await activePage.click(step3Selector, { timeout: 3000, force: true });
            step3Clicked = true;
          } catch (e3) {
            step3Clicked = await activePage.evaluate((sel) => {
              const el = document.querySelector(sel);
              if (el) {
                (el as HTMLElement).click();
                return true;
              }
              return false;
            }, step3Selector);
          }
          await smartSleep(1000, ws);
        }

        if (globalVariables && step3Selector && step3Clicked) {
          // Крок 4: зняти мітку
            const legacyArr = globalVariables[MARKED_KEY];
            if (Array.isArray(legacyArr)) {
              const lowerName = deliveryName.trim().toLowerCase();
              const lowerImage = deliveryImage.trim().toLowerCase();
              const lowerImageNoExt = lowerImage.replace(/\.[^/.]+$/, "");
              globalVariables[MARKED_KEY] = legacyArr.filter((item: string) => {
                const lowerItem = item.trim().toLowerCase();
                return lowerItem !== lowerName && 
                       lowerItem !== lowerImage && 
                       lowerItem !== lowerImageNoExt &&
                       lowerItem !== `${lowerName}.png`;
              });
            }

          // Очищаємо всі можливі сигнатури
          const varsToRemove = [
            `__markedItems_${deliveryName}`,
            `__markedItems_${deliveryImage}`,
            `__markedItems_${deliveryName.toLowerCase()}`,
            `__markedItems_${deliveryImage.toLowerCase()}`,
            `__markedItems_${deliveryName}.png`,
            `__markedItems_${deliveryName.toLowerCase()}.png`,
            `__markedItems_${deliveryImage}.png`,
            `__markedItems_${deliveryImage.toLowerCase()}.png`
          ];

          for (const v of varsToRemove) {
            delete globalVariables[v];
          }

          broadcastVariables?.();
          logToClient(`✅ Доставка "${deliveryName}" успішно оброблена і мітка знята.`, 'success');
        } else {
          logToClient(`✅ Доставка "${deliveryName}" оброблена (мітка збережена, крок 3 пропущено або не знайдено).`, 'success');
        }
        
        await takeDebugSnapshot(currentNode.id, nodeTitle || 'Доставки');

      } catch (err: any) {
        logToClient(`⚠️ Помилка обробки доставки "${deliveryName}": ${err.message}`, 'info');
        await takeDebugSnapshot(currentNode.id, nodeTitle || 'Доставки');
      }
    }

    logToClient(`✅ Обробку доставок завершено.`, 'success');
    return { data: context, nextHandle: ['success'] };

  } catch (e: any) {
    logToClient(`❌ Помилка в ноді Доставки: ${e.message}`, 'error');
    return { data: { ...context, error: e.message }, nextHandle: ['error'] };
  }
};
