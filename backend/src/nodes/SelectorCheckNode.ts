import { NodeHandlerParams } from './types';
import { inputValidator } from '../validation/InputValidator';
import { Logger } from '../logger';

const logger = new Logger('SelectorCheckNode');

export const selectorCheckNodeHandler = async ({ currentNode, activePage, nodeTitle, takeDebugSnapshot, ws, logToClient, context }: NodeHandlerParams) => {
  const { selector } = currentNode.data;
  
  // Requirement 4: Validate CSS selector before Playwright operations
  if (!selector || typeof selector !== 'string') {
    logger.warn(`SelectorCheck node ${currentNode.id}: missing or invalid selector`, { selector });
    logToClient(`❌ Селектор не вказано або невалідний`, 'error');
    return { nextHandle: 'not_exists', data: context };
  }
  
  const selectorValidation = inputValidator.validateSelector(selector);
  if (!selectorValidation.isValid) {
    logger.warn(`SelectorCheck node ${currentNode.id}: selector validation failed`, { selector, error: selectorValidation.error });
    logToClient(`❌ Невалідний селектор: ${selectorValidation.error}`, 'error');
    return { nextHandle: 'not_exists', data: context };
  }
  
  logToClient(`⚙️ ПЕРЕВІРКА: Наявність ${selector}`, 'debug');
  const isExists = await activePage.$(selector).catch(() => null);
  if (isExists) {
    await takeDebugSnapshot(currentNode.id, nodeTitle, { selector });
    logToClient(`✅ Селектор існує`, 'success');
  } else {
    logToClient(`❌ Селектор НЕ знайдено`, 'error');
  }
  return { nextHandle: isExists ? 'exists' : 'not_exists', data: context };
};
