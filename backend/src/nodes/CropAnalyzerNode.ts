import { NodeHandlerParams } from './types';
import { Logger } from '../logger';
import { schedulerService } from '../index';

const logger = new Logger('CropAnalyzerNode');

// Тип одного правила розкладу
// Якщо час до врожаю потрапляє в діапазон [fromMin, toMin),
// то запускаємо наступний раз через [scheduleFromMin, scheduleToMin] (рандом у діапазоні)
interface ScheduleRule {
  fromMin: number;  // Від скількох хвилин
  toMin: number;    // До скількох хвилин (не включно)
  scheduleFromMin: number; // Запустити не раніше ніж через X хвилин
  scheduleToMin: number;   // Запустити не пізніше ніж через Y хвилин
}

// Базовий час росту для кожної рослини (в мілісекундах)
// Взято з офіційного репозиторію Sunflower Land (src/features/game/types/crops.ts)
const BASE_GROWTH_TIMES: Record<string, number> = {
  'Sunflower': 60 * 1000,
  'Potato': 5 * 60 * 1000,
  'Rhubarb': 10 * 60 * 1000,
  'Pumpkin': 30 * 60 * 1000,
  'Zucchini': 30 * 60 * 1000,
  'Carrot': 60 * 60 * 1000,
  'Yam': 60 * 60 * 1000,
  'Cabbage': 2 * 60 * 60 * 1000,
  'Broccoli': 2 * 60 * 60 * 1000,
  'Soybean': 3 * 60 * 60 * 1000,
  'Beetroot': 4 * 60 * 60 * 1000,
  'Pepper': 4 * 60 * 60 * 1000,
  'Cauliflower': 8 * 60 * 60 * 1000,
  'Parsnip': 12 * 60 * 60 * 1000,
  'Eggplant': 16 * 60 * 60 * 1000,
  'Corn': 20 * 60 * 60 * 1000,
  'Onion': 20 * 60 * 60 * 1000,
  'Radish': 24 * 60 * 60 * 1000,
  'Wheat': 24 * 60 * 60 * 1000,
  'Turnip': 24 * 60 * 60 * 1000,
  'Kale': 36 * 60 * 60 * 1000,
  'Artichoke': 36 * 60 * 60 * 1000,
  'Barley': 48 * 60 * 60 * 1000,
  'Rice': 32 * 60 * 60 * 1000,
  'Olive': 44 * 60 * 60 * 1000,
};

// Обробник ноди "Аналізатор врожаю"
export const cropAnalyzerNodeHandler = async ({
  currentNode, context, globalVariables, broadcastVariables, logToClient, projectName
}: NodeHandlerParams) => {
  const { variableName, scheduleRules = [] } = currentNode.data;

  if (!variableName) {
    logToClient(`❌ Аналізатор: Не вказана змінна для збереження результату`, 'error');
    return { data: { ...context, error: 'Missing variable name' }, nextHandle: ['error'] };
  }

  // Шукаємо дані в context.raw або context.value (куди ApiNode зберігає результат)
  const apiData = context?.raw || context?.value;

  if (!apiData || typeof apiData !== 'object') {
    logToClient(`❌ Аналізатор: В контексті немає JSON даних від API`, 'error');
    return { data: { ...context, error: 'No API data found in context' }, nextHandle: ['error'] };
  }

  const crops = apiData?.visitedFarmState?.crops;

  if (!crops || Object.keys(crops).length === 0) {
    logToClient(`⚠️ Аналізатор: Грядки не знайдено в даних`, 'info');
    // Порт ready — немає чого збирати, але і нема чого чекати
    return { data: context, nextHandle: ['ready'] };
  }

  // Отримуємо зміщення часу між нашим ПК і сервером (якщо ApiNode його зберегла)
  const clockOffset = context?.__clockOffset || 0;
  // Поточний час у координатах сервера
  const serverNow = Date.now() - clockOffset;

  let minReadyAt: number | null = null; // Мінімальний час дозрівання (на сервері)
  let fastestCropName = '';             // Назва найшвидшої рослини
  let hasReadyCrops = false;            // Чи є вже дозрілі рослини

  // Проходимо по всіх грядках
  for (const cropId in crops) {
    const cropData = crops[cropId].crop;
    if (!cropData || !cropData.plantedAt) continue; // Пропускаємо порожні грядки

    const cropName = cropData.name || 'Unknown';
    const baseTime = BASE_GROWTH_TIMES[cropName] || 0;

    // ЛОГІКА GRI: plantedAt вже зсунуто у минуле на величину бафу!
    // Тому: readyAt = plantedAt + базовий_час
    const readyAtServerTime = cropData.plantedAt + baseTime;

    if (readyAtServerTime <= serverNow) {
      // Ця рослина вже виросла
      hasReadyCrops = true;
    } else {
      // Рослина ще росте — шукаємо найближчу
      if (minReadyAt === null || readyAtServerTime < minReadyAt) {
        minReadyAt = readyAtServerTime;
        fastestCropName = cropName;
      }
    }
  }

  // Якщо є вже дозрілі рослини — негайно виходимо через порт 'ready'
  if (hasReadyCrops) {
    logToClient(`🌾 Аналізатор: Є дозрілі рослини! Переходимо до збирання.`, 'success');
    return { data: context, nextHandle: ['ready'] };
  }

  // Всі рослини ще ростуть — знаходимо час найближчого врожаю
  if (minReadyAt !== null) {
    // Адаптуємо серверний час до годинника нашого ПК
    const adjustedReadyAt = minReadyAt + clockOffset;

    // Зберігаємо час у глобальну змінну для SetNextRunNode
    globalVariables[variableName] = adjustedReadyAt;
    broadcastVariables();

    const minutesLeft = Math.max(0, Math.round((adjustedReadyAt - Date.now()) / 60000));
    const date = new Date(adjustedReadyAt);
    const timeStr = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    logToClient(
      `⏳ Аналізатор: Найшвидше виросте ${fastestCropName} о ${timeStr} (через ~${minutesLeft} хв).`,
      'info'
    );

    // Якщо є правила розкладу — обчислюємо запланований час запуску
    const parsedRules: ScheduleRule[] = Array.isArray(scheduleRules) ? scheduleRules : [];

    if (parsedRules.length > 0) {
      // Знаходимо перше правило, у діапазон якого потрапляє minutesLeft
      const matchedRule = parsedRules.find(
        (r) => minutesLeft >= r.fromMin && minutesLeft < r.toMin
      );

      if (matchedRule) {
        // Генеруємо рандомний час запуску у діапазоні [scheduleFromMin, scheduleToMin]
        const rangeMs = (matchedRule.scheduleToMin - matchedRule.scheduleFromMin) * 60000;
        const randomOffset = Math.floor(Math.random() * rangeMs);
        const scheduleMs = matchedRule.scheduleFromMin * 60000 + randomOffset;
        const runAt = Date.now() + scheduleMs;

        const scheduledMin = Math.round(scheduleMs / 60000);
        const runDate = new Date(runAt);
        const runStr = runDate.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

        logToClient(
          `[Розклад] 📅 Правило розкладу (${minutesLeft} хв → +${scheduledMin} хв): наступний запуск о ${runStr}.`,
          'success'
        );

        // Додаємо запис у планувальник
        schedulerService.addScheduledRun(projectName, runAt, 'node');

        // Виходимо через порт 'next' — сигнал що запланували, але не збираємо
        return { data: context, nextHandle: ['next'] };
      } else {
        // Не знайдено підходящого правила — записуємо час у змінну і йдемо далі
        logToClient(
          `⚠️ Аналізатор: Час ${minutesLeft} хв не потрапив в жодне правило. Час записано у змінну [${variableName}].`,
          'info'
        );
        return { data: context, nextHandle: ['next'] };
      }
    } else {
      // Правил немає — просто записали час у змінну, виходимо через 'next'
      logToClient(`📝 Аналізатор: Час записано у змінну [${variableName}].`, 'info');
      return { data: context, nextHandle: ['next'] };
    }
  }

  // Грядки є, але всі порожні (немає посаджених рослин)
  logToClient(`🌱 Аналізатор: Грядки порожні, рослини не посаджені.`, 'info');
  return { data: context, nextHandle: ['ready'] };
};
