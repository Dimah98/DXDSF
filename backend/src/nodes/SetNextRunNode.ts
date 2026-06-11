import { NodeHandlerParams } from './types';
import { schedulerService } from '../index';

// Обробник ноди "Наступний запуск" — встановлює час наступного запуску поточного проекту
export const setNextRunNodeHandler = async ({
  currentNode, context, logToClient, projectName, globalVariables
}: NodeHandlerParams) => {
  // Зчитуємо режим: 'delay' — через N часу, 'fixedTime' — у заданий час, 'absoluteTimestamp' - зі змінної
  const mode = currentNode.data.scheduleMode || 'delay';

  let runAt: number; // Часова мітка наступного запуску (мс)

  if (mode === 'delay') {
    // Режим 1: Запуск через N хвилин або годин від поточного моменту
    const value = Number(currentNode.data.delayValue) || 1; // Кількість одиниць часу (за замовч. 1)
    const unit = currentNode.data.delayUnit || 'hours'; // Одиниця: 'hours' або 'minutes'
    const delayMs = unit === 'hours' ? value * 3600000 : value * 60000; // Переводимо у мілісекунди
    runAt = Date.now() + delayMs; // Час наступного запуску = зараз + затримка
    // Логуємо запланований запуск з префіксом [Розклад] для відображення відповідного бейджа
    logToClient(`[Розклад] 📅 Наступний запуск заплановано через ${value} ${unit === 'hours' ? 'год' : 'хв'}`, 'success');
  } else if (mode === 'absoluteTimestamp') {
    // Режим 3: Запуск за абсолютною міткою часу з глобальної змінної
    const varName = currentNode.data.timestampVariable || 'nextCropHarvest';
    const timestamp = globalVariables[varName];

    if (timestamp && typeof timestamp === 'number') {
      runAt = timestamp;
      const date = new Date(runAt);
      const timeStr = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const diffMin = Math.max(0, Math.round((runAt - Date.now()) / 60000));
      logToClient(`[Розклад] 📅 Наступний запуск заплановано о ${timeStr} (через ~${diffMin} хв) [Змінна: ${varName}]`, 'success');
    } else {
      // Фолбек: якщо змінна не задана або недійсна, ставимо затримку 1 годину
      logToClient(`⚠️ Невалідна змінна часу '${varName}', фолбек: запуск через 1 годину`, 'info');
      runAt = Date.now() + 3600000;
    }
  } else {
    // Режим 2: Запуск у конкретний час HH:MM
    const targetTime = currentNode.data.targetTime || '08:00'; // Час у форматі "ГГ:ХХ"
    const [hours, minutes] = targetTime.split(':').map(Number); // Розбираємо час
    const now = new Date(); // Поточний момент
    const target = new Date(now); // Клонуємо для модифікації
    target.setHours(hours, minutes, 0, 0); // Встановлюємо цільовий час на сьогодні

    // Якщо час вже минув сьогодні — переносимо на завтра
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1); // Збільшуємо дату на 1 день
    }
    runAt = target.getTime(); // Зберігаємо часову мітку цільового запуску
    // Логуємо запланований запуск з префіксом [Розклад] для відображення відповідного бейджа
    logToClient(`[Розклад] 📅 Наступний запуск заплановано о ${targetTime}`, 'success');
  }

  // Додаємо запис у сервіс планувальника із джерелом 'node' (від ноди сценарію)
  schedulerService.addScheduledRun(projectName, runAt, 'node');

  // Повертаємо контекст без змін для продовження виконання сценарію
  return { data: context };
};
