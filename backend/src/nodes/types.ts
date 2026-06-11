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
  logToClient:  (message: string, type?: 'info' | 'error' | 'success' | 'debug', data?: any) => void;
  takeDebugSnapshot: (nodeId: string, nodeTitle: string, highlight?: any) => Promise<void>;
  smartSleep:   (ms: number, ws: WebSocket) => Promise<void>;
  broadcastVariables: () => void;
  nodeRuntimeState: Map<string, Record<string, any>>; // Персистентний стан між ітераціями
}

// Тип обробника ноди — тепер явно повертає NodeResult
export type NodeHandler = (params: NodeHandlerParams) => Promise<NodeResult>;

// ─── Inventory Scanner Types ──────────────────────────────────────────────────

/**
 * Represents a single inventory item extracted from the web page
 */
export interface ScanResult {
  /** Image URL (absolute or relative) or base64-encoded image data */
  image: string;
  
  /** Numeric value extracted from element text content */
  number: number;
  
  /** Optional: CSS selector that matched this element (for debugging) */
  selector?: string;
  
  /** Optional: Element coordinates on page (for debug snapshots) */
  coords?: { x: number; y: number };
}

/**
 * Configuration stored in InventoryScannerNode.data
 */
export interface InventoryScannerNodeData {
  /** Node display label */
  label: string;
  
  /** CSS selector for target elements */
  selector: string;
  
  /** Optional: Container selector to limit search scope */
  containerSelector?: string;
  
  /** Scanning mode */
  mode: 'first' | 'all';
  
  /** Image extraction strategy */
  imageSource: 'src' | 'background' | 'auto';
  
  /** Custom regex for number extraction (default: /(\d+(?:\.\d+)?)/) */
  numberRegex?: string;
  
  /** UI state data (not used in execution) */
  status?: string;
  lastScanCount?: number;
  lastScanTime?: number;
}

/**
 * Output from InventoryScannerNode that extends NodeData
 */
export interface InventoryScannerOutput extends NodeData {
  /** Array of scanned inventory items */
  inventoryResults: ScanResult[];
  
  /** Number of items found */
  count: number;
}

/**
 * Persistent storage format for inventory data
 */
export interface InventoryFile {
  /** Project identifier */
  projectName: string;
  
  /** Array of scanned items */
  data: ScanResult[];
  
  /** Unix timestamp of last scan */
  timestamp: number;
  
  /** Schema version for backward compatibility */
  version: string;
  
  /** Optional: Scan metadata */
  metadata?: {
    selector: string;
    itemCount: number;
    scanDuration: number;
  };
}
