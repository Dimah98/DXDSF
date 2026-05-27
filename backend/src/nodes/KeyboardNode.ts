import { Logger } from '../logger';
import { NodeHandlerParams } from './types';

const logger = new Logger('KeyboardNode');

export const keyboardNodeHandler = async ({ currentNode, activePage, smartSleep, ws, logToClient, context }: NodeHandlerParams) => {
  // Requirement 13.1: Wrap all async operations in try-catch with logging
  try {
    if (currentNode.type === 'escNode') {
      logToClient(`⌨️ Натискання ESC`, 'debug');
      await activePage.keyboard.press('Escape');
    } else {
      const keys = currentNode.data.keys || [];
      for (const k of keys) {
        if (!k.key) continue;
        
        const keyStr = k.key2 ? `${k.key2} + ${k.key}` : k.key;
        logToClient(`⌨️ Макрос: ${keyStr} (утримання ${k.holdTime || 0}мс)`, 'debug');
        
        if (k.key2) {
          await activePage.keyboard.down(k.key2);
          await smartSleep(20, ws);
        }
        
        await activePage.keyboard.down(k.key);
        
        if (k.holdTime && k.holdTime > 0) {
          await smartSleep(k.holdTime, ws);
        }
        
        await activePage.keyboard.up(k.key);
        
        if (k.key2) {
          await smartSleep(20, ws);
          await activePage.keyboard.up(k.key2);
        }
        
        if (k.delay && k.delay > 0) {
          await smartSleep(k.delay, ws);
        }
      }
    }
  } catch (err: any) {
    // Requirement 13.1: Log the error
    logger.error(`Keyboard action failed for node ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)));
    logToClient(`❌ Помилка клавіатури: ${err.message || String(err)}`, 'error');
    // Requirement 13.5: Continue execution through error handle path
    return { data: context, nextHandle: ['error'] };
  }
  
  return { data: context };
};
