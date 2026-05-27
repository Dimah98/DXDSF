import { Logger } from '../logger';
import { NodeHandlerParams } from './types';

const logger = new Logger('MultiScanNode');

export const multiScanNodeHandler = async ({ currentNode, activePage, ws, logToClient, context }: NodeHandlerParams) => {
  let nodeResults: Record<string, any> = { data: context };
  const items = currentNode.data.scanItems || [];
  
  if (items.length === 0) {
    nodeResults.nextHandle = 'fail';
    return nodeResults;
  }

  logToClient(`🔍 MultiScan: Пошук по ${items.length} елементах...`, 'debug');

  // Requirement 13.1: Wrap async operations in try-catch with logging
  let result: any = null;
  try {
    // Виконуємо масовий пошук одним запитом до браузера для максимальної швидкості
    result = await activePage.evaluate(({ scanItems }: any) => {
      for (let i = 0; i < scanItems.length; i++) {
        const item = scanItems[i];
        if (!item.selector) continue;
        
        const el = document.querySelector(item.selector);
        if (!el) continue;

        const text = (el as HTMLElement).innerText || "";
        const numMatch = text.match(/(\d+(?:\.\d+)?)/);
        const num = numMatch ? parseFloat(numMatch[1]) : NaN;
        
        let met = false;
        const cond = item.condition;
        const val = item.value;

        if (cond === 'exists') met = true;
        else if (cond === 'contains') met = text.includes(val);
        else if (cond === 'equals') met = text.trim() === val.trim();
        else if (cond === '>') met = !isNaN(num) && num > parseFloat(val);
        else if (cond === '<') met = !isNaN(num) && num < parseFloat(val);

        if (met) {
          const r = el.getBoundingClientRect();
          return { 
            index: i,
            selector: item.selector,
            x: Math.round(r.left + window.scrollX + r.width/2), 
            y: Math.round(r.top + window.scrollY + r.height/2), 
            text, 
            num 
          };
        }
      }
      return null;
    }, { scanItems: items });
  } catch (err: any) {
    // Requirement 13.1: Log the error
    logger.error(`MultiScan evaluate failed for node ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)));
    logToClient(`❌ MultiScan помилка: ${err.message || String(err)}`, 'error');
    // Requirement 13.5: Continue execution through error handle path
    nodeResults.nextHandle = 'fail';
    try {
      ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { status: 'Помилка' } }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DATA_UPDATE for node ${currentNode.id}`, { error: String(sendErr) });
    }
    return nodeResults;
  }

  if (result) {
    nodeResults.data = { ...context, coords: { x: result.x, y: result.y }, text: result.text, num: result.num, value: result.text || result.num };
    nodeResults.nextHandle = ['success', 'coords'];
    
    // Requirement 13.2: Wrap ws.send in try-catch
    try {
      ws.send(JSON.stringify({ 
        type: 'NODE_DATA_UPDATE', 
        nodeId: currentNode.id, 
        data: { status: `✅ Знайдено #${result.index + 1}`, lastFound: result.selector } 
      }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DATA_UPDATE for node ${currentNode.id}`, { error: String(sendErr) });
    }
    
    logToClient(`✅ MultiScan: Знайдено #${result.index + 1} (${result.selector})`, 'success');
  } else {
    nodeResults.nextHandle = 'fail';
    try {
      ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { status: 'Не знайдено' } }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DATA_UPDATE for node ${currentNode.id}`, { error: String(sendErr) });
    }
    logToClient(`❌ MultiScan: Нічого не знайдено`, 'error');
  }
  
  return nodeResults;
};
