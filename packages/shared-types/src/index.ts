// Shared TypeScript types for Sunflower Land Bot Constructor
// This package contains types used by both frontend and backend

// ============================================================================
// WebSocket Types
// ============================================================================

/**
 * WebSocket messages from backend to frontend
 */
export type WSResponse =
  | { type: 'BOT_RUNNING_STATE'; isRunning: boolean }
  | { type: 'BOT_FINISHED' }
  | { type: 'NODE_EXECUTING'; nodeId: string; nodeTitle?: string }
  | { type: 'NODE_DATA_UPDATE'; nodeId: string; data: unknown }
  | { type: 'GLOBAL_VARIABLES_UPDATE'; variables: Record<string, unknown> }
  | { type: 'CONSOLE_LOG'; message: string; logType: 'info' | 'error' | 'success' | 'debug' }
  | { type: 'STREAM_FRAME'; frame: string }
  | { type: 'SELECTOR_INFO_PICKED'; nodeId: string; selector: string }
  | { type: 'CSRF_TOKEN'; token: string };

/**
 * WebSocket messages from frontend to backend
 */
export type WSMessage =
  | { type: 'RUN_BOT'; node: unknown; nodes: unknown[]; edges: unknown[] }
  | { type: 'STOP_BOT' }
  | { type: 'RUN_SINGLE_NODE'; nodeId: string; nodes: unknown[]; edges: unknown[] }
  | { type: 'UPDATE_VARIABLE'; name: string; value: unknown }
  | { type: 'START_STREAM' }
  | { type: 'STOP_STREAM' }
  | { type: 'PICK_SELECTOR'; nodeId: string; pickType?: string }
  | { type: 'CANCEL_PICKER' };

/**
 * Type guard to validate WebSocket message structure
 */
export function isWSMessage(msg: unknown): msg is WSMessage {
  if (!msg || typeof msg !== 'object' || typeof (msg as any).type !== 'string') {
    return false;
  }

  const type = (msg as WSMessage).type;

  switch (type) {
    case 'RUN_BOT':
      return (msg as any).node !== undefined && Array.isArray((msg as any).nodes) && Array.isArray((msg as any).edges);
    case 'STOP_BOT':
      return true;
    case 'RUN_SINGLE_NODE':
      return typeof (msg as any).nodeId === 'string' && Array.isArray((msg as any).nodes) && Array.isArray((msg as any).edges);
    case 'UPDATE_VARIABLE':
      return typeof (msg as any).name === 'string' && (msg as any).value !== undefined;
    case 'START_STREAM':
    case 'STOP_STREAM':
    case 'CANCEL_PICKER':
      return true;
    case 'PICK_SELECTOR':
      return typeof (msg as any).nodeId === 'string';
    default:
      return false;
  }
}

// ============================================================================
// Node Types
// ============================================================================

/**
 * Base data structure passed between nodes
 */
export interface NodeData {
  value?: number | string | null;
  text?: string;
  num?: number;
  coords?: { x: number; y: number };
  count?: number;
  children?: unknown[];
  images?: string[];
  raw?: unknown;
  [key: string]: unknown;
}

/**
 * Result returned by each node handler
 */
export interface NodeResult {
  nextHandle?: string | (string | null | undefined)[] | null;
  data?: NodeData;
  updateNodeData?: Record<string, unknown>;
  skipNext?: boolean;
}

/**
 * All possible node types
 */
export type NodeType =
  | 'startNode'
  | 'browserNode'
  | 'actionNode'
  | 'infoNode'
  | 'displayNode'
  | 'variableNode'
  | 'apiNode'
  | 'configNode'
  | 'compareNode'
  | 'gateNode'
  | 'delayNode'
  | 'randomDelayNode'
  | 'cooldownNode'
  | 'keyboardNode'
  | 'coordClickNode'
  | 'coordOffsetNode'
  | 'searchInNode'
  | 'selectorCheckNode'
  | 'visualSearchNode'
  | 'imageSearchNode'
  | 'searchAndClickNode'
  | 'multiScanNode'
  | 'screenshotNode'
  | 'notifyNode'
  | 'setNextRunNode'
  | 'valueLoopNode'
  | 'multiLogicNode'
  | 'eventVariationsNode'
  | 'calculatorNode'
  | 'groupNode'
  | 'subEntryNode'
  | 'subExitNode'
  | 'commentNode'
  | 'memoryGameNode'
  | 'whackAMoleNode'
  | 'firePitNode'
  | 'kitchenNode'
  | 'deliNode'
  | 'smoothieShackNode'
  | 'bakeryNode'
  | 'inventoryScannerNode'
  | 'cropAnalyzerNode'
  | 'rotatorNode'
  | 'nestedCheckNode'
  | 'textInputNode'
  | 'escNode';

/**
 * Base interface for all nodes
 */
export interface BaseNode {
  id: string;
  type: NodeType;
  data: Record<string, unknown>;
  position: { x: number; y: number };
}

/**
 * Base interface for all edges
 */
export interface BaseEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// Config Types
// ============================================================================

/**
 * Configuration rule for conditional logic
 */
export interface ConfigRule {
  id: string;
  file: string;
  path: string;
  operator: string;
  value?: unknown;
  rightType?: 'value' | 'path';
  rightPath?: string;
  rightFile?: string;
  required?: boolean;
  outputVar?: string;
}

/**
 * Saved configuration with nested sub-configurations
 */
export interface SavedConfig {
  id: string;
  name: string;
  enabled: boolean;
  rules: ConfigRule[];
  subConfigs?: SavedConfig[];
}

// ============================================================================
// Project Types
// ============================================================================

/**
 * Project metadata and structure
 */
export interface ProjectMetadata {
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: BaseNode[];
  edges: BaseEdge[];
  globalVariables: Record<string, unknown>;
  launchSettings?: Record<string, unknown>;
  browserSettings?: Record<string, unknown>;
}

// ============================================================================
// Inventory Scanner Types
// ============================================================================

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
