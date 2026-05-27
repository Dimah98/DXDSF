import { Logger } from '../logger';
import { BotEngine } from '../engine/BotEngine';
import { nodeHandlers } from './index';
import { getOrCreateSession } from '../browserManager';

const logger = new Logger('GroupNode');

export const groupNodeHandler = async ({
  currentNode,
  activePage,
  ws,
  context,
  globalVariables,
  broadcastVariables,
  logToClient,
  takeDebugSnapshot,
  smartSleep,
  nodeRuntimeState,
}: any): Promise<any> => {
  const subNodes: any[] = currentNode.data?.subNodes || [];
  const subEdges: any[] = currentNode.data?.subEdges || [];
  const groupLabel = currentNode.data?.label || 'Контейнер';

  logger.debug(`Running group "${groupLabel}"`, { nodeId: currentNode.id, subNodeCount: subNodes.length, subEdgeCount: subEdges.length });

  logToClient(`📦 [${groupLabel}] Запуск підпрограми (${subNodes.length} нод)`, 'debug');

  const entryNode = subNodes.find((n: any) => n.type === 'subEntryNode');
  if (!entryNode) {
    logger.error(`No subEntryNode found in group ${currentNode.id}`);
    logToClient(`❌ [${groupLabel}] Не знайдено вхідної ноди (subEntryNode)!`, 'error');
    return { nextHandle: 'out', data: context };
  }

  logger.debug(`Entry node found for group "${groupLabel}"`, { entryNodeId: entryNode.id });

  const projectName = (ws as any).projectName || 'default'; // Визначаємо назву поточного проекту з WebSocket
  const session = getOrCreateSession(projectName); // Отримуємо відповідну сесію для перевірки стану

  const engine = new BotEngine({
    nodes: subNodes,
    edges: subEdges,
    activePage,
    ws,
    globalVariables,
    broadcastVariables,
    logToClient: (msg, type) => logToClient(`  ↳ ${msg}`, type),
    takeDebugSnapshot,
    smartSleep,
    nodeRuntimeState,
    nodeHandlers,
    checkRunning: () => (ws as any).isSingleNodeRun ? (ws as any).isBotRunning : session.isBotRunning, // Перевіряємо, чи продовжує працювати бот для поточного проекту
    onNodeDisplayUpdate: (nodeId, data) => {
      try {
        ws.send(JSON.stringify({
          type: 'NODE_DATA_UPDATE',
          nodeId: currentNode.id,
          data: { activeNodeLabel: subNodes.find((n: any) => n.id === nodeId)?.data?.label || '...', activeNodeId: nodeId }
        }));
      } catch (sendErr) {
        logger.warn(`Failed to send NODE_DATA_UPDATE for group node ${currentNode.id}`, { error: String(sendErr) });
      }
    },
    onNodeExecuting: (nodeId, nodeTitle) => {
      try {
        ws.send(JSON.stringify({ 
          type: 'NODE_EXECUTING', 
          nodeId: nodeId, 
          nodeTitle: `[${groupLabel}] ${nodeTitle}`,
          parentGroupId: currentNode.id 
        }));
      } catch (sendErr) {
        logger.warn(`Failed to send NODE_EXECUTING for group node ${currentNode.id}`, { error: String(sendErr) });
      }
    }
  });

  // Requirement 13.1: Wrap async operations in try-catch with logging
  let result: any;
  try {
    // Запускаємо внутрішній граф
    result = await engine.run(entryNode.id, context);
  } catch (err: any) {
    // Requirement 13.1: Log the error
    logger.error(`Group engine run failed for node ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)), { groupLabel });
    logToClient(`❌ [${groupLabel}] Помилка підпрограми: ${err.message || String(err)}`, 'error');
    // Requirement 13.5: Continue execution through error handle path
    return { nextHandle: 'out', data: context };
  }

  logToClient(`📦 [${groupLabel}] Підпрограма завершена ✓`, 'success');

  // Очищаємо статус активної ноди в UI
  try {
    ws.send(JSON.stringify({
      type: 'NODE_DATA_UPDATE',
      nodeId: currentNode.id,
      data: { activeNodeLabel: null, activeNodeId: null },
    }));
  } catch (sendErr) {
    logger.warn(`Failed to send NODE_DATA_UPDATE cleanup for group node ${currentNode.id}`, { error: String(sendErr) });
  }

  return { nextHandle: 'out', data: result?.context || context };
};

