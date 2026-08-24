// Типи для системи обробників нод бота
import { Page } from 'playwright';
import WebSocket from 'ws';
import { BaseNode, BaseEdge, NodeData as SharedNodeData, NodeResult as SharedNodeResult } from '@sf/shared-types';

// ─── Стандарт передачі даних між нодами ───────────────────────────────────────
// Кожна нода отримує NodeData на вхід та повертає NodeData у полі data результату
// ВАЖЛИВО: nextHandle НІКОЛИ не потрапляє у context наступної ноди

export interface NodeData extends SharedNodeData {}

export interface NodeResult extends SharedNodeResult {}

// ─── Параметри обробника ноди ─────────────────────────────────────────────────

export interface NodeHandlerParams {
  currentNode:  BaseNode;
  activePage:   Page;
  ws:           WebSocket;
  context:      NodeData;
  nodes:        BaseNode[];
  edges:        BaseEdge[];
  targetHandle?: string;
  globalVariables: Record<string, unknown>;
  projectName:  string;
  nodeTitle:    string;
  logToClient:  (message: string, type?: 'info' | 'error' | 'success' | 'debug', data?: unknown) => void;
  takeDebugSnapshot: (nodeId: string, nodeTitle: string, highlight?: unknown) => Promise<void>;
  smartSleep:   (ms: number, ws: WebSocket) => Promise<void>;
  broadcastVariables: () => void;
  nodeRuntimeState: Map<string, Record<string, unknown>>;
  checkRunning: () => boolean;
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
