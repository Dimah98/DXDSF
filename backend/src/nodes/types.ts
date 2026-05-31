// Типи для системи обробників нод бота
import { Page } from 'playwright';
import WebSocket from 'ws';

// ─── Стандарт передачі даних між нодами ───────────────────────────────────────
// Кожна нода отримує NodeData на вхід та повертає NodeData у полі data результату
// ВАЖЛИВО: nextHandle НІКОЛИ не потрапляє у context наступної ноди

export interface NodeData {
  value?:    number | string | null;   // Основне значення (для Вивід, Порівняння)
  text?:     string;                   // Текстовий результат (Сканер)
  num?:      number;                   // Числовий результат (Сканер)
  coords?:   { x: number; y: number }; // Координати (Сканер, Пошук картинки)
  count?:    number;                   // Кількість (Сканер, Цикл)
  children?: any[];                    // Список дочірніх елементів (Сканер)
  images?:   string[];                 // Список зображень (Сканер)
  raw?:      any;                      // Сирі дані без обробки (API відповідь)
  [key: string]: any;                  // Довільні додаткові поля (для розширення)
}

// Результат що повертає кожен обробник ноди
export interface NodeResult {
  nextHandle?:     string | (string | null | undefined)[] | null;      // Який вихід активувати (null = жорстка зупинка)
  data?:           NodeData;           // Дані для наступної ноди (ТІЛЬКИ сюди!)
  updateNodeData?: Record<string,any>; // Оновити UI ноди (не передається далі)
  skipNext?:       boolean;            // Пропустити наступну ноду в черзі
}

// ─── Параметри обробника ноди ─────────────────────────────────────────────────

export interface NodeHandlerParams {
  currentNode:  any;         // Поточна нода (тип, дані, id)
  activePage:   Page;        // Активна сторінка Playwright
  ws:           WebSocket;   // WebSocket клієнт
  context:      NodeData;    // Дані від попередньої ноди (NodeData, не забруднені)
  nodes:        any[];       // Всі ноди поточного сценарію
  edges:        any[];       // Всі ребра поточного сценарію
  targetHandle?: string;     // На який вхідний порт прийшов сигнал
  globalVariables: Record<string, any>;  // Глобальна пам'ять
  projectName:  string;      // Назва поточного проекту (передається напряму з запуску)
  nodeTitle:    string;      // Назва ноди для логів
  logToClient:  (message: string, type?: 'info' | 'error' | 'success' | 'debug') => void;
  takeDebugSnapshot: (nodeId: string, nodeTitle: string, highlight?: any) => Promise<void>;
  smartSleep:   (ms: number, ws: WebSocket) => Promise<void>;
  broadcastVariables: () => void;
  nodeRuntimeState: Map<string, Record<string, any>>; // Персистентний стан між ітераціями
}

// Тип обробника ноди — тепер явно повертає NodeResult
export type NodeHandler = (params: NodeHandlerParams) => Promise<NodeResult>;
