import { Logger } from '../logger';
import { NodeHandlerParams } from './types';

const logger = new Logger('DisplayNode');

export const displayNodeHandler = async ({ currentNode, context, ws }: NodeHandlerParams) => {
  // Створюємо гарний опис для швидкого перегляду
  let displayVal = "";
  if (context.coords) displayVal += `📍 Координати: ${context.coords.x}, ${context.coords.y}\n`;
  if (context.text) displayVal += `📝 Текст: ${context.text}\n`;
  if (context.count !== undefined) displayVal += `🔢 Кількість: ${context.count}\n`;
  if (context.num !== undefined) displayVal += `🔢 Число: ${context.num}\n`;
  if (context.imageNames?.length) displayVal += `🖼️ Зображення: ${context.imageNames.length}\n`;
  
  // Якщо контекст пустий або немає стандартних полів — робимо JSON
  if (!displayVal) displayVal = "Об'єкт даних отримано";

  // Requirement 13.2: Attach rejection handlers — ws.send wrapped in try-catch
  try {
    // Надсилаємо оновлення: текст для прев'ю та повний об'єкт для детального перегляду
    ws.send(JSON.stringify({ 
      type: 'NODE_DISPLAY_DATA', 
      nodeId: currentNode.id, 
      value: displayVal.trim(),
      rawData: context // Передаємо весь контекст для завантаження
    }));
  } catch (sendErr) {
    logger.warn(`Failed to send NODE_DISPLAY_DATA for node ${currentNode.id}`, { error: String(sendErr) });
  }

  return { data: context };
};
