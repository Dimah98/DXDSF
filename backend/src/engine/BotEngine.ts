import { Page } from 'playwright';
import WebSocket from 'ws';
import { NodeHandlerParams, NodeResult, NodeData, NodeHandler } from '../nodes/types';
import { BaseNode, BaseEdge } from '@sf/shared-types';

export interface EngineParams {
  nodes: BaseNode[];
  edges: BaseEdge[];
  activePage: Page | null;
  ws: WebSocket;
  globalVariables: Record<string, unknown>;
  projectName: string;
  broadcastVariables: () => void;
  logToClient: (message: string, type?: 'info' | 'error' | 'success' | 'debug', data?: unknown) => void;
  takeDebugSnapshot: (nodeId: string, nodeTitle: string, highlight?: unknown) => Promise<void>;
  smartSleep: (ms: number, ws: WebSocket) => Promise<void>;
  nodeRuntimeState: Map<string, Record<string, unknown>>;
  checkRunning: () => boolean;
  verboseLogs?: boolean;
  nodeHandlers: Record<string, unknown>;
  onNodeDisplayUpdate?: (nodeId: string, data: Record<string, unknown>) => void;
  onNodeExecuting?: (nodeId: string, nodeTitle?: string) => void;
  onFinished?: (status: 'success' | 'error' | 'stopped', errorMessage?: string) => void;
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
  private static readonly MAX_QUEUE_SIZE = 1000; // Максимальний розмір черги нод для запобігання витокам пам'яті

  constructor(params: EngineParams) {
    this.params = params;
  }

  /**
   * Запускає виконання сценарію з початкової ноди або черги
   */
  async run(startNodeId?: string, initialContext: NodeData = {}, initialQueue?: QueueItem[]): Promise<{ context: NodeData; status: 'success' | 'error' | 'stopped'; error?: string } | undefined> {
    const { nodes, edges, ws, logToClient, smartSleep, checkRunning } = this.params;
    const verbose = this.params.verboseLogs !== false;
    
    // Попередня оптимізація: будуємо індекси Map для O(1) пошуку нод та вихідних ребер
    const nodeMap = new Map<string, BaseNode>();
    for (const n of nodes) {
      nodeMap.set(n.id, n);
    }

    const outEdgesMap = new Map<string, BaseEdge[]>();
    for (const e of edges) {
      const list = outEdgesMap.get(e.source);
      if (list) {
        list.push(e);
      } else {
        outEdgesMap.set(e.source, [e]);
      }
    }

    let queue: QueueItem[] = initialQueue || [];
    
    if (!initialQueue) {
      const resolvedStartId = startNodeId || nodes.find((n: BaseNode) => n.type === 'startNode' || n.type === 'subEntryNode')?.id;
      if (resolvedStartId) {
        queue.push({ nodeId: resolvedStartId, context: initialContext, delay: 0 });
      } else {
        logToClient('❌ Стартову ноду не знайдено', 'error');
        if (this.params.onFinished) this.params.onFinished('error', 'Стартову ноду не знайдено');
        return { context: initialContext, status: 'error', error: 'Стартову ноду не знайдено' };
      }
    }

    const startTime = Date.now();
    let executionStatus: 'success' | 'error' | 'stopped' = 'success';
    let executionError: string | undefined = undefined;
    let lastContext: NodeData = initialContext;

    // Список типів легких обчислювальних нод, які не потребують 50мс паузи
    const fastNodeTypes = new Set([
      'calculatorNode', 'variableNode', 'valueLoopNode', 'compareNode', 
      'multiLogicNode', 'commentNode', 'gateNode', 'displayNode', 'infoNode'
    ]);

    while (queue.length > 0 && Date.now() - startTime <= this.executionTimeoutMs && checkRunning()) {
      const { nodeId, targetHandle, context, delay } = queue.shift()!;
      lastContext = context;

      // 1. Очікування затримки лінії
      if (delay > 0) {
        logToClient(`⏱️ Затримка: ${delay}мс...`, 'debug');
        await smartSleep(delay, ws);
      }

      // 2. Пошук ноди O(1)
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const nodeTitle: string = String(node.data?.label || node.data?.title || node.type || '');

      // 3. Спеціальна логіка для системних нод контейнера
      if (node.type === 'subExitNode') {
        logToClient(`📦 Вихід із підпрограми досягнуто`, 'success');
        return { context, status: 'success' }; // Повертаємо контекст для GroupNode
      }

      // 4. Повідомляємо клієнта про виконання
      if (this.params.onNodeExecuting) {
        this.params.onNodeExecuting(node.id, nodeTitle || undefined);
      } else if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'NODE_EXECUTING', nodeId: node.id, nodeTitle: nodeTitle || undefined }));
      }

      // 4.5 Детальний лог старту ноди (що нода отримала на вхід)
      if (verbose) {
        logToClient(
          `[${nodeTitle}] ▶️ Старт • тип: ${node.type}${targetHandle ? ` • вхід: ${targetHandle}` : ''}`,
          'debug',
          this.summarizeData(context)
        );
      }

      // 5. Виконання логіки ноди
      let result: NodeResult;
      const startedAt = Date.now();
      try {
        result = await this.executeNode(node, context, targetHandle);
        if (result.data) {
          lastContext = result.data;
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logToClient(`❌ Помилка у ноді [${nodeTitle}]: ${errorMessage}`, 'error');
        executionStatus = 'error';
        executionError = errorMessage;
        break;
      }
      const durationMs = Date.now() - startedAt;

      // 5.5 Детальний лог: нода зупинила сигнал у собі
      if (result.skipNext) {
        if (verbose) logToClient(`[${nodeTitle}] ⏹️ Сигнал зупинено в ноді • ${durationMs}мс`, 'debug', this.summarizeData(result.data));
        continue;
      }

      // 6. Передача сигналу наступним нодам O(1)
      const outEdges = outEdgesMap.get(nodeId) || [];
      const routedTitles: string[] = []; // Куди пішов сигнал — для детального логу

      for (const edge of outEdges) {
        const sourceHandle = edge.sourceHandle;
        const nextContext = result.data || context;
        const edgeDelay = parseInt(String(edge.data?.delay || 0), 10);

        const isHardStop = result.nextHandle === null;
        const activeHandles = Array.isArray(result.nextHandle) ? result.nextHandle : [result.nextHandle];
        
        // Якщо nextHandle точно збігається з sourceHandle — сигнал іде (isMatch)
        // Також якщо у ребра немає sourceHandle (старі з'єднання або ноди всередині контейнера),
        // але нода віддає стандартний вихід ('out', 'next', 'success'), сигнал пропускаємо далі
        const isMatch = result.nextHandle !== undefined && (
          activeHandles.includes(sourceHandle) ||
          (!sourceHandle && (activeHandles.includes('out') || activeHandles.includes('next') || activeHandles.includes('success')))
        );
        // Якщо nextHandle взагалі не задано (undefined) — сигнал іде по всіх вихідних ребрах
        const isNoHandle = result.nextHandle === undefined;

        if (!isHardStop && (isMatch || isNoHandle)) {
          // Перевіряємо ліміт черги перед додаванням
          if (queue.length >= BotEngine.MAX_QUEUE_SIZE) {
            logToClient(`⚠️ Черга нод переповнена (${queue.length}/${BotEngine.MAX_QUEUE_SIZE}), пропускаємо ноду`, 'error');
            continue;
          }
          queue.push({ 
            nodeId: edge.target, 
            targetHandle: edge.targetHandle, 
            context: nextContext, 
            delay: edgeDelay 
          });
          const targetNode = nodeMap.get(edge.target);
          const targetTitle: string = String(targetNode?.data?.label || targetNode?.data?.title || targetNode?.type || edge.target || '');
          routedTitles.push(sourceHandle ? `${targetTitle} (${sourceHandle})` : targetTitle);
        }
      }

      // 6.5 Детальний лог завершення ноди (скільки тривало, куди пішов сигнал, що віддала)
      if (verbose) {
        let routeInfo: string;
        if (result.nextHandle === null) routeInfo = '⛔ зупинка гілки';
        else if (routedTitles.length) routeInfo = `→ ${routedTitles.join(', ')}`;
        else routeInfo = '• далі підключень немає';
        logToClient(`[${nodeTitle}] 🏁 ${durationMs}мс ${routeInfo}`, 'debug', this.summarizeData(result.data));
      }

      // Для важких DOM дій робимо невелику паузу, а для швидких обчислень передаємо квант подій
      if (!fastNodeTypes.has(node.type)) {
        await smartSleep(30, ws);
      }
    }

    if (!checkRunning() && executionStatus === 'success') {
      executionStatus = 'stopped';
      executionError = 'Зупинено користувачем';
    } else if (Date.now() - startTime > this.executionTimeoutMs) {
      logToClient(`⚠️ Досягнуто ліміт часу виконання (${this.executionTimeoutMs / 1000}с). Можливий нескінченний цикл.`, 'error');
      executionStatus = 'error';
      executionError = `Досягнуто ліміт часу виконання (${this.executionTimeoutMs / 1000}с)`;
    }

    this.params.onFinished?.(executionStatus, executionError);
    return { context: lastContext, status: executionStatus, error: executionError };
  }

  /**
   * Готує компактний зріз даних ноди для консолі (лише значущі поля),
   * щоб не засмічувати лог великими об'єктами.
   */
  private summarizeData(data?: NodeData): Record<string, unknown> | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const out: Record<string, unknown> = {};
    if (data.value !== undefined) out.value = data.value;
    if (data.text !== undefined) out.text = data.text;
    if (data.num !== undefined) out.num = data.num;
    if (data.coords !== undefined) out.coords = data.coords;
    if (data.count !== undefined) out.count = data.count;
    if (Array.isArray(data.children)) out.children = data.children.length;
    if (Array.isArray(data.images)) out.images = data.images.length;
    if (data.raw !== undefined) out.raw = typeof data.raw === 'object' ? '[об\'єкт]' : data.raw;
    return Object.keys(out).length ? out : undefined;
  }

  /**
   * Виконує обробник конкретної ноди
   */
  async executeNode(node: BaseNode, context: NodeData, targetHandle?: string): Promise<NodeResult> {
    const { nodeHandlers, activePage, ws, globalVariables, broadcastVariables, logToClient, takeDebugSnapshot, smartSleep, nodeRuntimeState } = this.params;
    
    const nodeTitle: string = String(node.data?.label || node.data?.title || node.type || '');
    const handler = nodeHandlers[node.type] as NodeHandler | undefined;

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
      projectName: this.params.projectName, // Передаємо назву проекту напряму в склад параметрів ноди
      broadcastVariables,
      nodeTitle,
      logToClient: (msg, type, logData) => logToClient(`[${nodeTitle}] ${msg}`, type, logData),
      takeDebugSnapshot,
      smartSleep,
      nodeRuntimeState,
      checkRunning: this.params.checkRunning // Передаємо функцію перевірки статусу запуску бота в параметри ноди
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
