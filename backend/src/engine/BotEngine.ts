import { Page } from 'playwright';
import WebSocket from 'ws';
import { NodeHandlerParams, NodeResult, NodeData } from '../nodes/types';

export interface EngineParams {
  nodes: any[];
  edges: any[];
  activePage: Page | null;
  ws: WebSocket;
  globalVariables: Record<string, any>;
  broadcastVariables: () => void;
  logToClient: (message: string, type?: 'info' | 'error' | 'success' | 'debug') => void;
  takeDebugSnapshot: (nodeId: string, nodeTitle: string, highlight?: any) => Promise<void>;
  smartSleep: (ms: number, ws: WebSocket) => Promise<void>;
  nodeRuntimeState: Map<string, Record<string, any>>;
  checkRunning: () => boolean;
  nodeHandlers: Record<string, any>;
  onNodeDisplayUpdate?: (nodeId: string, data: any) => void;
  onNodeExecuting?: (nodeId: string, nodeTitle?: string) => void;
  onFinished?: () => void;
}

export interface QueueItem {
  nodeId: string;
  targetHandle?: string;
  context: NodeData;
  delay: number;
}

export class BotEngine {
  private params: EngineParams;
  private executionTimeoutMs = 24 * 60 * 60 * 1000; // 24 години — максимальний час виконання сценарію

  constructor(params: EngineParams) {
    this.params = params;
  }

  /**
   * Запускає виконання сценарію з початкової ноди або черги
   */
  async run(startNodeId?: string, initialContext: NodeData = {}, initialQueue?: QueueItem[]) {
    const { nodes, edges, ws, logToClient, smartSleep, checkRunning } = this.params;
    
    let queue: QueueItem[] = initialQueue || [];
    
    if (!initialQueue && startNodeId) {
      queue.push({ nodeId: startNodeId, context: initialContext, delay: 0 });
    }

    const startTime = Date.now();

    while (queue.length > 0 && Date.now() - startTime <= this.executionTimeoutMs && checkRunning()) {
      const { nodeId, targetHandle, context, delay } = queue.shift()!;

      // 1. Очікування затримки лінії
      if (delay > 0) {
        logToClient(`⏱️ Затримка: ${delay}мс...`, 'debug');
        await smartSleep(delay, ws);
      }

      // 2. Пошук ноди
      const node = nodes.find((n: any) => n.id === nodeId);
      if (!node) continue;

      const nodeTitle = node.data?.label || node.data?.title || node.type;

      // 3. Спеціальна логіка для системних нод контейнера
      if (node.type === 'subExitNode') {
        logToClient(`📦 Вихід із підпрограми досягнуто`, 'success');
        return { context }; // Повертаємо контекст для GroupNode
      }

      // 4. Повідомляємо клієнта про виконання
      if (this.params.onNodeExecuting) {
        this.params.onNodeExecuting(node.id, nodeTitle);
      } else if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'NODE_EXECUTING', nodeId: node.id, nodeTitle }));
      }

      // 5. Виконання логіки ноди
      let result: NodeResult;
      try {
        result = await this.executeNode(node, context, targetHandle);
      } catch (err: any) {
        logToClient(`❌ Помилка у ноді [${nodeTitle}]: ${err.message}`, 'error');
        break;
      }

      if (result.skipNext) continue;

      // 6. Передача сигналу наступним нодам
      const outEdges = edges.filter((e: any) => e.source === nodeId);
      
      for (const edge of outEdges) {
        const sourceHandle = edge.sourceHandle;
        const nextContext = result.data || context;
        const edgeDelay = parseInt(edge.data?.delay || 0);

        const isHardStop = result.nextHandle === null;
        const activeHandles = Array.isArray(result.nextHandle) ? result.nextHandle : [result.nextHandle];
        
        const isMatch = activeHandles.includes(sourceHandle);
        const isNoHandle = result.nextHandle === undefined && !sourceHandle;

        if (!isHardStop && (isMatch || isNoHandle)) {
          queue.push({ 
            nodeId: edge.target, 
            targetHandle: edge.targetHandle, 
            context: nextContext, 
            delay: edgeDelay 
          });
        }
      }

      // Невелика пауза між нодами для запобігання 100% завантаженню CPU
      await smartSleep(50, ws);
    }

    if (Date.now() - startTime > this.executionTimeoutMs) {
      logToClient(`⚠️ Досягнуто ліміт часу виконання (${this.executionTimeoutMs / 1000}с). Можливий нескінченний цикл.`, 'error');
    }

    this.params.onFinished?.();
  }

  /**
   * Виконує обробник конкретної ноди
   */
  async executeNode(node: any, context: NodeData, targetHandle?: string): Promise<NodeResult> {
    const { nodeHandlers, activePage, ws, globalVariables, broadcastVariables, logToClient, takeDebugSnapshot, smartSleep, nodeRuntimeState } = this.params;
    
    const nodeTitle = node.data?.label || node.data?.title || node.type;
    const handler = nodeHandlers[node.type];

    if (!handler) {
      return { data: context };
    }

    const handlerParams: NodeHandlerParams = {
      currentNode: node,
      activePage: activePage as Page, // Приведення типів для сумісності
      ws,
      context,
      nodes: this.params.nodes,
      edges: this.params.edges,
      targetHandle,
      globalVariables,
      broadcastVariables,
      nodeTitle,
      logToClient: (msg, type) => logToClient(`[${nodeTitle}] ${msg}`, type),
      takeDebugSnapshot,
      smartSleep,
      nodeRuntimeState
    };

    const result = await handler(handlerParams);

    // Оновлення UI ноди якщо потрібно
    if (result && result.updateNodeData) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ 
          type: 'UPDATE_NODE_DATA', 
          nodeId: node.id, 
          newData: result.updateNodeData 
        }));
      }
      // Синхронізація з моделлю в пам'яті
      node.data = { ...node.data, ...result.updateNodeData };
      this.params.onNodeDisplayUpdate?.(node.id, result.updateNodeData);
    }

    return result;
  }
}
