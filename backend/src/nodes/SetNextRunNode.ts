import { NodeHandlerParams } from './types';
import { schedulerService } from '../index';

// Обробник ноди "Наступний запуск" — встановлює час наступного запуску поточного проекту
export const setNextRunNodeHandler = async ({
  currentNode, context, logToClient, projectName
}: NodeHandlerParams) => {
  // Зчитуємо режим: 'delay' — через N часу, 'fixedTime' — у заданий час
  const mode = currentNode.data.scheduleMode || 'delay';

  let runAt: number; // Часова мітка наступного запуску (мс)

  if (mode === 'delay') {
    // Режим 1: Запуск через N хвилин або годин від поточного моменту
    const value = Number(currentNode.data.delayValue) || 1; // Кількість одиниць часу (за замовч. 1)
    const unit = currentNode.data.delayUnit || 'hours'; // Одиниця: 'hours' або 'minutes'
    const delayMs = unit === 'hours' ? value * 3600000 : value * 60000; // Переводимо у мілісекунди
    runAt = Date.now() + delayMs; // Час наступного запуску = зараз + затримка
    logToClient(`📅 Наступний запуск заплановано через ${value} ${unit === 'hours' ? 'год' : 'хв'}`, 'success');
  } else {
    // Режим 2: Запуск у конкретний час HH:MM
    const targetTime = currentNode.data.targetTime || '08:00'; // Час у форматі "ГГ:ХХ"
    const [hours, minutes] = targetTime.split(':').map(Number); // Розбираємо час
    const now = new Date(); // Поточний момент
    const target = new Date(now); // Клонуємо для модифікації
    target.setHours(hours, minutes, 0, 0); // Встановлюємо цільовий час на сьогодні

    // Якщо час вже минув сьогодні — переносимо на завтра
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    runAt = target.getTime(); // Зберігаємо часову мітку цільового запуску
    logToClient(`📅 Наступний запуск заплановано о ${targetTime}`, 'success');
  }

  // Додаємо запис у сервіс планувальника із джерелом 'node' (від ноди сценарію)
  schedulerService.addScheduledRun(projectName, runAt, 'node');

  // Повертаємо контекст без змін для продовження виконання сценарію
  return { data: context };
};
