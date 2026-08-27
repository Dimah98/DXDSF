import { Logger } from '../logger';
import { BotEngine } from '../engine/BotEngine';
import { nodeHandlers } from './index';
import { getOrCreateSession } from '../browserManager';
import { ConfigStore } from '../configs/ConfigStore';
import { evaluateConfig, loadConfigFiles } from '../configs/ConfigEvaluator';
import { NodeHandlerParams, NodeResult, NodeData } from './types';

const logger = new Logger('GroupNode');

export const groupNodeHandler = async ({
  currentNode,
  activePage,
  ws,
  context,
  globalVariables,
  projectName,
  broadcastVariables,
  logToClient,
  takeDebugSnapshot,
  smartSleep,
  nodeRuntimeState,
}: NodeHandlerParams): Promise<NodeResult> => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const subNodes = Array.isArray(nodeData.subNodes) ? nodeData.subNodes : [];
  const subEdges = Array.isArray(nodeData.subEdges) ? nodeData.subEdges : [];
  const groupLabel = (nodeData.label as string) || 'Контейнер';
  const configId = nodeData.configId as string | undefined;

  // ── Якщо вказана конфігурація — оцінюємо перед запуском ──
  if (configId) {
    const config = ConfigStore.getById(configId);
    if (!config) {
      logToClient(`❌ [${groupLabel}] Конфігурацію ${configId} не знайдено — пропускаємо контейнер`, 'error');
      return { nextHandle: 'out', data: context };
    }

    if (config.enabled === false) {
      logToClient(`🚫 [${groupLabel}] Конфіг «${config.name}» ВИМКНЕНО — пропускаємо контейнер`, 'error');
      return { nextHandle: 'out', data: context };
    }

    // Оцінюємо конфігурацію так само, як ConfigNode — з читанням файлів
    const fileCache = loadConfigFiles(config, projectName, logToClient);
    const extractedVars: Record<string, unknown> = {};
    const filesToSave = new Set<string>();

    const finalResult = evaluateConfig(config, projectName, fileCache, filesToSave, extractedVars, globalVariables, logToClient);

    // Note: we intentionally do NOT save files here (GroupNode is read-only check)
    // If read_delete rules need to persist, use ConfigNode instead

    logToClient(`${finalResult ? '✅' : '❌'} [${groupLabel}] Конфіг «${config.name}» → ${finalResult ? 'TRUE' : 'FALSE'}`, finalResult ? 'success' : 'error');

    if (!finalResult) {
      logToClient(`⏭️ [${groupLabel}] Конфіг FALSE — пропускаємо контейнер, сигнал йде далі`, 'info');
      return { nextHandle: 'out', data: context };
    }

    logToClient(`▶️ [${groupLabel}] Конфіг TRUE — запускаємо контейнер`, 'success');
  }

  logger.debug(`Running group "${groupLabel}"`, { nodeId: currentNode.id, subNodeCount: subNodes.length, subEdgeCount: subEdges.length });

  logToClient(`📦 [${groupLabel}] Запуск підпрограми (${subNodes.length} нод)`, 'debug');

  const entryNode = subNodes.find((n: Record<string, unknown>) => n.type === 'subEntryNode');
  if (!entryNode) {
    logger.error(`No subEntryNode found in group ${currentNode.id}`);
    logToClient(`❌ [${groupLabel}] Не знайдено вхідної ноди (subEntryNode)!`, 'error');
    return { nextHandle: 'out', data: context };
  }

  logger.debug(`Entry node found for group "${groupLabel}"`, { entryNodeId: entryNode.id });

  const session = getOrCreateSession(projectName);

  const engine = new BotEngine({
    nodes: subNodes,
    edges: subEdges,
    activePage,
    ws,
    globalVariables,
    projectName,
    broadcastVariables,
    logToClient: (msg, type) => logToClient(`  ↳ ${msg}`, type),
    takeDebugSnapshot,
    smartSleep,
    nodeRuntimeState,
    nodeHandlers,
    checkRunning: () => (ws as any).isSingleNodeRun ? (ws as any).isBotRunning : session.isBotRunning,
    onNodeDisplayUpdate: (nodeId) => {
      try {
        ws.send(JSON.stringify({
          type: 'NODE_DATA_UPDATE',
          nodeId: currentNode.id,
          data: { activeNodeLabel: subNodes.find((n: Record<string, unknown>) => n.id === nodeId)?.data?.label || '...', activeNodeId: nodeId }
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

  let result: { context: NodeData; status: 'success' | 'error' | 'stopped'; error?: string } | undefined;
  try {
    result = await engine.run(entryNode.id, context);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Group engine run failed for node ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)), { groupLabel });
    logToClient(`❌ [${groupLabel}] Помилка підпрограми: ${errorMessage}`, 'error');
    return { nextHandle: 'out', data: context };
  }

  if (result?.status === 'error') {
    logToClient(`⚠️ [${groupLabel}] Підпрограма перервана через помилку: ${result.error || 'невідома помилка'}`, 'error');
  } else if (result?.status === 'stopped') {
    logToClient(`🛑 [${groupLabel}] Підпрограму зупинено`, 'info');
  } else {
    logToClient(`📦 [${groupLabel}] Підпрограма завершена ✓`, 'success');
  }

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
