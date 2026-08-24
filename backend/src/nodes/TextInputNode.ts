import { NodeHandlerParams } from './types';
import { inputValidator } from '../validation/InputValidator';
import { Logger } from '../logger';

const logger = new Logger('TextInputNode');

export const textInputNodeHandler = async ({
  currentNode,
  activePage,
  ws,
  globalVariables,
  context,
  logToClient
}: NodeHandlerParams) => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const selector = (nodeData.selector as string || '').trim();
  const staticText = (nodeData.text as string || '');
  const clearFirst = nodeData.clearFirst !== undefined ? Boolean(nodeData.clearFirst) : true;
  const pressEnter = nodeData.pressEnter !== undefined ? Boolean(nodeData.pressEnter) : false;
  const delayBetweenKeys = Number(nodeData.delayBetweenKeys || 0);

  // 1. Отримуємо динамічний текст з контексту (з порту text_input або вхідного контексту) чи зі статичного шаблону
  let textToInsert = '';

  if (context.text_input !== undefined && context.text_input !== null) {
    textToInsert = String(context.text_input);
  } else if (context.text !== undefined && context.text !== null) {
    textToInsert = String(context.text);
  } else if (context.value !== undefined && context.value !== null) {
    textToInsert = String(context.value);
  } else {
    textToInsert = staticText;
  }

  // 2. Виконуємо підстановку змінних у форматі {varName}
  const resolvedText = textToInsert.replace(/\{(\w+)\}/g, (match: string, varName: string) => {
    return globalVariables[varName] !== undefined ? String(globalVariables[varName]) : match;
  });

  // 3. Перевірка селектора
  if (!selector) {
    logger.warn(`TextInput node ${currentNode.id}: missing selector`);
    logToClient(`❌ Помилка: Не вказано селектор поля введення`, 'error');
    return { data: context, nextHandle: ['error'] };
  }

  // 4. Валідація CSS-селектора
  const validation = inputValidator.validateSelector(selector);
  if (!validation.isValid) {
    logger.warn(`TextInput node ${currentNode.id}: invalid selector`, { error: validation.error });
    logToClient(`❌ Невалідний селектор введення: ${validation.error}`, 'error');
    return { data: context, nextHandle: ['error'] };
  }

  try {
    logToClient(`✍️ Введення тексту "${resolvedText}" в поле "${selector}"`, 'info');

    // Чекаємо появу елемента
    const element = await activePage.waitForSelector(selector, { state: 'visible', timeout: 5000 });
    if (!element) {
      logToClient(`❌ Поле "${selector}" не знайдено або невидиме`, 'error');
      return { data: context, nextHandle: ['error'] };
    }

    // Очищення поля, якщо увімкнено прапорець
    if (clearFirst) {
      await activePage.evaluate((sel: string) => {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        if (el) el.value = '';
      }, selector);
    }

    // Введення тексту
    if (delayBetweenKeys > 0) {
      await activePage.type(selector, resolvedText, { delay: delayBetweenKeys });
    } else {
      await activePage.type(selector, resolvedText);
    }

    if (ws) { /* just to suppress ts warning */ }

    // Натискання Enter, якщо увімкнено
    if (pressEnter) {
      await activePage.press(selector, 'Enter');
      logToClient(`⌨️ Натиснуто Enter у полі "${selector}"`, 'debug');
    }

    logToClient(`✅ Текст успішно введено у "${selector}"`, 'success');
    logger.info(`TextInput node ${currentNode.id} successfully entered text into ${selector}`);

    return {
      data: {
        ...context,
        text: resolvedText,
        lastEnteredText: resolvedText
      },
      nextHandle: ['success']
    };
  } catch (err: any) {
    logger.error(`TextInput node ${currentNode.id} execution failed`, err);
    logToClient(`❌ Помилка введення тексту: ${err.message}`, 'error');
    return { data: context, nextHandle: ['error'] };
  }
};
