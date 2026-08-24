// Імпортуємо необхідні типи параметрів обробника ноди
import { NodeHandlerParams } from './types';
// Імпортуємо валідатор вхідних даних для перевірки селекторів
import { inputValidator } from '../validation/InputValidator';
// Імпортуємо логер для запису системних подій бекенду
import { Logger } from '../logger';

// Створюємо екземпляр логера для нашої нової ноди
const logger = new Logger('SearchAndClickNode');

// Експортуємо функцію-обробник для ноди пошуку та кліку
export const searchAndClickNodeHandler = async ({
  currentNode, // Поточна нода з конфігурацією та даними
  activePage, // Активна сторінка Playwright для взаємодії з браузером
  ws, // Об'єкт WebSocket для надсилання оновлень на фронтенд
  globalVariables, // Глобальні змінні проекту
  context, // Поточний контекст виконання сценарію
  logToClient // Функція для логування повідомлень клієнту
}: NodeHandlerParams) => {
  // Отримуємо налаштування з даних ноди (селектори, текст та затримку)
  const nodeData = currentNode.data as Record<string, unknown>;
  const { inputSelector, textToEnter, clickSelector, clickDelay = 500 } = nodeData;

  // Перевіряємо чи вказано селектор для поля введення
  if (!inputSelector || typeof inputSelector !== 'string') {
    // Логуємо попередження про відсутність селектора введення
    logger.warn(`SearchAndClick node ${currentNode.id}: missing input selector`);
    // Відправляємо інформаційне повідомлення клієнту у консоль
    logToClient(`❌ Помилка: Не вказано селектор поля введення`, 'error');
    // Повертаємо результат з переходом по гілці помилки
    return { data: context, nextHandle: 'error' };
  }

  // Перевіряємо чи вказано селектор для кліку
  if (!clickSelector || typeof clickSelector !== 'string') {
    // Логуємо попередження про відсутність селектора для кліку
    logger.warn(`SearchAndClick node ${currentNode.id}: missing click selector`);
    // Відправляємо повідомлення про помилку клієнту
    logToClient(`❌ Помилка: Не вказано селектор елемента для кліку`, 'error');
    // Повертаємо результат з переходом по гілці помилки
    return { data: context, nextHandle: 'error' };
  }

  // Валідуємо CSS-селектор поля введення для безпеки Playwright
  const inputValidation = inputValidator.validateSelector(inputSelector);
  // Якщо селектор введення невалідний
  if (!inputValidation.isValid) {
    // Логуємо помилку валідації селектора введення
    logger.warn(`SearchAndClick node ${currentNode.id}: input selector invalid`, { error: inputValidation.error });
    // Сповіщаємо клієнта про невалідний селектор
    logToClient(`❌ Невалідний селектор введення: ${inputValidation.error}`, 'error');
    // Переходимо на гілку помилки
    return { data: context, nextHandle: 'error' };
  }

  // Валідуємо CSS-селектор елемента для кліку
  const clickValidation = inputValidator.validateSelector(clickSelector);
  // Якщо селектор для кліку невалідний
  if (!clickValidation.isValid) {
    // Логуємо помилку валідації селектора для кліку
    logger.warn(`SearchAndClick node ${currentNode.id}: click selector invalid`, { error: clickValidation.error });
    // Сповіщаємо клієнта
    logToClient(`❌ Невалідний селектор для кліку: ${clickValidation.error}`, 'error');
    // Переходимо на гілку помилки
    return { data: context, nextHandle: 'error' };
  }

  // Отримуємо текст для введення (за замовчуванням порожній рядок)
  const templateText = (textToEnter as string) || '';
  // Розділяємо введений текст на окремі варіанти за комами або символом нового рядка
  const textOptions = templateText.split(/,|\n/).map((opt: string) => opt.trim()).filter((opt: string) => opt.length > 0);
  
  // Якщо немає жодного варіанту тексту
  if (textOptions.length === 0) {
    // Логуємо попередження на сервері
    logger.warn(`SearchAndClick node ${currentNode.id}: no text options provided`);
    // Сповіщаємо клієнта про відсутність значень
    logToClient(`❌ Помилка: Не вказано текст для введення`, 'error');
    // Переходимо на гілку помилки
    return { data: context, nextHandle: 'error' };
  }

  // Вибираємо один випадковий варіант зі списку
  const chosenTemplate = textOptions[Math.floor(Math.random() * textOptions.length)];

  // Виконуємо підстановку глобальних змінних у вибраний текст, якщо вони вказані у форматі {ім'я_змінної}
  const resolvedText = chosenTemplate.replace(/\{(\w+)\}/g, (match: string, varName: string) => {
    // Якщо така змінна є в глобальних — беремо її значення, інакше залишаємо шаблон як є
    return globalVariables[varName] !== undefined ? String(globalVariables[varName]) : match;
  });

  // Якщо текст після підстановки виявився порожнім
  if (!resolvedText) {
    // Логуємо попередження про порожній текст
    logger.warn(`SearchAndClick node ${currentNode.id}: text to enter is empty`);
    // Сповіщаємо клієнта про порожнє значення
    logToClient(`❌ Помилка: Текст для введення порожній`, 'error');
    // Повертаємо перехід на гілку помилки
    return { data: context, nextHandle: 'error' };
  }

  try {
    // Повідомляємо клієнту про початок операції введення тексту
    logToClient(`✍️ Введення тексту "${resolvedText}" у полі з селектором "${inputSelector}"`, 'info');

    // Очікуємо появи поля введення на сторінці (максимум 5 секунд)
    await activePage.waitForSelector(inputSelector, { state: 'visible', timeout: 5000 });
    // Очищуємо поле введення перед записом тексту
    await activePage.fill(inputSelector, '');
    // Вводимо текст символ за символом або повністю заповнюємо поле
    await activePage.fill(inputSelector, resolvedText);

    // Логуємо успішне введення тексту на сервері
    logger.info(`Filled selector ${inputSelector} with text: ${resolvedText}`);

    // Перетворюємо затримку перед кліком у число
    const delayTime = Number(clickDelay) || 500;
    // Якщо затримка більше нуля, чекаємо вказаний час для оновлення DOM сторінки
    if (delayTime > 0) {
      // Логуємо очікування перед кліком
      logToClient(`⏱️ Очікування ${delayTime}мс для оновлення результатів...`, 'debug');
      // Призупиняємо виконання на вказану кількість мілісекунд
      await activePage.waitForTimeout(delayTime);
    }

    // Повідомляємо клієнту про пошук елемента з введеним текстом
    logToClient(`🔍 Пошук елемента "${clickSelector}", який містить текст "${resolvedText}"`, 'info');

    // Створюємо локатор для пошуку потрібного елемента та фільтруємо його за наявністю нашого тексту
    const targetLocator = activePage.locator(clickSelector).filter({ hasText: resolvedText }).first();
    
    // Перевіряємо кількість знайдених елементів, які відповідають умовам
    const count = await targetLocator.count();

    // Якщо жодного елемента з таким текстом не знайдено
    if (count === 0) {
      // Логуємо попередження на сервері
      logger.warn(`No element found matching selector "${clickSelector}" with text "${resolvedText}"`);
      // Сповіщаємо клієнта у консоль про невдачу
      logToClient(`❌ Елемент "${clickSelector}" з текстом "${resolvedText}" не знайдено`, 'error');
      // Повертаємо перехід на гілку помилки
      return { data: context, nextHandle: 'error' };
    }

    // Отримуємо координати елемента для інформативності логів та перевірки видимості
    const box = await targetLocator.boundingBox();
    // Якщо координати успішно отримано
    if (box) {
      // Обчислюємо центральну точку елемента
      const x = Math.round(box.x + box.width / 2);
      // Обчислюємо центральну точку по осі Y
      const y = Math.round(box.y + box.height / 2);
      // Логуємо координати знайденого елемента
      logger.info(`Found element at coordinates X: ${x}, Y: ${y}`);
    }

    // Робимо клік по знайденому елементу за допомогою Playwright
    await targetLocator.click();
    // Повідомляємо клієнта про успішне виконання кліку
    logToClient(`🎯 Успішно клікнуто по елементу з текстом "${resolvedText}"`, 'success');

    // Надсилаємо оновлення стану ноди на фронтенд через WebSocket
    ws.send(JSON.stringify({
      type: 'NODE_DATA_UPDATE', // Тип події оновлення даних ноди
      nodeId: currentNode.id, // ID поточної ноди
      data: { 
        lastStatus: `Клікнуто на "${resolvedText}"`, // Текст статусу для відображення на ноді
        lastTime: new Date().toLocaleTimeString('uk-UA') // Час останнього виконання
      }
    }));

    // Повертаємо успішне завершення з переходом по зеленій гілці success
    return { data: context, nextHandle: 'success' };

  } catch (err: any) {
    // Логуємо помилку виконання операцій у консоль сервера
    logger.error(`Failed to execute SearchAndClickNode for node ${currentNode.id}`, err);
    // Сповіщаємо клієнта про виникнення критичної помилки
    logToClient(`❌ Помилка виконання: ${err.message}`, 'error');
    // Повертаємо результат з переходом по червоній гілці error
    return { data: context, nextHandle: 'error' };
  }
};
