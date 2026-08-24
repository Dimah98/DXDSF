import { Logger } from '../logger';
import { NodeHandlerParams } from './types';

const logger = new Logger('CoordClickNode');

export const coordClickNodeHandler = async ({
  currentNode, // Поточна нода
  activePage, // Активна сторінка браузера
  ws, // WebSocket з'єднання
  context, // Контекст виконання
  globalVariables, // Глобальні змінні проекту
  nodeTitle, // Заголовок ноди
  targetHandle, // Вхідний порт
  takeDebugSnapshot, // Функція для дебаг-скріншотів
  logToClient // Логер для виведення повідомлень
}: NodeHandlerParams) => {
  let nodeResults: Record<string, unknown> = {};

  const nodeData = currentNode.data as Record<string, unknown>;
  const ignoreContextCoords = Boolean(nodeData.ignoreContextCoords);

  if (targetHandle === 'update_coords' && context?.coords && !ignoreContextCoords) {
    nodeData.x = context.coords.x;
    nodeData.y = context.coords.y;
    nodeResults.coords = context.coords;
    try {
      ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { x: context.coords.x, y: context.coords.y } }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DATA_UPDATE for node ${currentNode.id}`, { error: String(sendErr) });
    }
    logToClient(`📥 Координати оновлено: (${context.coords.x}, ${context.coords.y})`, 'success');
    return { skipNext: true }; // Зупиняємо сигнал тут
  } 
  else if (targetHandle === 'update_count' && context?.num !== undefined) {
    nodeData.clickCount = context.num;
    try {
      ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { clickCount: context.num } }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DATA_UPDATE for node ${currentNode.id}`, { error: String(sendErr) });
    }
    logToClient(`📥 Кількість кліків оновлено: ${context.num}`, 'success');
    return { skipNext: true }; // Зупиняємо сигнал тут
  }
  else {
    // Requirement 13.1: Wrap async operations in try-catch with logging
    try {
      let x = (nodeData.x as number) || 0;
      let y = (nodeData.y as number) || 0;
      let wheelY = 0;
      const currentScroll = await activePage.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));

      if (context?.coords && !ignoreContextCoords) {
        x = context.coords.x;
        y = context.coords.y;
      } else if ((nodeData.y as number) < 0) {
        wheelY = nodeData.y as number;
        y = currentScroll.y; 
      }

      // Застосувати зсув координат
      const offsetX = (nodeData.offsetX as number) || 0;
      const offsetY = (nodeData.offsetY as number) || 0;
      x = x + offsetX;
      y = y + offsetY;

      const vSize = activePage.viewportSize() || { width: 960, height: 540 };
      if (wheelY !== 0) {
         await activePage.mouse.move(vSize.width / 2, vSize.height / 2);
         await activePage.mouse.wheel(0, wheelY);
         await activePage.waitForTimeout(600);
      }

      // Розраховуємо чи потрібно перемістити камеру до точки
      const vW = (await activePage.viewportSize())?.width || 960;
      const vH = (await activePage.viewportSize())?.height || 540;
      
      let finalX = x - currentScroll.x;
      let finalY = y - currentScroll.y;

      if (!currentNode.data.isUIElement && (finalX < 50 || finalX > (vW - 50) || finalY < 50 || finalY > (vH - 50))) {
        const centerX = vW / 2;
        const centerY = vH / 2;
        
        // Тягнемо так, щоб точка опинилася точно в центрі
        const deltaX = centerX - finalX;
        const deltaY = centerY - finalY;
        
        const dragTargetX = centerX + deltaX;
        const dragTargetY = centerY + deltaY;

        logToClient(`🚜 Тягну карту: затискаю в (${centerX}, ${centerY}) -> тягну в (${dragTargetX}, ${dragTargetY})`, 'debug');

        await activePage.mouse.move(centerX, centerY);
        await activePage.mouse.down();
        await activePage.mouse.move(dragTargetX, dragTargetY, { steps: 25 });
        await activePage.mouse.up();
        
        await activePage.waitForTimeout(400);
        await activePage.keyboard.press('Escape'); // Закриваємо випадково відкриті будівлі
        logToClient(`⌨️ Натиснуто Escape (профілактика меню)`, 'debug');
        
        // Після "драгу" координати точки у в'юпорті змінилися на дельту
        finalX = centerX;
        finalY = centerY;
        
        await activePage.waitForTimeout(400); 
      }

      const finalCoords = { x: finalX, y: finalY };

      // Функція для визначення кількості кліків (підтримує як числа, так і {змінні})
      const getClickCount = (val: any): number => {
        if (typeof val === 'number') return val; // Якщо прийшло число — повертаємо його
        const str = String(val || '').trim(); // Перетворюємо в рядок і очищаємо пробіли
        const match = str.match(/^\{(.+)\}$/); // Шукаємо формат {назва_змінної}
        if (match) {
          // Шукаємо змінну в глобальних змінних проекту або в поточному контексті
          const varVal = globalVariables[match[1]] ?? context[match[1]] ?? 1;
          return parseInt(String(varVal)) || 1; // Парсимо значення змінної як ціле число
        }
        const parsed = parseInt(str); // Парсимо як звичайне число
        return isNaN(parsed) ? 1 : parsed; // Повертаємо 1 при невдалому парсингу
      };

      const count = getClickCount(currentNode.data.clickCount); // Розраховуємо фінальну кількість кліків
      for (let i = 0; i < count; i++) { // Запускаємо цикл виконання кліків
        if (i === 0) await takeDebugSnapshot(currentNode.id, nodeTitle, finalCoords); // На першому кліці робимо дебаг-скріншот
        await activePage.mouse.click(finalCoords.x, finalCoords.y); // Виконуємо клік мишкою
        if (count > 1) await activePage.waitForTimeout(100); // Робимо невелику затримку між кліками
      }
    } catch (err: any) {
      // Requirement 13.1: Log the error
      logger.error(`CoordClick failed for node ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)));
      logToClient(`❌ Помилка кліку по координатах: ${err.message || String(err)}`, 'error');
      // Requirement 13.5: Continue execution through error handle path
      return { data: context, nextHandle: ['error'] };
    }
    // Віддаємо пустий об'єкт, щоб клік давав тільки сигнал, без вмісту
  }
  return { data: {} };
};
