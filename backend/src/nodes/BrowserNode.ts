import { Logger } from '../logger';
import { NodeHandlerParams } from './types';
import { inputValidator } from '../validation/InputValidator';

const logger = new Logger('BrowserNode');

export const browserNodeHandler = async ({ currentNode, activePage, logToClient, context }: NodeHandlerParams) => {
  const { url, browser_action } = currentNode.data;
  
  // Requirement 13.1: Wrap all async operations in try-catch with logging
  try {
    if (url && url.startsWith('http')) {
       // Requirement 5: Validate URL before navigation
       const urlValidation = inputValidator.validateURL(url);
       if (!urlValidation.isValid) {
         logger.warn(`Browser node ${currentNode.id}: URL validation failed`, { url, error: urlValidation.error });
         logToClient(`❌ Невалідний URL: ${urlValidation.error}`, 'error');
         return { data: context, nextHandle: ['error'] };
       }
       
       logToClient(`🌐 Перехід на: ${url}`, 'debug');
       await activePage.goto(url, { waitUntil: 'load' });
    } else {
       if (browser_action === 'refresh') {
          logToClient(`🔄 Оновлення сторінки...`, 'debug');
          await activePage.reload({ waitUntil: 'load' }).catch(async () => {
             await activePage.evaluate(() => window.location.reload());
          });
       }
       else if (browser_action === 'back') await activePage.goBack();
       else if (browser_action === 'wait_load') await activePage.waitForLoadState('networkidle');
    }
  } catch (err: any) {
    // Requirement 13.1: Log the error
    logger.error(`Browser action failed for node ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)), { url, browser_action });
    logToClient(`❌ Помилка браузера: ${err.message || String(err)}`, 'error');
    // Requirement 13.5: Continue execution through error handle path
    return { data: context, nextHandle: ['error'] };
  }
  
  return { data: context };
};
