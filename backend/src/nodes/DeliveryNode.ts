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
    // Допоміжна нормалізація імен та зображень
    const norm = (s: string) => (s || '').toLowerCase().replace(/['"_\-\s.]+/g, '').replace(/(png|webp|jpg|jpeg)$/, '');

    // Читаємо відмічені доставки з globalVariables проекту
    const markedDeliveries = new Set<string>();
    const MARKED_KEY = '__markedDeliveries';

    if (globalVariables) {
      const legacyList = globalVariables[MARKED_KEY];
      if (Array.isArray(legacyList)) {
        legacyList.forEach((item: string) => {
          if (typeof item === 'string' && item.trim()) markedDeliveries.add(item.trim());
        });
      }
      for (const [k, v] of Object.entries(globalVariables)) {
        if (k === MARKED_KEY) continue;
        if (v === 1 || v === '1' || v === true) {
          if (k.startsWith('__markedItems_')) {
            markedDeliveries.add(k.replace('__markedItems_', ''));
          } else if (!k.startsWith('__') && !k.startsWith('lastRun') && !k.startsWith('system_')) {
            markedDeliveries.add(k);
          }
        }
      }
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
      const nName = norm(d.name || '');
      const nImage = norm(d.image || '');

      for (const marked of markedDeliveries) {
        const nMarked = norm(marked);
        if (!nMarked) continue;
        if (nName && (nMarked === nName || nMarked.includes(nName) || nName.includes(nMarked))) return true;
        if (nImage && (nMarked === nImage || nMarked.includes(nImage) || nImage.includes(nMarked))) return true;
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
          const nDeliveryName = norm(deliveryName);
          const nDeliveryImage = norm(deliveryImage);

          if (Array.isArray(legacyArr)) {
            globalVariables[MARKED_KEY] = legacyArr.filter((item: string) => {
              const nItem = norm(item);
              return nItem !== nDeliveryName && nItem !== nDeliveryImage;
            });
          }

          // Очищаємо всі змінні (і legacy, і __markedItems_, і окремі), які відповідають цій доставці
          for (const k of Object.keys(globalVariables)) {
            if (k === MARKED_KEY) continue;
            const cleanedK = k.startsWith('__markedItems_') ? k.replace('__markedItems_', '') : k;
            const nK = norm(cleanedK);
            if (nK && (nK === nDeliveryName || nK === nDeliveryImage)) {
              delete globalVariables[k];
            }
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
