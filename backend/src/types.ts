/**
 * TypeScript Type Definitions for Sunflower Land Bot Constructor
 * 
 * This file contains all type definitions for:
 * - WebSocket messages (discriminated unions)
 * - API requests and responses
 * - Enhanced ProjectSession interface with lifecycle fields
 * - Middleware and service component interfaces
 * 
 * Requirements: 22, 23
 */

import { Browser, BrowserContext, Page } from 'playwright';
import WebSocket from 'ws';
import { Request, Response, NextFunction } from 'express';

// ═══════════════════════════════════════════════════════════════════════════
// WebSocket Message Types (Discriminated Unions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Discriminated union type for all WebSocket messages from client to server
 * Requirement 22: TypeScript Type Safety for WebSocket Messages
 */
export type WSMessage =
  | { type: 'RUN_BOT'; node: any; nodes: any[]; edges: any[] }
  | { type: 'STOP_BOT' }
  | { type: 'RUN_SINGLE_NODE'; nodeId: string; nodes: any[]; edges: any[] }
  | { type: 'UPDATE_VARIABLE'; name: string; value: any }
  | { type: 'START_STREAM' }
  | { type: 'STOP_STREAM' }
  | { type: 'PICK_SELECTOR'; nodeId: string; pickType?: string }
  | { type: 'CANCEL_PICKER' };

/**
 * Discriminated union type for all WebSocket responses from server to client
 * Requirement 22: TypeScript Type Safety for WebSocket Messages
 */
export type WSResponse =
  | { type: 'BOT_RUNNING_STATE'; isRunning: boolean }
  | { type: 'BOT_FINISHED' }
  | { type: 'NODE_EXECUTING'; nodeId: string; nodeTitle?: string }
  | { type: 'NODE_DATA_UPDATE'; nodeId: string; data: any }
  | { type: 'GLOBAL_VARIABLES_UPDATE'; variables: Record<string, any> }
  | { type: 'CONSOLE_LOG'; message: string; logType: 'info' | 'error' | 'success' | 'debug' }
  | { type: 'STREAM_FRAME'; frame: string }
  | { type: 'SELECTOR_INFO_PICKED'; nodeId: string; selector: string }
  | { type: 'CSRF_TOKEN'; token: string };

/**
 * Type guard to validate WebSocket message structure
 * Requirement 22: Use type guards to validate WebSocket message structure
 */
export function isWSMessage(msg: any): msg is WSMessage {
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
    return false;
  }

  switch (msg.type) {
    case 'RUN_BOT':
      return msg.node !== undefined && Array.isArray(msg.nodes) && Array.isArray(msg.edges);
    case 'STOP_BOT':
      return true;
    case 'RUN_SINGLE_NODE':
      return typeof msg.nodeId === 'string' && Array.isArray(msg.nodes) && Array.isArray(msg.edges);
    case 'UPDATE_VARIABLE':
      return typeof msg.name === 'string' && msg.value !== undefined;
    case 'START_STREAM':
    case 'STOP_STREAM':
    case 'CANCEL_PICKER':
      return true;
    case 'PICK_SELECTOR':
      return typeof msg.nodeId === 'string';
    default:
      return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API Request/Response Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Authentication request
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Authentication response
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface LoginResponse {
  success: boolean;
  token?: string;
  csrfToken?: string;
  error?: string;
}

/**
 * Project save request
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface SaveProjectRequest {
  name: string;
  data: {
    nodes: any[];
    edges: any[];
    variables?: Record<string, any>;
    launchSettings?: any;
    browserSettings?: BrowserSettings;
  };
}

/**
 * Project save response
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface SaveProjectResponse {
  success: boolean;
  error?: string;
}

/**
 * Project load response
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface LoadProjectResponse {
  nodes: any[];
  edges: any[];
  variables: Record<string, any>;
  launchSettings?: any;
  browserSettings?: BrowserSettings;
}

/**
 * Multiple projects run request
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface RunMultipleRequest {
  projectNames: string[];
  projectSettings?: Record<string, any>;
}

/**
 * Multiple projects run response
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface RunMultipleResponse {
  success: boolean;
  results: Record<string, boolean>;
  error?: string;
}

/**
 * Project status information
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface ProjectStatus {
  isRunning: boolean;
  activeNodeTitle: string | null;
}

/**
 * Status response for all projects
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface StatusResponse {
  [projectName: string]: ProjectStatus;
}

/**
 * Health check response
 * Requirement 24: Health Check Endpoint
 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: number;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  activeSessionCount: number;
  activeBrowserCount: number;
}

/**
 * Generic API error response
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Enhanced ProjectSession Interface
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Browser settings configuration
 */
export interface BrowserSettings {
  width?: number;
  height?: number;
  profile?: string;
  profileDir?: string;
  proxy?: string;
  disableImages?: boolean;
}

/**
 * Bot execution settings
 */
export interface BotSettings {
  photoDebug: boolean;
  disableImages?: boolean;
  width?: number;
  height?: number;
  browserWidth?: number;
  browserHeight?: number;
  profile?: string;
  profileDir?: string;
  proxy?: string;
  verboseLogs?: boolean; // Детальне логування кроків кожної ноди в консолі (за замовчуванням true)
}

/**
 * Extended WebSocket with project-specific properties
 * Requirement 8: WebSocket Connection Lifecycle Management
 */
export interface ExtendedWebSocket extends WebSocket {
  projectName: string;
  isStreaming: boolean;
  isBotRunning: boolean;
  isSingleNodeRun: boolean;
  lastActivity: number;
}

/**
 * Enhanced ProjectSession interface with lifecycle fields
 * Requirements: 8, 9, 10, 11, 21
 */
export interface ProjectSession {
  // Identification
  projectName: string;

  // Browser Resources (Requirement 9: Browser Instance Lifecycle Management)
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
  cdpPort: number;
  currentlyRunningProfileDir: string | null;

  // WebSocket Connection (Requirement 8: WebSocket Connection Lifecycle Management)
  activeWs: ExtendedWebSocket | null;

  // Bot State
  isBotRunning: boolean;
  lastActiveNodeId: string | null;
  lastActiveNodeTitle: string | null;

  // Network Interception Cache (for API Node)
  latestFarmId?: string | null;
  latestApiToken?: string | null;

  // Bot Configuration
  botSettings: BotSettings;
  globalVariables: Record<string, any>;
  nodeRuntimeState: Map<string, Record<string, any>>;

  // Streaming
  isStreaming: boolean;
  photoDebugEnabled: boolean;

  // Lifecycle (Requirement 21: Session State Persistence)
  createdAt: number;
  lastActivity: number;
  safetyTimeout: NodeJS.Timeout | null;
}

/**
 * Persisted session state for disk storage
 * Requirement 21: Session State Persistence
 */
export interface PersistedSession {
  projectName: string;
  isBotRunning: boolean;
  lastActiveNodeId: string | null;
  globalVariables: Record<string, any>;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Security Layer Interfaces
// ═══════════════════════════════════════════════════════════════════════════

/**
 * JWT token payload
 * Requirement 1: JWT Authentication
 */
export interface JWTPayload {
  userId: string;
  username: string;
  iat: number;  // issued at
  exp: number;  // expiration
}

/**
 * JWT Authentication Middleware interface
 * Requirement 1: JWT Authentication
 */
export interface AuthMiddleware {
  generateToken(userId: string, username: string): string;
  verifyToken(token: string): JWTPayload | null;
  middleware(req: Request, res: Response, next: NextFunction): void;
}

/**
 * CSRF Protection Middleware interface
 * Requirement 2: CSRF Protection
 */
export interface CSRFMiddleware {
  generateToken(sessionId: string): string;
  verifyToken(token: string, sessionId: string): boolean;
  middleware(req: Request, res: Response, next: NextFunction): void;
}

/**
 * Validation result
 * Requirements: 3, 4, 5, 6
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: any;
}

/**
 * Input Validation Service interface
 * Requirements: 3, 4, 5, 6
 */
export interface InputValidator {
  validateProjectName(name: string): ValidationResult;
  validateSelector(selector: string): ValidationResult;
  validateURL(url: string): ValidationResult;
  validateFilePath(path: string, baseDir: string): ValidationResult;
  validateJSON(data: string): ValidationResult;
}

/**
 * Rate limit result
 * Requirement 7: Rate Limiting for API Endpoints
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Rate Limiter interface
 * Requirement 7: Rate Limiting for API Endpoints
 */
export interface RateLimiter {
  checkLimit(identifier: string, endpoint: string): Promise<RateLimitResult>;
  resetLimit(identifier: string, endpoint: string): Promise<void>;
}

/**
 * Secrets Manager interface
 * Requirements: 17, 18
 */
export interface SecretsManager {
  getSecret(key: string): string | undefined;
  setSecret(key: string, value: string): void;
  encrypt(text: string): string;
  decrypt(encrypted: string): string;
  encryptProjectSecrets(projectData: any): any;
  decryptProjectSecrets(projectData: any): any;
}

// ═══════════════════════════════════════════════════════════════════════════
// Resource Management Layer Interfaces
// ═══════════════════════════════════════════════════════════════════════════

/**
 * WebSocket Lifecycle Manager interface
 * Requirements: 8, 28
 */
export interface WebSocketLifecycle {
  registerConnection(ws: ExtendedWebSocket, projectName: string): void;
  unregisterConnection(ws: ExtendedWebSocket): void;
  cleanupInactiveConnections(): void;
  closeAllConnections(): Promise<void>;
}

/**
 * Browser Lifecycle Manager interface
 * Requirements: 9, 27
 */
export interface BrowserLifecycle {
  launchBrowser(session: ProjectSession, settings: BrowserSettings): Promise<Page>;
  closeBrowser(session: ProjectSession): Promise<void>;
  setupSafetyTimeout(session: ProjectSession, timeoutMs: number): void;
  cleanupZombieBrowsers(): Promise<void>;
}

/**
 * Timer Manager interface
 * Requirement 10: Timer Lifecycle Management
 */
export interface TimerManager {
  registerTimer(key: string, timer: NodeJS.Timeout): void;
  clearTimer(key: string): void;
  cleanupInactiveTimers(): void;
  clearAllTimers(): void;
}

/**
 * Memory statistics
 * Requirement 11: Memory Usage Monitoring
 */
export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

/**
 * Memory Monitor interface
 * Requirement 11: Memory Usage Monitoring
 */
export interface MemoryMonitor {
  checkMemoryUsage(): MemoryStats;
  limitNodeRuntimeState(state: Map<string, any>, maxSize: number): void;
  reportMemoryStats(): void;
}

/**
 * Semaphore for concurrency control
 * Requirement 19: Concurrency Control for Browser Instances
 */
export interface Semaphore {
  acquire(): Promise<void>;
  release(): void;
  run<T>(fn: () => Promise<T>): Promise<T>;
  getAvailable(): number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration Management Interfaces
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log levels
 * Requirement 12: Structured Logging
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Structured Logger interface
 * Requirement 12: Structured Logging
 */
export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error, meta?: any): void;
  setContext(context: string): Logger;
}

/**
 * Application configuration
 * Requirement 16: Centralized Configuration Management
 */
export interface AppConfig {
  HTTP_PORT: number;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  BOT_SAFETY_LIMIT: number;
  STREAM_QUALITY: number;
  STREAM_DELAY: number;
  SCREENSHOT_TIMEOUT: number;
  MAX_PARALLEL_BROWSERS: number;
  SESSION_CLEANUP_INTERVAL: number;
  LOG_LEVEL: LogLevel;
  ALLOWED_ORIGINS: string[];
  REQUEST_TIMEOUT: number;
}

/**
 * Config Manager interface
 * Requirement 16: Centralized Configuration Management
 */
export interface ConfigManager {
  get<T>(key: string, defaultValue: T): T;
  validate(): ValidationResult[];
  reload(): void;
  getConfig(): AppConfig;
}

// ═══════════════════════════════════════════════════════════════════════════
// Shutdown and Persistence Interfaces
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Shutdown Manager interface
 * Requirement 20: Graceful Shutdown
 */
export interface ShutdownManager {
  registerCleanupTask(name: string, task: () => Promise<void>): void;
  shutdown(signal: string): Promise<void>;
}

/**
 * Session Persister interface
 * Requirement 21: Session State Persistence
 */
export interface SessionPersister {
  saveState(): Promise<void>;
  loadState(): Promise<void>;
  scheduleAutoSave(intervalMs: number): void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Express Request Extensions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extended Express Request with JWT payload
 * Requirement 1: JWT Authentication
 */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

/**
 * Extended Express Request with CSRF validation
 * Requirement 2: CSRF Protection
 */
export interface CSRFRequest extends Request {
  csrfToken?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Error Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Custom error class for validation errors
 * Requirements: 3, 4, 5, 6
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Custom error class for authentication errors
 * Requirement 1: JWT Authentication
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Custom error class for authorization errors
 * Requirement 2: CSRF Protection
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Custom error class for rate limit errors
 * Requirement 7: Rate Limiting for API Endpoints
 */
export class RateLimitError extends Error {
  constructor(message: string, public resetAt: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}
