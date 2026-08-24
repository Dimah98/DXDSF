import { NodeHandlerParams } from './types';
import { inputValidator } from '../validation/InputValidator';

export const nestedCheckNodeHandler = async ({ currentNode, activePage, logToClient, context }: NodeHandlerParams) => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const parentSelector = (nodeData.parentSelector as string) || '';
  const childSelector = (nodeData.childSelector as string) || '';

  // Validate parent selector
  const parentValidation = inputValidator.validateSelector(parentSelector);
  if (!parentValidation.isValid) {
    logToClient(`❌ Невалідний parentSelector: ${parentValidation.error}`, 'error');
    return { nextHandle: 'error', data: context };
  }

  // Validate child selector
  const childValidation = inputValidator.validateSelector(childSelector);
  if (!childValidation.isValid) {
    logToClient(`❌ Невалідний childSelector: ${childValidation.error}`, 'error');
    return { nextHandle: 'error', data: context };
  }

  logToClient(`⚙️ ПЕРЕВІРКА: ${childSelector} всередині ${parentSelector}`, 'debug');
  const parent = await activePage.$(parentSelector).catch(() => null);
  const child = parent ? await parent.$(childSelector).catch(() => null) : null;
  return { nextHandle: child ? 'found' : 'not_found', data: context };
};
