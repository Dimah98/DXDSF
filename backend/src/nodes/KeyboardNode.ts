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
      const nodeData = currentNode.data as Record<string, unknown>;
      const keys = Array.isArray(nodeData.keys) ? nodeData.keys as Record<string, unknown>[] : [];
      for (const k of keys) {
        if (!k.key) continue;
        
        const keyStr = k.key2 ? `${k.key2} + ${k.key}` : String(k.key);
        const holdTime = (k.holdTime as number) || 0;
        const delay = (k.delay as number) || 0;
        logToClient(`⌨️ Макрос: ${keyStr} (утримання ${holdTime}мс)`, 'debug');
        
        if (k.key2) {
          await activePage.keyboard.down(String(k.key2));
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        
        await activePage.keyboard.down(String(k.key));
        
        if (holdTime > 0) {
          await new Promise(resolve => setTimeout(resolve, holdTime));
        }
        
        await activePage.keyboard.up(String(k.key));
        
        if (k.key2) {
          await new Promise(resolve => setTimeout(resolve, 20));
          await activePage.keyboard.up(String(k.key2));
        }
        
        if (delay > 0) {
          await smartSleep(delay, ws);
        }
      }
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Keyboard action failed for node ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)));
    logToClient(`❌ Помилка клавіатури: ${errorMessage}`, 'error');
    // Requirement 13.5: Continue execution through error handle path
    return { data: context, nextHandle: ['error'] };
  }
  
  return { data: context };
};
